// app/api/guilds/[guildId]/status/route.js
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const DISCORD_API = "https://discord.com/api/v10";

function getBotToken() {
  const token =
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

  return { token, source };
}

function isSnowflake(x) {
  const s = String(x || "").trim();
  return /^\d{16,20}$/.test(s);
}

function pickGuildId(req, params) {
  // 1) /api/guilds/[guildId]/status
  const fromParam = params?.guildId ? String(params.guildId) : "";

  // 2) /api/guilds/status?guildId=...
  let fromQuery = "";
  try {
    const url = new URL(req.url);
    fromQuery = url.searchParams.get("guildId") || "";
  } catch {}

  const gid = (fromParam || fromQuery || "").trim();
  return isSnowflake(gid) ? gid : "";
}

function safeText(input, max = 500) {
  const s = String(input || "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export async function GET(req, { params }) {
  const guildId = pickGuildId(req, params);

  // Always 200: dashboard fetchJson won’t throw
  if (!guildId) {
    return NextResponse.json(
      { ok: true, installed: null, guildId: "", bot_token_source: null, warning: "Missing/invalid guildId." },
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

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${botToken}` },
      cache: "no-store",
    });

    // 403/404 means the bot can’t see the guild (not in server, or no access)
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
          warning: safeText(`Bot guild check failed (${res.status}). ${txt}`),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: true, installed: true, guildId, bot_token_source: source, warning: "" },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: true,
        installed: null,
        guildId,
        bot_token_source: source,
        warning: safeText(err?.message || "Unknown error during bot guild check."),
      },
      { status: 200 }
    );
  }
}
