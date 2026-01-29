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

// Tier ranking (used for upgrades)
const TIER_ORDER = ["free", "supporter", "supporter_plus", "supporter_plus_plus"];
const tierRank = (t) => {
  const x = String(t || "free").toLowerCase().trim();
  const i = TIER_ORDER.indexOf(x);
  return i === -1 ? 0 : i;
};
const maxTier = (a, b) => (tierRank(a) >= tierRank(b) ? a : b);

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

function getDiscordBotToken() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");
  return token;
}

// Small helper so we can log Discord errors nicely
async function discordFetch(url, options) {
  const res = await fetch(url, options);
  if (res.ok) return { ok: true, status: res.status, text: "" };
  const txt = await res.text().catch(() => "");
  return { ok: false, status: res.status, text: txt };
}

async function discordAddRole(userId, roleId) {
  const token = getDiscordBotToken();
  const url = `https://discord.com/api/v10/guilds/${HUB_GUILD_ID}/members/${userId}/roles/${roleId}`;
  const out = await discordFetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
  });

  // Success is usually 204
  if (!out.ok) throw new Error(`Discord add role failed (${out.status}): ${out.text}`);
}

async function discordRemoveRole(userId, roleId) {
  const token = getDiscordBotToken();
  const url = `https://discord.com/api/v10/guilds/${HUB_GUILD_ID}/members/${userId}/roles/${roleId}`;
  const out = await discordFetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!out.ok) throw new Error(`Discord remove role failed (${out.status}): ${out.text}`);
}

/**
 * 🔄 “Sync my roles” logic lives here too:
 * We compute the desired role set from tier, then add/remove to match.
 * (We don’t need to read member roles; we just apply add/remove safely.)
 */
async function applyDiscordPremiumRoles(discordId, tierRaw) {
  const tier = String(tierRaw || "free").toLowerCase().trim();
  const tierRole = roleForTier(tier);

  // Desired:
  // - free: none of donor roles
  // - paid: ROLE_DONATOR + tier role (only one tier role)
  if (tierRole) {
    // Ensure donator + correct tier role
    await discordAddRole(discordId, ROLE_DONATOR);
    await discordAddRole(discordId, tierRole);

    // Remove other tier roles
    for (const r of PREMIUM_ROLES) {
      if (r === tierRole) continue;
      try {
        await discordRemoveRole(discordId, r);
      } catch {
        // ignore (role not present / etc)
      }
    }
    return;
  }

  // Free: remove everything donor-related
  for (const r of ALL_DONOR_ROLES) {
    try {
      await discordRemoveRole(discordId, r);
    } catch {
      // ignore
    }
  }
}

/**
 * ✅ Upgrades:
 * If user already has a higher tier in DB, we keep the higher tier.
 * (So buying Level 1 while already Level 3 won’t downgrade them.)
 */
async function grantPremium({ discordId, incomingTier, meta = {} }) {
  if (!/^[0-9]{17,20}$/.test(String(discordId || "").trim())) return null;

  await dbConnect();

  const existing = await PremiumUser.findOne({ discordId }).lean();
  const existingTier = existing?.tier || "free";

  const finalTier = maxTier(existingTier, incomingTier);

  const mergedMeta = {
    ...(existing?.meta || {}),
    ...(meta || {}),
    lastTierIncoming: String(incomingTier || "free"),
    lastTierFinal: String(finalTier || "free"),
    lastPremiumWriteAt: new Date().toISOString(),
  };

  const updated = await PremiumUser.findOneAndUpdate(
    { discordId },
    {
      $set: {
        discordId,
        tier: finalTier,
        expiresAt: null,
        meta: mergedMeta,
      },
    },
    { upsert: true, new: true }
  ).lean();

  console.log("[stripe webhook] DB updated premium user:", {
    discordId,
    existingTier,
    incomingTier,
    finalTier,
  });

  return updated;
}

