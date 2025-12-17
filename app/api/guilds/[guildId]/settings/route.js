// app/api/guilds/[guildId]/settings/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import dbConnect from "@/app/lib/mongodb";
import GuildSettings from "@/app/models/GuildSettings";

export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";
const PERM_ADMIN = 0x8;

// Cache user guild list briefly to avoid Discord 429s
const ME_GUILDS_TTL_MS = 30 * 1000;
const meGuildsCache =
  globalThis.__wocMeGuildsCache || (globalThis.__wocMeGuildsCache = new Map());
// key -> { exp:number, guilds:Array }

function safeText(input, max = 220) {
  const s = String(input || "").trim();
  if (!s) return "";
  const looksLikeHtml =
    s.includes("<!DOCTYPE") || s.includes("<html") || s.includes("<body") || s.includes("<head");
  if (looksLikeHtml) return "Non-JSON/HTML response received.";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function isManageable(g) {
  const perms = Number(g?.permissions || 0);
  return !!g?.owner || (perms & PERM_ADMIN) === PERM_ADMIN;
}

function defaultSettings(guildId) {
  return {
    guildId,
    prefix: "!",
    moderation: { enabled: true, automod: false, antiLink: false, antiSpam: true },
    logs: { enabled: true, generalChannelId: "", modlogChannelId: "" },
    personality: { mood: "story", sass: 35, narration: true },
  };
}

async function getMeGuilds(token) {
  const userKey = token?.sub || token?.id || "me";
  const cacheKey = `meGuilds:${userKey}`;
  const now = Date.now();

  const hit = meGuildsCache.get(cacheKey);
  if (hit && hit.exp > now) return { guilds: hit.guilds, stale: false };

  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    cache: "no-store",
  });

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const retryAfter = Number(body?.retry_after || 1);

    if (hit?.guilds?.length) {
      return { guilds: hit.guilds, stale: true, retryAfter };
    }

    const err = new Error(`Discord rate-limited permission check. Retry in ~${Math.ceil(retryAfter)}s.`);
    err.status = 503;
    err.retry_after = retryAfter;
    throw err;
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(safeText(`Failed to read your guilds: ${res.status} ${txt}`));
    err.status = 503;
    throw err;
  }

  const guilds = await res.json().catch(() => []);
  meGuildsCache.set(cacheKey, { exp: now + ME_GUILDS_TTL_MS, guilds });
  return { guilds, stale: false };
}

async function ensureCanManage(req, guildId) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.accessToken) return { ok: false, status: 401, error: "Not authenticated." };

  const { guilds, stale, retryAfter } = await getMeGuilds(token);
  const target = (Array.isArray(guilds) ? guilds : []).find((g) => String(g.id) === String(guildId));

  if (!isManageable(target)) {
    return { ok: false, status: 403, error: "You don't have permission to manage this server." };
  }

  return {
    ok: true,
    token,
    warning: stale
      ? `Discord rate-limited recently. Using cached permissions (retry in ~${Math.ceil(retryAfter || 1)}s).`
      : "",
  };
}

export async function GET(req, { params }) {
  try {
    const guildId = params?.guildId;
    if (!guildId) return NextResponse.json({ ok: false, error: "Missing guildId." }, { status: 400 });

    const guard = await ensureCanManage(req, guildId);
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

    await dbConnect();
    const doc = await GuildSettings.findOne({ guildId }).lean();

    return NextResponse.json({
      ok: true,
      settings: doc || defaultSettings(guildId),
      warning: guard.warning || "",
    });
  } catch (err) {
    // This should throw into your dashboard fallback defaults, without exposing junk HTML
    return NextResponse.json(
      { ok: false, error: safeText(err?.message || "Failed to load settings."), retry_after: err?.retry_after ?? null },
      { status: err?.status || 503 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    const guildId = params?.guildId;
    if (!guildId) return NextResponse.json({ ok: false, error: "Missing guildId." }, { status: 400 });

    const guard = await ensureCanManage(req, guildId);
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

    const body = await req.json().catch(() => ({}));

    const next = {
      guildId,
      prefix: String(body?.prefix || "!").slice(0, 4),
      moderation: {
        enabled: !!body?.moderation?.enabled,
        automod: !!body?.moderation?.automod,
        antiLink: !!body?.moderation?.antiLink,
        antiSpam: !!body?.moderation?.antiSpam,
      },
      logs: {
        enabled: !!body?.logs?.enabled,
        generalChannelId: String(body?.logs?.generalChannelId || ""),
        modlogChannelId: String(body?.logs?.modlogChannelId || ""),
      },
      personality: {
        mood: String(body?.personality?.mood || "story"),
        sass: Math.max(0, Math.min(100, Number(body?.personality?.sass ?? 35))),
        narration: !!body?.personality?.narration,
      },
    };

    await dbConnect();
    const saved = await GuildSettings.findOneAndUpdate(
      { guildId },
      { $set: next },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({ ok: true, settings: saved, warning: guard.warning || "" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: safeText(err?.message || "Save failed."), retry_after: err?.retry_after ?? null },
      { status: err?.status || 503 }
    );
  }
}
