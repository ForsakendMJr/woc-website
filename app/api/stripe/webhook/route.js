import Stripe from "stripe";
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import PremiumUser from "../../../models/PremiumUser";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function tierFromLevel(level) {
  const x = String(level || "").trim();
  if (x === "1") return "supporter";
  if (x === "2") return "supporter_plus";
  if (x === "3") return "supporter_plus_plus";
  return "free";
}

async function grantPremium({ discordId, tier, meta = {} }) {
  if (!/^[0-9]{17,20}$/.test(String(discordId || ""))) return;

  await dbConnect();

  await PremiumUser.findOneAndUpdate(
    { discordId },
    {
      $set: {
        discordId,
        tier,
        expiresAt: null, // subscriptions are “active until cancelled” (we handle cancel events below)
        active: true, // (your schema doesn't have active, but leaving it doesn't hurt if you added it elsewhere)
        meta: { ...(meta || {}) },
      },
    },
    { upsert: true, new: true }
  );
}

async function setFree({ discordId, meta = {} }) {
  if (!/^[0-9]{17,20}$/.test(String(discordId || ""))) return;

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
    const sig = req.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" },
        { status: 500 }
      );
    }

    // IMPORTANT: Stripe requires raw body for signature verification
    const rawBody = await req.text();

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `Webhook signature verify failed: ${err?.message}` },
        { status: 400 }
      );
    }

    const type = event.type;

    // ✅ 1) Checkout completed -> subscription created
    if (type === "checkout.session.completed") {
      const s = event.data.object;

      // We set this in checkout route:
      const discordId = s.client_reference_id || s?.metadata?.discordId;
      const level = s?.metadata?.woc_level;
      const tier = s?.metadata?.woc_tier || tierFromLevel(level);

      const subscriptionId = s.subscription || null;
      const customerId = s.customer || null;

      await grantPremium({
        discordId,
        tier,
        meta: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          lastCheckoutSessionId: s.id,
        },
      });

      return NextResponse.json({ ok: true });
    }

    // ✅ 2) Subscription updates (upgrade/downgrade, canceled, etc.)
    if (
      type === "customer.subscription.deleted" ||
      type === "customer.subscription.updated"
    ) {
      const sub = event.data.object;

      // We need to map subscription -> user.
      // We stored stripeSubscriptionId in meta above.
      await dbConnect();

      const doc = await PremiumUser.findOne({
        "meta.stripeSubscriptionId": sub.id,
      }).lean();

      if (!doc?.discordId) {
        return NextResponse.json({ ok: true, note: "No matching user for sub." });
      }

      const status = String(sub.status || "").toLowerCase();
      const isActive = status === "active" || status === "trialing";

      if (!isActive) {
        await setFree({
          discordId: doc.discordId,
          meta: { ...(doc.meta || {}), lastStripeStatus: status },
        });
      } else {
        // keep whatever tier they already have
        await PremiumUser.findOneAndUpdate(
          { discordId: doc.discordId },
          { $set: { meta: { ...(doc.meta || {}), lastStripeStatus: status } } }
        );
      }

      return NextResponse.json({ ok: true });
    }

    // Ignore other events
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
