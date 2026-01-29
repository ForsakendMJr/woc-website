// app/api/premium/schedule-upgrade/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// IMPORTANT: adjust this import if your authOptions export path differs
import { authOptions } from "../../auth/[...nextauth]/_authOptions";

import dbConnect from "../../../../lib/mongodb";
import PremiumUser from "../../../models/PremiumUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function isSnowflake(id) {
  return /^[0-9]{17,20}$/.test(String(id || "").trim());
}

function pickDiscordId(session) {
  const u = session?.user || {};
  const candidates = [u.discordId, u.id, u.sub, session?.sub].filter(Boolean);
  const id = String(candidates[0] || "").trim();
  return isSnowflake(id) ? id : "";
}

function getPriceIdForLevel(levelRaw) {
  const level = String(levelRaw || "").trim();
  if (level === "1") return process.env.STRIPE_PRICE_WOC_L1;
  if (level === "2") return process.env.STRIPE_PRICE_WOC_L2;
  if (level === "3") return process.env.STRIPE_PRICE_WOC_L3;
  return null;
}

function tierForLevel(levelRaw) {
  const level = String(levelRaw || "").trim();
  if (level === "1") return "supporter";
  if (level === "2") return "supporter_plus";
  if (level === "3") return "supporter_plus_plus";
  return "free";
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
    }

    const discordId = pickDiscordId(session);
    if (!discordId) {
      return NextResponse.json(
        { ok: false, error: "Discord ID missing from session." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const level = String(body?.level || "").trim();
    const targetTier = tierForLevel(level);
    const targetPriceId = getPriceIdForLevel(level);

    if (!targetPriceId || targetTier === "free") {
      return NextResponse.json(
        { ok: false, error: "Invalid level or missing Stripe price env." },
        { status: 400 }
      );
    }

    await dbConnect();
    const doc = await PremiumUser.findOne({ discordId }).lean();

    const subId = doc?.meta?.stripeSubscriptionId;
    if (!subId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No active subscription found for this account yet. Buy a plan first (or complete checkout) then try upgrade.",
        },
        { status: 400 }
      );
    }

    // Retrieve subscription to get current status + item id
    const sub = await stripe.subscriptions.retrieve(subId);

    const status = String(sub?.status || "").toLowerCase();
    const cancelAtPeriodEnd = !!sub?.cancel_at_period_end;

    // If they are canceling or not in a modifiable state, don’t try to change the plan.
    // Stripe can reject plan updates on canceled/canceling subscriptions depending on state.
    if (cancelAtPeriodEnd || status === "canceled") {
      // Store "pending" attempt in DB so UI can show a friendly message if you want
      await PremiumUser.findOneAndUpdate(
        { discordId },
        {
          $set: {
            meta: {
              ...(doc?.meta || {}),
              pendingTier: targetTier,
              pendingPriceId: targetPriceId,
              pendingEffectiveAt: null,
              pendingBlocked: true,
              pendingBlockedReason:
                "Your subscription is currently set to cancel. Open Manage subscription to resume it, then schedule an upgrade.",
              lastStripeEvent: "schedule_upgrade_blocked",
            },
          },
        },
        { upsert: true }
      );

      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          error:
            "Your subscription is currently set to cancel. Please open Manage subscription and remove the cancellation (resume), then schedule the upgrade.",
          cancelAtPeriodEnd,
          status,
        },
        { status: 409 }
      );
    }

    const item = sub?.items?.data?.[0];
    if (!item?.id) {
      return NextResponse.json(
        { ok: false, error: "Could not find subscription item to update." },
        { status: 500 }
      );
    }

    // If already on that price, no-op
    const currentPriceId = item?.price?.id || null;
    if (currentPriceId && currentPriceId === targetPriceId) {
      // Clear pending if they somehow already match
      await PremiumUser.findOneAndUpdate(
        { discordId },
        {
          $set: {
            meta: {
              ...(doc?.meta || {}),
              pendingTier: null,
              pendingEffectiveAt: null,
              pendingPriceId: null,
              pendingBlocked: false,
              pendingBlockedReason: null,
              lastStripeEvent: "schedule_upgrade_noop",
            },
          },
        },
        { upsert: true }
      );

      return NextResponse.json({
        ok: true,
        scheduled: false,
        message: "Already on that plan.",
        currentPriceId,
        targetPriceId,
      });
    }

    // ✅ Update price with NO proration => takes effect on next invoice/renewal
    const updated = await stripe.subscriptions.update(subId, {
      proration_behavior: "none",
      items: [{ id: item.id, price: targetPriceId }],
    });

    // Best “effective” moment we can show for UI:
    // When proration is none, change should apply next period. current_period_end is a good UX line.
    const effectiveAt = updated?.current_period_end
      ? new Date(updated.current_period_end * 1000).toISOString()
      : null;

    // Store “pending” in DB so UI can show it
    await PremiumUser.findOneAndUpdate(
      { discordId },
      {
        $set: {
          meta: {
            ...(doc?.meta || {}),
            pendingTier: targetTier,
            pendingEffectiveAt: effectiveAt,
            pendingPriceId: targetPriceId,
            pendingBlocked: false,
            pendingBlockedReason: null,
            lastStripeEvent: "schedule_upgrade",
          },
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      ok: true,
      scheduled: true,
      pendingTier: targetTier,
      pendingEffectiveAt: effectiveAt,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
