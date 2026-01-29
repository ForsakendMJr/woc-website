// app/api/stripe/webhook/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import PremiumUser from "../../../models/PremiumUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Your WoC hub + roles
const HUB_GUILD_ID = "902705980993859634";

const ROLE_DONATOR = "1464497886669705226";
const ROLE_L1 = "1466232621112496148";
const ROLE_L2 = "1466232628741935228";
const ROLE_L3 = "1466232629819867248";

const PREMIUM_ROLES = [ROLE_L1, ROLE_L2, ROLE_L3];
const ALL_DONOR_ROLES = [ROLE_DONATOR, ...PREMIUM_ROLES];

// ✅ PriceId -> Tier mapping (this is the MOST reliable way)
function tierFromPriceId(priceId) {
  const p1 = process.env.STRIPE_PRICE_WOC_L1;
  const p2 = process.env.STRIPE_PRICE_WOC_L2;
  const p3 = process.env.STRIPE_PRICE_WOC_L3;

  if (priceId && p1 && priceId === p1) return "supporter";
  if (priceId && p2 && priceId === p2) return "supporter_plus";
  if (priceId && p3 && priceId === p3) return "supporter_plus_plus";
  return "free";
}

// fallback if you still pass woc_level metadata sometimes
function tierFromLevel(level) {
  const x = String(level || "").trim();
  if (x === "1") return "supporter";
  if (x === "2") return "supporter_plus";
  if (x === "3") return "supporter_plus_plus";
  return "free";
}

function roleForTier(tierRaw) {
  const t = String(tierRaw || "").toLowerCase().trim();
  if (t === "supporter") return ROLE_L1;
  if (t === "supporter_plus") return ROLE_L2;
  if (t === "supporter_plus_plus") return ROLE_L3;
  return null;
}

async function discordAddRole(userId, roleId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

  const url = `https://discord.com/api/v10/guilds/${HUB_GUILD_ID}/members/${userId}/roles/${roleId}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
  });

  // 204 = success
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Discord add role failed (${res.status}): ${txt}`);
  }
}

