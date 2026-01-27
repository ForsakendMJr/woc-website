import Stripe from "stripe";
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import PremiumUser from "../../../models/PremiumUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function isSnowflake(id) {
  return /^[0-9]{17,20}$/.test(String(id || "").trim());
}

function tierFromLevel(level) {
  const x = String(level || "").trim();
  if (x === "1") return "supporter";
  if (x === "2") return "supporter_plus";
  if (x === "3") return "supporter_plus_plus";
  return "free";
}

async function grantPremium({ discordId, tier, meta = {} }) {
  if (!isSnowflake(discordId)) return;

  await dbConnect();

  await PremiumUser.findOneAndUpdate(
    { discordId },
    {
      $set: {
        discordId,
        tier,
        expiresAt: null, // subscription-based: active until cancelled
        meta: { ...(meta || {}) },
      },
    },
    { upsert: true, new: true }
  );
}

async function setFree({ discordId, meta = {} }) {
  if (!isSnowflake(discordId)) return;

  await dbConnect();

  await PremiumUser.findOneAndUpdate(
    { discordId },
    {
      $set: {
        discordId,
        tier: "free",
        expiresAt: null,
        meta: { ...(meta || {}) },
      },
    },
    { upsert: true, new: true }
  );
}

async function setStripeStatusByDiscordId(discordId, status) {
  if (!isSnowflake(discordId)) return;
  await dbConnect();
  await PremiumUser.findOneAndUpdate(
    { discordId },
    { $set: { meta: { lastStripeStatus: status } } },
    { new: true }
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

    // Stripe requires the raw body for signature verification
    const rawBody = await req.text();

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `Webhook signature verify failed: ${err?.message || err}` },
        { status: 400 }
      );
    }

    // ✅ Idempotency guard: don’t process the same event twice
    const eventId = event?.id;
    if (eventId) {
      await dbConnect();
      const already = await PremiumUser.findOne({ "meta.lastStripeEventId": eventId }).lean();
      if (already) return NextResponse.json({ ok: true, idempotent: true });

      // Mark event as seen on a dummy record (or first record we touch)
      // We'll also overwrite it later when we update the actual user record.
      await PremiumUser.updateOne(
        { discordId: "__stripe_event__" },
        { $set: { discordId: "__stripe_event__", meta: { lastStripeEventId: eventId } } },
        { upsert: true }
      );
    }

    const type = event.type;

    // ✅ 1) Checkout completed (best place to link Discord -> Stripe)
    if (type === "checkout.session.completed") {
      const s = event.data.object;

      const discordId = s.client_reference_id || s?.metadata?.discordId || "";
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
          lastStripeEventId: eventId || null,
          lastStripeEventType: type,
        },
      });

      return NextResponse.json({ ok: true });
    }

    // ✅ 2) Subscription created (sometimes arrives before/after checkout.completed)
    if (type === "customer.subscription.created") {
      const sub = event.data.object;
      const status = String(sub.status || "").toLowerCase();

      await dbConnect();
      const doc = await PremiumUser.findOne({
        "meta.stripeSubscriptionId": sub.id,
      }).lean();

      // If we haven't linked subscription to a discord user yet, we just record status.
      if (doc?.discordId) {
        await PremiumUser.findOneAndUpdate(
          { discordId: doc.discordId },
          {
            $set: {
              meta: {
                ...(doc.meta || {}),
                lastStripeStatus: status,
                lastStripeEventId: eventId || null,
                lastStripeEventType: type,
              },
            },
          }
        );
      }

      return NextResponse.json({ ok: true });
    }

    // ✅ 3) Subscription updated / deleted
    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const status = String(sub.status || "").toLowerCase();
      const isActive = status === "active" || status === "trialing";

      await dbConnect();

      const doc = await PremiumUser.findOne({
        "meta.stripeSubscriptionId": sub.id,
      }).lean();

      if (!doc?.discordId) {
        return NextResponse.json({ ok: true, note: "No matching user for subscription id." });
      }

      if (!isActive) {
        await setFree({
          discordId: doc.discordId,
          meta: {
            ...(doc.meta || {}),
            lastStripeStatus: status,
            lastStripeEventId: eventId || null,
            lastStripeEventType: type,
          },
        });
      } else {
        await PremiumUser.findOneAndUpdate(
          { discordId: doc.discordId },
          {
            $set: {
              meta: {
                ...(doc.meta || {}),
                lastStripeStatus: status,
                lastStripeEventId: eventId || null,
                lastStripeEventType: type,
              },
            },
          }
        );
      }

      return NextResponse.json({ ok: true });
    }

    // ✅ Optional: invoice events (doesn’t change tier, just records status)
    if (type === "invoice.payment_succeeded" || type === "invoice.payment_failed") {
      const inv = event.data.object;
      const subId = inv.subscription || null;

      if (subId) {
        await dbConnect();
        const doc = await PremiumUser.findOne({ "meta.stripeSubscriptionId": subId }).lean();
        if (doc?.discordId) {
          await PremiumUser.findOneAndUpdate(
            { discordId: doc.discordId },
            {
              $set: {
                meta: {
                  ...(doc.meta || {}),
                  lastInvoiceId: inv.id,
                  lastInvoiceEvent: type,
                  lastStripeEventId: eventId || null,
                  lastStripeEventType: type,
                },
              },
            }
          );
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Ignore other events
    return NextResponse.json({ ok: true, ignored: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
