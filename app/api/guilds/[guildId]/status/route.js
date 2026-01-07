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

// Handles:
// - params.guildId as string (normal [guildId])
// - params.guildId as array (catch-all [...guildId])
function normalizeParamGuildId(params) {
  const v = params?.guildId;
  if (Array.isArray(v)) return v[0] ? String(v[0]).trim() : "";
  return v ? String(v).trim() : "";
}

function pickGuildId(req, params) {
  const fromParam = normalizeParamGuildId(params);

  let fromQuery = "";
  try {
    const url = new URL(req.url);
    fromQuery = (url.searchParams.get("guildId") || "").trim();
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

  // Always 200 JSON so your dashboard never sees HTML/redirect here
  if (!guildId) {
    return NextResponse.json(
      {
        ok: true,
        installed: null,
        guildId: "",
        bot_token_source: null,
        warning: "Missing/invalid guildId.",
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

  try {
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
