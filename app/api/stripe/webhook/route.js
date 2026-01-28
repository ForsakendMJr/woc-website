// app/api/stripe/webhook/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import PremiumUser from "../../../models/PremiumUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function tierFromLevel(level) {
  const x = String(level || "").trim();
  if (x === "1") return "supporter";
  if (x === "2") return "supporter_plus";
  if (x === "3") return "supporter_plus_plus";
  return "free";
}

async function grantPremium({ discordId, tier, meta = {} }) {
  if (!/^[0-9]{17,20}$/.test(String(discordId || "").trim())) return;

  await dbConnect();

  const updated = await PremiumUser.findOneAndUpdate(
    { discordId },
    {
      $set: {
        discordId,
        tier,
        expiresAt: null,
        meta: { ...(meta || {}) },
      },
    },
    { upsert: true, new: true }
  ).lean();

  // ✅ Confirms the DB write actually happened (or not)
  console.log("[stripe webhook] DB updated premium user:", updated);
}

async function setFree({ discordId, meta = {} }) {
  if (!/^[0-9]{17,20}$/.test(String(discordId || "").trim())) return;

  await dbConnect();

  const updated = await PremiumUser.findOneAndUpdate(
    { discordId },
    {
      $set: {
        tier: "free",
        expiresAt: null,
        meta: { ...(meta || {}) },
      },
    },
    { upsert: true, new: true }
  ).lean();

  console.log("[stripe webhook] DB set user to free:", updated);
}

export async function POST(req) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers.get("stripe-signature") || "";

    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" },
        { status: 500 }
      );
    }

    if (!sig) {
      return NextResponse.json(
        { ok: false, error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // Stripe requires RAW body for signature verification
    const rawBody = await req.text();

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: `Webhook signature verify failed: ${err?.message || err}`,
        },
        { status: 400 }
      );
    }

    const type = event.type;

    // ✅ Helpful top-level log
    console.log("[stripe webhook] received:", type);

    // ✅ Checkout completed -> grant immediately
    if (type === "checkout.session.completed") {
      const s = event.data.object;

      const discordId = String(
        s.client_reference_id || s?.metadata?.discordId || ""
      ).trim();

      console.log("[stripe webhook] discordId resolved as:", discordId);

      const level = String(s?.metadata?.woc_level || "").trim();
      const tier = String(s?.metadata?.woc_tier || tierFromLevel(level)).trim();

      console.log("[stripe webhook] level/tier:", { level, tier });

      const subscriptionId = s.subscription || null;
      const customerId = s.customer || null;

      console.log("[stripe webhook] stripe ids:", {
        sessionId: s.id,
        subscriptionId,
        customerId,
      });

      if (!discordId) {
        console.warn("[stripe webhook] checkout completed but no discordId", {
          sessionId: s.id,
          hasClientReferenceId: !!s.client_reference_id,
          hasMetadataDiscordId: !!s?.metadata?.discordId,
          metadataKeys: Object.keys(s?.metadata || {}),
        });
        return NextResponse.json({
          ok: true,
          warning: "No discordId on session",
        });
      }

      await grantPremium({
        discordId,
        tier,
        meta: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          lastCheckoutSessionId: s.id,
          lastStripeEvent: type,
        },
      });

      return NextResponse.json({ ok: true });
    }

    // ✅ Subscription updated/deleted -> keep or revoke
    if (
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object;

      await dbConnect();
      const doc = await PremiumUser.findOne({
        "meta.stripeSubscriptionId": sub.id,
      }).lean();

      if (!doc?.discordId) {
        console.log("[stripe webhook] no matching user for subscription:", sub.id);
        return NextResponse.json({
          ok: true,
          note: "No matching user for subscription.",
        });
      }

      const status = String(sub.status || "").toLowerCase();
      const isActive = status === "active" || status === "trialing";

      console.log("[stripe webhook] sub status:", { subId: sub.id, status, isActive });

      if (!isActive) {
        await setFree({
          discordId: doc.discordId,
          meta: {
            ...(doc.meta || {}),
            lastStripeStatus: status,
            lastStripeEvent: type,
          },
        });
      } else {
        const updated = await PremiumUser.findOneAndUpdate(
          { discordId: doc.discordId },
          {
            $set: {
              meta: {
                ...(doc.meta || {}),
                lastStripeStatus: status,
                lastStripeEvent: type,
              },
            },
          },
          { new: true }
        ).lean();

        console.log("[stripe webhook] sub active, kept tier. DB:", updated);
      }

      return NextResponse.json({ ok: true });
    }

    // ✅ Invoice signals: just ACK (don’t fail delivery)
    if (type === "invoice.payment_succeeded") {
      console.log("[stripe webhook] invoice.payment_succeeded ACK");
      return NextResponse.json({ ok: true });
    }
    if (type === "invoice.payment_failed") {
      console.log("[stripe webhook] invoice.payment_failed ACK");
      return NextResponse.json({ ok: true });
    }

    // Anything else: ACK
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[stripe webhook] fatal:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
