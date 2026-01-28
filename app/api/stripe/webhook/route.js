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

  await PremiumUser.findOneAndUpdate(
    { discordId },
    {
      $set: {
        discordId,
        tier,
        expiresAt: null, // active until cancelled (we flip to free on cancel/unpaid)
        meta: { ...(meta || {}) },
      },
    },
    { upsert: true, new: true }
  );
}

async function setFree({ discordId, meta = {} }) {
  if (!/^[0-9]{17,20}$/.test(String(discordId || "").trim())) return;

  await dbConnect();

  await PremiumUser.findOneAndUpdate(
    { discordId },
    {
      $set: {
        tier: "free",
        expiresAt: null,
        meta: { ...(meta || {}) },
      },
    },
    { upsert: true, new: true }
  );
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

    // Stripe requires raw body for signature verification
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

    // 1) Checkout completed -> we can grant immediately (best signal)
    if (type === "checkout.session.completed") {
      const s = event.data.object;

      const discordId =
        String(s.client_reference_id || s?.metadata?.discordId || "").trim();

      // IMPORTANT: This only works if your checkout route sets client_reference_id/metadata.discordId
      const level = s?.metadata?.woc_level;
      const tier = s?.metadata?.woc_tier || tierFromLevel(level);

      const subscriptionId = s.subscription || null;
      const customerId = s.customer || null;

      if (!discordId) {
        // Don’t fail the webhook, just log it
        console.warn("[stripe webhook] checkout completed but no discordId", {
          sessionId: s.id,
        });
        return NextResponse.json({ ok: true, warning: "No discordId on session" });
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

    // 2) Subscription changes/cancel
    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const sub = event.data.object;

      await dbConnect();
      const doc = await PremiumUser.findOne({
        "meta.stripeSubscriptionId": sub.id,
      }).lean();

      if (!doc?.discordId) {
        return NextResponse.json({ ok: true, note: "No matching user for subscription." });
      }

      const status = String(sub.status || "").toLowerCase();
      const isActive = status === "active" || status === "trialing";

      if (!isActive) {
        await setFree({
          discordId: doc.discordId,
          meta: { ...(doc.meta || {}), lastStripeStatus: status, lastStripeEvent: type },
        });
      } else {
        await PremiumUser.findOneAndUpdate(
          { discordId: doc.discordId },
          { $set: { meta: { ...(doc.meta || {}), lastStripeStatus: status, lastStripeEvent: type } } }
        );
      }

      return NextResponse.json({ ok: true });
    }

    // 3) Invoice payment signals (Stripe will send these; we should ACK them)
    if (type === "invoice.payment_succeeded") {
      // You can optionally record it, but DO NOT fail delivery
      return NextResponse.json({ ok: true });
    }

    if (type === "invoice.payment_failed") {
      // Optional: you might setFree here if you want “past_due/unpaid” to lose premium
      return NextResponse.json({ ok: true });
    }

    // Everything else: acknowledge
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
