import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const DISCORD_API = "https://discord.com/api/v10";

function getBotToken() {
  const token =
    process.env.DISCORD_BOT_TOKEN ||
    process.env.DISCORD_TOKEN ||
    process.env.DICSORD_BOT_TOKEN; // keep your typo fallback

  const source = process.env.DISCORD_BOT_TOKEN
    ? "DISCORD_BOT_TOKEN"
    : process.env.DISCORD_TOKEN
    ? "DISCORD_TOKEN"
    : process.env.DICSORD_BOT_TOKEN
    ? "DICSORD_BOT_TOKEN"
    : null;

  return { token, source };
}

function isSnowflake(x) {
  return typeof x === "string" && /^\d{16,20}$/.test(x);
}

/**
 * Robustly find guildId from:
 * - params.guildId (normal)
 * - query ?guildId=...
 * - path /api/guilds/:guildId/status (parsing fallback)
 */
function extractGuildId(req, params) {
  // 1) params
  const p = params?.guildId ? String(params.guildId) : "";
  if (isSnowflake(p)) return p;

  // 2) query param
  const q = req?.nextUrl?.searchParams?.get("guildId");
  if (isSnowflake(q || "")) return String(q);

  // 3) parse pathname
  const pathname = String(req?.nextUrl?.pathname || "");
  // expected: /api/guilds/<id>/status
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((s) => s === "guilds");
  if (idx !== -1) {
    const maybe = parts[idx + 1] ? String(parts[idx + 1]) : "";
    if (isSnowflake(maybe)) return maybe;
  }

  return "";
}

export async function GET(req, { params } = {}) {
  const guildId = extractGuildId(req, params);

  if (!isSnowflake(guildId)) {
    return NextResponse.json(
      {
        ok: true,
        installed: null,
        guildId: "",
        bot_token_source: null,
        warning: "Missing/invalid guildId.",
        debug: {
          pathname: req?.nextUrl?.pathname || null,
          params: params || null,
          query_guildId: req?.nextUrl?.searchParams?.get("guildId") || null,
        },
      },
      { status: 200 }
    );
  }

  const { token: botToken, source } = getBotToken();

  if (!botToken) {
    return NextResponse.json(
      {
        ok: true,
        installed: null,
        guildId,
        bot_token_source: source,
        warning: "Server bot token missing. Set DISCORD_BOT_TOKEN (or DISCORD_TOKEN).",
      },
      { status: 200 }
    );
  }

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: "no-store",
  });

  if (res.status === 403 || res.status === 404) {
    return NextResponse.json(
      { ok: true, installed: false, guildId, bot_token_source: source, warning: "" },
      { status: 200 }
    );
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return NextResponse.json(
      {
        ok: true,
        installed: null,
        guildId,
        bot_token_source: source,
        warning: `Bot guild check failed (${res.status}). ${txt}`.slice(0, 500),
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { ok: true, installed: true, guildId, bot_token_source: source, warning: "" },
    { status: 200 }
  );
}