async function setFree({ discordId, meta = {} }) {
  if (!/^[0-9]{17,20}$/.test(String(discordId || "").trim())) return null;

  await dbConnect();

  const existing = await PremiumUser.findOne({ discordId }).lean();
  const mergedMeta = {
    ...(existing?.meta || {}),
    ...(meta || {}),
    lastPremiumWriteAt: new Date().toISOString(),
  };

  const updated = await PremiumUser.findOneAndUpdate(
    { discordId },
    {
      $set: {
        tier: "free",
        expiresAt: null,
        meta: mergedMeta,
      },
    },
    { upsert: true, new: true }
  ).lean();

  console.log("[stripe webhook] DB set user to free:", { discordId });
  return updated;
}

export async function POST(req) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers.get("stripe-signature") || "";

    if (!secret) {
      return NextResponse.json({ ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
    }
    if (!sig) {
      return NextResponse.json({ ok: false, error: "Missing stripe-signature header" }, { status: 400 });
    }

    // Stripe requires RAW body for signature verification
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

    // ✅ 1) Checkout completed -> grant + roles immediately
    if (type === "checkout.session.completed") {
      const s = event.data.object;

      const discordId = String(s.client_reference_id || s?.metadata?.discordId || "").trim();
      const level = String(s?.metadata?.woc_level || "").trim();
      const incomingTier = String(s?.metadata?.woc_tier || tierFromLevel(level)).trim().toLowerCase();

      const subscriptionId = s.subscription || null;
      const customerId = s.customer || null;

      console.log("[stripe webhook] discordId resolved as:", discordId);
      console.log("[stripe webhook] level/incomingTier:", { level, incomingTier });
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
        return NextResponse.json({ ok: true, warning: "No discordId on session" });
      }

      const updated = await grantPremium({
        discordId,
        incomingTier,
        meta: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          lastCheckoutSessionId: s.id,
          lastStripeEvent: type,
        },
      });

      // ✅ Apply Discord roles using FINAL tier (upgrade-safe)
      const finalTier = updated?.tier || incomingTier;

      try {
        await applyDiscordPremiumRoles(discordId, finalTier);
        console.log("[stripe webhook] Discord roles synced:", { discordId, finalTier });
      } catch (e) {
        // Never fail Stripe delivery because Discord had a moment.
        console.error("[stripe webhook] Discord role sync failed:", String(e?.message || e));
      }

      return NextResponse.json({ ok: true, tier: finalTier });
    }

    // ✅ 2) Subscription updated/deleted -> revoke if not active
    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const sub = event.data.object;

      await dbConnect();
      const doc = await PremiumUser.findOne({ "meta.stripeSubscriptionId": sub.id }).lean();

      if (!doc?.discordId) {
        console.log("[stripe webhook] no matching user for subscription:", sub.id);
        return NextResponse.json({ ok: true, note: "No matching user for subscription." });
      }

      const status = String(sub.status || "").toLowerCase();
      const isActive = status === "active" || status === "trialing";

      console.log("[stripe webhook] sub status:", { subId: sub.id, status, isActive });

      if (!isActive) {
        await setFree({
          discordId: doc.discordId,
          meta: { ...(doc.meta || {}), lastStripeStatus: status, lastStripeEvent: type },
        });

        try {
          await applyDiscordPremiumRoles(doc.discordId, "free");
          console.log("[stripe webhook] Discord roles revoked:", { discordId: doc.discordId });
        } catch (e) {
          console.error("[stripe webhook] Discord revoke failed:", String(e?.message || e));
        }

        return NextResponse.json({ ok: true });
      }

      // Active: keep their current tier, but resync roles (safe)
      try {
        await applyDiscordPremiumRoles(doc.discordId, doc.tier || "free");
      } catch {}

      await PremiumUser.findOneAndUpdate(
        { discordId: doc.discordId },
        { $set: { meta: { ...(doc.meta || {}), lastStripeStatus: status, lastStripeEvent: type } } }
      );

      return NextResponse.json({ ok: true });
    }

    // ✅ 3) Invoice signals: ACK only (don’t fail delivery)
    if (type === "invoice.payment_succeeded") return NextResponse.json({ ok: true });
    if (type === "invoice.payment_failed") return NextResponse.json({ ok: true });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[stripe webhook] fatal:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
