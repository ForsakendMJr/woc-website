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

function isSnowflake(id) {
  return /^[0-9]{17,20}$/.test(String(id || "").trim());
}

async function upsertPremiumUser(discordId, updates) {
  if (!isSnowflake(discordId)) return null;
  await dbConnect();

  const doc = await PremiumUser.findOneAndUpdate(
    { discordId },
    { $set: { discordId, ...(updates || {}) } },
    { upsert: true, new: true }
  ).lean();

  return doc;
}

async function grantPremium({ discordId, tier, meta = {} }) {
  return upsertPremiumUser(discordId, {
    tier,
    expiresAt: null, // subscription based: treated active until cancel/unpaid logic changes it
    meta: { ...(meta || {}) },
  });
}

async function setFree({ discordId, meta = {} }) {
  return upsertPremiumUser(discordId, {
    tier: "free",
    expiresAt: null,
    meta: { ...(meta || {}) },
  });
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

    const type = event?.type || "unknown";
    const obj = event?.data?.object;

    // Optional global log (safe)
    console.log("[stripe webhook] received:", type);

    // ✅ 1) Checkout completed -> grant immediately
    // This is your most reliable "grant premium" signal.
    if (type === "checkout.session.completed") {
      const s = obj;

      const discordId = String(
        s?.client_reference_id || s?.metadata?.discordId || ""
      ).trim();

let level = s?.metadata?.woc_level;
let tier = s?.metadata?.woc_tier;

// 🔧 DEV OVERRIDE: treat test plan as supporter
if (level === "test") {
  level = "1";
  tier = "supporter";
}

tier = tier || tierFromLevel(level);


      const subscriptionId = s?.subscription || null;
      const customerId = s?.customer || null;

      // ✅ Debug logs (discordId exists here)
      console.log("[stripe webhook] discordId resolved as:", discordId);
      console.log("[stripe webhook] level/tier:", { level, tier });
      console.log("[stripe webhook] stripe ids:", {
        sessionId: s?.id,
        subscriptionId,
        customerId,
      });

      if (!isSnowflake(discordId)) {
        console.warn("[stripe webhook] checkout completed but no valid discordId", {
          sessionId: s?.id,
          client_reference_id: s?.client_reference_id || null,
          metadataKeys: Object.keys(s?.metadata || {}),
          metadataDiscordId: s?.metadata?.discordId || null,
        });

        // Don’t fail the webhook delivery. Stripe will keep retrying forever otherwise.
        return NextResponse.json({ ok: true, warning: "No valid discordId on session" });
      }

      await grantPremium({
        discordId,
        tier,
        meta: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          lastCheckoutSessionId: s?.id,
          lastStripeEvent: type,
          lastStripeStatus: "checkout_completed",
        },
      });

      console.log("[stripe webhook] granted premium to:", discordId);
      return NextResponse.json({ ok: true });
    }

    // ✅ 2) Subscription updated/deleted -> keep or revoke
    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const sub = obj;

      const subId = sub?.id || "";
      const status = String(sub?.status || "").toLowerCase();

      // Find user by stored subscriptionId
      await dbConnect();
      const existing = await PremiumUser.findOne({
        "meta.stripeSubscriptionId": subId,
      }).lean();

      if (!existing?.discordId) {
        // Not an error: could be older data, or checkout didn't store it.
        console.log("[stripe webhook] no matching user for subscription:", subId);
        return NextResponse.json({ ok: true, note: "No matching user for subscription." });
      }

      const isActive = status === "active" || status === "trialing";

      if (!isActive) {
        await setFree({
          discordId: existing.discordId,
          meta: {
            ...(existing.meta || {}),
            lastStripeStatus: status,
            lastStripeEvent: type,
          },
        });
        console.log("[stripe webhook] set FREE (subscription not active):", {
          discordId: existing.discordId,
          status,
        });
      } else {
        // Keep tier as-is, just update status metadata
        await upsertPremiumUser(existing.discordId, {
          meta: {
            ...(existing.meta || {}),
            lastStripeStatus: status,
            lastStripeEvent: type,
          },
        });
        console.log("[stripe webhook] kept premium (subscription active):", {
          discordId: existing.discordId,
          status,
        });
      }

      return NextResponse.json({ ok: true });
    }

    // ✅ 3) Invoice signals: always ACK.
    // If you want to revoke on failed payments, you can extend this later.
    if (type === "invoice.payment_succeeded") {
      return NextResponse.json({ ok: true });
    }

    if (type === "invoice.payment_failed") {
      return NextResponse.json({ ok: true });
    }

    // Anything else: ACK
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[stripe webhook] error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
