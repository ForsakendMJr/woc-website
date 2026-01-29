// app/api/premium/sync-roles/route.js
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import PremiumUser from "../../../models/PremiumUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ Your WoC hub + roles
const HUB_GUILD_ID = "902705980993859634";

const ROLE_DONATOR = "1464497886669705226";
const ROLE_L1 = "1466232621112496148";
const ROLE_L2 = "1466232628741935228";
const ROLE_L3 = "1466232629819867248";

const PREMIUM_ROLES = [ROLE_L1, ROLE_L2, ROLE_L3];
const ALL_DONOR_ROLES = [ROLE_DONATOR, ...PREMIUM_ROLES];

function isSnowflake(id) {
  return /^[0-9]{17,20}$/.test(String(id || "").trim());
}

function authed(req) {
  const token = process.env.PREMIUM_ADMIN_TOKEN || "";
  const got = req.headers.get("x-premium-admin-token") || "";
  return token && got && got === token;
}

function normalizeTier(tierRaw) {
  const t = String(tierRaw || "free").toLowerCase().trim();
  if (t === "supporter") return "supporter";
  if (t === "supporter_plus") return "supporter_plus";
  if (t === "supporter_plus_plus") return "supporter_plus_plus";
  return "free";
}

function roleForTier(tierRaw) {
  const t = normalizeTier(tierRaw);
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
    throw new Error(`Discord remove role failed (${res.status}): ${txt}`);
  }
}

async function applyDiscordPremiumRoles(discordId, tierRaw) {
  const tier = normalizeTier(tierRaw);
  const tierRole = roleForTier(tier);

  // Free: remove all donor roles
  if (!tierRole) {
    for (const r of ALL_DONOR_ROLES) {
      try {
        await discordRemoveRole(discordId, r);
      } catch (e) {}
    }
    return { applied: "free", added: [], removed: ALL_DONOR_ROLES };
  }

  // Not free: ensure Donator + tier role
  await discordAddRole(discordId, ROLE_DONATOR);
  await discordAddRole(discordId, tierRole);

  // Remove other tier roles
  for (const r of PREMIUM_ROLES) {
    if (r !== tierRole) {
      try {
        await discordRemoveRole(discordId, r);
      } catch (e) {}
    }
  }

  return {
    applied: tier,
    added: [ROLE_DONATOR, tierRole],
    removed: PREMIUM_ROLES.filter((r) => r !== tierRole),
  };
}

// ✅ POST { discordId: "..." } -> sync roles from DB
export async function POST(req) {
  try {
    if (!authed(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const discordId = String(body.discordId || "").trim();

    if (!isSnowflake(discordId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid discordId (snowflake required)." },
        { status: 400 }
      );
    }

    await dbConnect();

    const doc = await PremiumUser.findOne({ discordId }).lean();
    const tier = normalizeTier(doc?.tier);

    console.log("[sync-roles] requested:", { discordId, dbTier: tier });

    const result = await applyDiscordPremiumRoles(discordId, tier);

    return NextResponse.json(
      { ok: true, discordId, tier, discord: result, foundInDb: !!doc },
      { status: 200 }
    );
  } catch (e) {
    console.error("[sync-roles] error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
