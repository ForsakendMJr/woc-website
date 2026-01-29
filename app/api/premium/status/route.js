// app/api/premium/status/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Not signed in
    if (!session) {
      return NextResponse.json({
        ok: true,
        authed: false,
        premium: false,
        active: false,
        tier: "free",
        renewalAt: null,
        cancelAtPeriodEnd: false,
        pendingTier: "",
        pendingEffectiveAt: "",
        pendingBlocked: false,
        pendingBlockedReason: "",
      });
    }

    const discordId = pickDiscordId(session);

    // Signed in, but Discord ID missing or invalid
    if (!discordId) {
      return NextResponse.json({
        ok: true,
        authed: true,
        discordId: "",
        premium: false,
        active: false,
        tier: "free",
        expiresAt: null,
        renewalAt: null,
        cancelAtPeriodEnd: false,
        pendingTier: "",
        pendingEffectiveAt: "",
        pendingBlocked: false,
        pendingBlockedReason: "Discord ID missing from session.",
      });
    }

    await dbConnect();

    const doc = await PremiumUser.findOne({ discordId }).lean();

    const tier = String(doc?.tier || "free").toLowerCase().trim();
    const premium = tier !== "free";
    const active = premium; // your system treats tier as the truth
    const expiresAt = doc?.expiresAt || null;

    // Scheduled upgrade info stored in Mongo meta
    const pendingTier = String(doc?.meta?.pendingTier || "").toLowerCase().trim();
    const pendingEffectiveAt = doc?.meta?.pendingEffectiveAt || "";
    const pendingBlocked = !!doc?.meta?.pendingBlocked;
    const pendingBlockedReason = String(doc?.meta?.pendingBlockedReason || "");

    // Stripe subscription info (optional)
    let renewalAt = null;
    let cancelAtPeriodEnd = false;
    let stripeStatus = "";

    const subId = doc?.meta?.stripeSubscriptionId || null;

    if (subId && process.env.STRIPE_SECRET_KEY) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId);

        // current_period_end is unix seconds
        if (sub?.current_period_end) {
          renewalAt = new Date(sub.current_period_end * 1000).toISOString();
        }

        cancelAtPeriodEnd = !!sub?.cancel_at_period_end;
        stripeStatus = String(sub?.status || "").toLowerCase();
      } catch (e) {
        // Don’t fail status endpoint if Stripe lookup fails
        console.warn(
          "[premium status] stripe sub retrieve failed:",
          String(e?.message || e)
        );
      }
    }

    return NextResponse.json({
      ok: true,
      authed: true,
      discordId,
      premium,
      active,
      tier,
      expiresAt,

      // Stripe UX extras
      renewalAt,
      cancelAtPeriodEnd,
      stripeStatus,

      // Pending upgrade UX extras
      pendingTier,
      pendingEffectiveAt,
      pendingBlocked,
      pendingBlockedReason,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
