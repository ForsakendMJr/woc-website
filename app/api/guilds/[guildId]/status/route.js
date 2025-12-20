// app/api/guilds/[guildId]/status/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";
const PERM_ADMIN = 0x8;

// Cache the user's OAuth guild list briefly to avoid Discord 429s
const ME_GUILDS_TTL_MS = 30 * 1000;
const meGuildsCache =
  globalThis.__wocMeGuildsCache || (globalThis.__wocMeGuildsCache = new Map());

function getGuildIdFromPath(req) {
  try {
    const parts = req.nextUrl.pathname.split("/").filter(Boolean);
    // expected: api / guilds / {guildId} / status
    const i = parts.indexOf("guilds");
    const gid = i >= 0 ? parts[i + 1] : "";
    return gid || "";
  } catch {
    return "";
  }
}

function getBotToken() {
  const t =
    process.env.DISCORD_BOT_TOKEN ||
    process.env.DISCORD_TOKEN ||
    process.env.DICSORD_BOT_TOKEN;

  const source = process.env.DISCORD_BOT_TOKEN
    ? "DISCORD_BOT_TOKEN"
    : process.env.DISCORD_TOKEN
      ? "DISCORD_TOKEN"
      : process.env.DICSORD_BOT_TOKEN
        ? "DICSORD_BOT_TOKEN"
        : null;

  return { token: t, source };
}

function safeText(input, max = 220) {
  const s = String(input || "").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function isManageable(g) {
  if (!g) return false;
  const perms = Number(g.permissions || 0);
  return !!g.owner || (perms & PERM_ADMIN) === PERM_ADMIN;
}

async function getMeGuilds(token) {
  const userKey = token?.sub || token?.id || "me";
  const cacheKey = `meGuilds:${userKey}`;
  const now = Date.now();

  const hit = meGuildsCache.get(cacheKey);
  if (hit && hit.exp > now) return { guilds: hit.guilds, warning: hit.warning || "" };

  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    cache: "no-store",
  });

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const retryAfter = Number(body?.retry_after || 1);

    if (hit?.guilds?.length) {
      return {
        guilds: hit.guilds,
        warning: `Discord rate-limited your guild list. Using cached list for now (~${Math.ceil(
          retryAfter
        )}s).`,
      };
    }

    const err = new Error(
      safeText(`Discord rate-limited your guild list. Try again in ~${Math.ceil(retryAfter)}s.`)
    );
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
  meGuildsCache.set(cacheKey, { exp: now + ME_GUILDS_TTL_MS, guilds, warning: "" });
  return { guilds, warning: "" };
}

export async function GET(req, ctx) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token?.accessToken) {
      return NextResponse.json(
        { ok: true, installed: null, warning: "Sign in to check the server gate." },
        { status: 200 }
      );
    }

    // ✅ Fix: allow both ctx.params and parsing from URL
    const guildId = ctx?.params?.guildId || getGuildIdFromPath(req);

    if (!guildId) {
      return NextResponse.json(
        { ok: true, installed: null, warning: "Missing guildId." },
        { status: 200 }
      );
    }

    const { guilds: myGuilds, warning: permWarning } = await getMeGuilds(token);
    const meGuild = (Array.isArray(myGuilds) ? myGuilds : []).find(
      (g) => String(g?.id) === String(guildId)
    );

    if (!meGuild || !isManageable(meGuild)) {
      return NextResponse.json(
        {
          ok: true,
          installed: null,
          warning: "You don’t have Admin in that server (or it’s not in your list).",
        },
        { status: 200 }
      );
    }

    const { token: botToken, source: botTokenSource } = getBotToken();
    if (!botToken) {
      return NextResponse.json(
        {
          ok: true,
          installed: null,
          bot_token_source: botTokenSource,
          warning: "Server bot token missing on server. Set DISCORD_BOT_TOKEN (or DISCORD_TOKEN).",
        },
        { status: 200 }
      );
    }

    const botGuildRes = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${botToken}` },
      cache: "no-store",
    });

    if (botGuildRes.status === 429) {
      const body = await botGuildRes.json().catch(() => ({}));
      const retryAfter = Number(body?.retry_after || 1);

      return NextResponse.json(
        {
          ok: true,
          installed: null,
          bot_token_source: botTokenSource,
          warning:
            `Discord rate-limited the bot check. Try again in ~${Math.ceil(retryAfter)}s.` +
            (permWarning ? ` (${permWarning})` : ""),
          retry_after: retryAfter,
        },
        { status: 200, headers: { "Retry-After": String(Math.ceil(retryAfter)) } }
      );
    }

    if (botGuildRes.status === 403 || botGuildRes.status === 404) {
      return NextResponse.json(
        { ok: true, installed: false, guildId, bot_token_source: botTokenSource, warning: permWarning || "" },
        { status: 200 }
      );
    }

    if (!botGuildRes.ok) {
      const txt = await botGuildRes.text().catch(() => "");
      return NextResponse.json(
        {
          ok: true,
          installed: null,
          bot_token_source: botTokenSource,
          warning: safeText(`Bot check failed: ${botGuildRes.status} ${txt}`),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: true, installed: true, guildId, bot_token_source: botTokenSource, warning: permWarning || "" },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: true,
        installed: null,
        warning: safeText(err?.message || "Gate check unavailable right now."),
        retry_after: err?.retry_after ?? null,
      },
      { status: 200 }
    );
  }
}
