// app/api/premium/sync-roles/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// IMPORTANT: adjust this import if your authOptions export path differs
import { authOptions } from "../../auth/[...nextauth]/_authOptions";

import dbConnect from "../../../../lib/mongodb";
import PremiumUser from "../../../models/PremiumUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ Hub + roles
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

function pickDiscordId(session) {
  const u = session?.user || {};
  const candidates = [u.discordId, u.id, u.sub, session?.sub].filter(Boolean);
  const id = String(candidates[0] || "").trim();
  return isSnowflake(id) ? id : "";
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

async function applyDiscordPremiumRoles(discordId, tier) {
  const tierRole = roleForTier(tier);

  if (tierRole) {
    await discordAddRole(discordId, ROLE_DONATOR);
    await discordAddRole(discordId, tierRole);

    for (const r of PREMIUM_ROLES) {
      if (r !== tierRole) {
        try {
          await discordRemoveRole(discordId, r);
        } catch {}
      }
    }
    return;
  }

  for (const r of ALL_DONOR_ROLES) {
    try {
      await discordRemoveRole(discordId, r);
    } catch {}
  }
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

    await dbConnect();
    const doc = await PremiumUser.findOne({ discordId }).lean();
    const tier = String(doc?.tier || "free").trim();

    await applyDiscordPremiumRoles(discordId, tier);

    return NextResponse.json({ ok: true, discordId, tier });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