async function discordRemoveRole(userId, roleId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

  const url = `https://discord.com/api/v10/guilds/${HUB_GUILD_ID}/members/${userId}/roles/${roleId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // common: role not present; ignore 404-ish cases outside
    throw new Error(`Discord remove role failed (${res.status}): ${txt}`);
  }
}

async function applyDiscordPremiumRoles(discordId, tier) {
  const tierRole = roleForTier(tier);

  if (tierRole) {
    // Always ensure main Donator + tier role exists
    await discordAddRole(discordId, ROLE_DONATOR);
    await discordAddRole(discordId, tierRole);

    // Remove other tier roles
    for (const r of PREMIUM_ROLES) {
      if (r !== tierRole) {
        try {
          await discordRemoveRole(discordId, r);
        } catch {}
      }
    }
    return;
  }

  // Free -> remove everything donor-related
  for (const r of ALL_DONOR_ROLES) {
    try {
      await discordRemoveRole(discordId, r);
    } catch {}
  }
}

function isSnowflake(id) {
  return /^[0-9]{17,20}$/.test(String(id || "").trim());
}

async function upsertPremiumUser(discordId, patch) {
  if (!isSnowflake(discordId)) return null;
  await dbConnect();

  const updated = await PremiumUser.findOneAndUpdate(
    { discordId },
    { $set: { discordId, ...(patch || {}) } },
    { upsert: true, new: true }
  ).lean();

  return updated;
}

async function findByStripeLink({ subscriptionId, customerId }) {
  await dbConnect();
  if (subscriptionId) {
    const doc = await PremiumUser.findOne({
      "meta.stripeSubscriptionId": subscriptionId,
    }).lean();
    if (doc?.discordId) return doc;
  }
  if (customerId) {
    const doc = await PremiumUser.findOne({
      "meta.stripeCustomerId": customerId,
    }).lean();
    if (doc?.discordId) return doc;
  }
  return null;
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

    const type = event.type;
    console.log("[stripe webhook] received:", type);

    // ✅ 1) Checkout completed -> we can grant immediately (best signal)
    if (type === "checkout.session.completed") {
      const s = event.data.object;

      const discordId = String(
        s.client_reference_id || s?.metadata?.discordId || ""
      ).trim();

      const subscriptionId = s.subscription || null;
      const customerId = s.customer || null;

      const level = String(s?.metadata?.woc_level || "").trim();
      const tierFromMeta = String(s?.metadata?.woc_tier || tierFromLevel(level)).trim();

      console.log("[stripe webhook] discordId resolved as:", discordId);
      console.log("[stripe webhook] level/tier(meta):", { level, tier: tierFromMeta });
      console.log("[stripe webhook] stripe ids:", {
        sessionId: s.id,
        subscriptionId,
        customerId,
      });

      if (!isSnowflake(discordId)) {
        console.warn("[stripe webhook] checkout completed but no valid discordId", {
          sessionId: s.id,
          client_reference_id: s.client_reference_id,
          metadataKeys: Object.keys(s?.metadata || {}),
        });
        return NextResponse.json({ ok: true, warning: "No valid discordId on session" });
      }

      // Pull real tier from subscription price when possible
      let tier = tierFromMeta;
      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = sub?.items?.data?.[0]?.price?.id || "";
          const tierFromPrice = tierFromPriceId(priceId);
          if (tierFromPrice !== "free") tier = tierFromPrice;

          await upsertPremiumUser(discordId, {
            tier,
            expiresAt: null,
            meta: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              lastCheckoutSessionId: s.id,
              lastStripeEvent: type,
              currentPriceId: priceId || null,
              lastStripeStatus: String(sub?.status || ""),
              // clear any stale pending flags on fresh checkout
              pendingTier: null,
              pendingEffectiveAt: null,
            },
          });
        } catch (e) {
          console.error("[stripe webhook] sub retrieve failed:", String(e?.message || e));
          await upsertPremiumUser(discordId, {
            tier,
            expiresAt: null,
            meta: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              lastCheckoutSessionId: s.id,
              lastStripeEvent: type,
            },
          });
        }
      } else {
        await upsertPremiumUser(discordId, {
          tier,
          expiresAt: null,
          meta: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            lastCheckoutSessionId: s.id,
            lastStripeEvent: type,
          },
        });
      }

      // Apply Discord roles (don’t fail webhook if this fails)
      try {
        await applyDiscordPremiumRoles(discordId, tier);
        console.log("[stripe webhook] Discord roles applied:", { discordId, tier });
      } catch (e) {
        console.error("[stripe webhook] Discord role apply failed:", String(e?.message || e));
      }

      return NextResponse.json({ ok: true });
    }

    // ✅ 2) Subscription updated/deleted -> revoke if not active
    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const sub = event.data.object;

      const subscriptionId = sub.id || null;
      const customerId = sub.customer || null;
      const status = String(sub.status || "").toLowerCase();
      const isActive = status === "active" || status === "trialing";
      const priceId = sub?.items?.data?.[0]?.price?.id || null;

      const doc = await findByStripeLink({ subscriptionId, customerId });
      if (!doc?.discordId) {
        console.log("[stripe webhook] no matching user for subscription:", subscriptionId);
        return NextResponse.json({ ok: true });
      }

      console.log("[stripe webhook] sub status:", { subscriptionId, status, isActive, priceId });

      if (!isActive) {
        await upsertPremiumUser(doc.discordId, {
          tier: "free",
          expiresAt: null,
          meta: {
            ...(doc.meta || {}),
            lastStripeStatus: status,
            lastStripeEvent: type,
            currentPriceId: priceId,
            pendingTier: null,
            pendingEffectiveAt: null,
          },
        });

        try {
          await applyDiscordPremiumRoles(doc.discordId, "free");
          console.log("[stripe webhook] Discord roles revoked:", doc.discordId);
        } catch (e) {
          console.error("[stripe webhook] Discord role revoke failed:", String(e?.message || e));
        }

        return NextResponse.json({ ok: true });
      }

      // active: just record + optionally re-sync roles
      const inferredTier = tierFromPriceId(priceId);
      const keepTier = inferredTier !== "free" ? inferredTier : (doc.tier || "free");

      await upsertPremiumUser(doc.discordId, {
        tier: keepTier,
        expiresAt: null,
        meta: {
          ...(doc.meta || {}),
          lastStripeStatus: status,
          lastStripeEvent: type,
          currentPriceId: priceId,
        },
      });

      try {
        await applyDiscordPremiumRoles(doc.discordId, keepTier);
      } catch {}

      return NextResponse.json({ ok: true });
    }

    // ✅ 3) Renewal payment succeeded -> ACTIVATE any scheduled tier
    if (type === "invoice.payment_succeeded") {
      const inv = event.data.object;

      const subscriptionId = inv.subscription || null;
      const customerId = inv.customer || null;

      const doc = await findByStripeLink({ subscriptionId, customerId });
      if (!doc?.discordId) {
        console.log("[stripe webhook] invoice paid but no matching user", { subscriptionId, customerId });
        return NextResponse.json({ ok: true });
      }

      // Read current subscription price -> determine tier
      let tier = doc.tier || "free";
      try {
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = sub?.items?.data?.[0]?.price?.id || "";
          const inferred = tierFromPriceId(priceId);
          if (inferred !== "free") tier = inferred;

          console.log("[stripe webhook] invoice paid -> inferred tier:", {
            discordId: doc.discordId,
            priceId,
            tier,
          });

          // If we had a pending tier, clear it now (renewal happened)
          await upsertPremiumUser(doc.discordId, {
            tier,
            expiresAt: null,
            meta: {
              ...(doc.meta || {}),
              lastStripeEvent: type,
              lastStripeStatus: String(sub?.status || ""),
              currentPriceId: priceId || null,
              pendingTier: null,
              pendingEffectiveAt: null,
              lastInvoiceId: inv.id || null,
            },
          });
        } else {
          await upsertPremiumUser(doc.discordId, {
            tier,
            expiresAt: null,
            meta: {
              ...(doc.meta || {}),
              lastStripeEvent: type,
              pendingTier: null,
              pendingEffectiveAt: null,
              lastInvoiceId: inv.id || null,
            },
          });
        }
      } catch (e) {
        console.error("[stripe webhook] invoice tier resolve failed:", String(e?.message || e));
        // Still ACK. Don’t fail Stripe.
        return NextResponse.json({ ok: true });
      }

      // Apply Discord roles based on the tier after renewal
      try {
        await applyDiscordPremiumRoles(doc.discordId, tier);
      } catch (e) {
        console.error("[stripe webhook] Discord role apply after invoice failed:", String(e?.message || e));
      }

      return NextResponse.json({ ok: true });
    }

    // ✅ 4) Payment failed: don’t instantly punish (Stripe retries), just ACK
    if (type === "invoice.payment_failed") {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[stripe webhook] fatal:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
