// app/api/guilds/[guildId]/settings/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";
const DISCORD_API = "https://discord.com/api/v10";

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

export async function GET(req, { params }) {
  try {
    await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); // keep auth hook if you want it

    const guildId = params?.guildId;
    if (!guildId) {
      return NextResponse.json({ ok: false, error: "Missing guildId." }, { status: 400 });
    }

    const { token: botToken, source: botTokenSource } = getBotToken();
    if (!botToken) {
      return NextResponse.json(
        { ok: false, bot_token_source: botTokenSource, error: "Missing bot token. Set DISCORD_BOT_TOKEN (or DISCORD_TOKEN)." },
        { status: 500 }
      );
    }

    // ✅ Same reliable check: bot guild list
    const botGuildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${botToken}` },
      cache: "no-store",
    });

    if (botGuildsRes.status === 429) {
      const body = await botGuildsRes.json().catch(() => ({}));
      const retryAfter = Number(body?.retry_after || 1);
      return NextResponse.json(
        {
          ok: true,
          installed: null,
          bot_token_source: botTokenSource,
          warning: `Discord rate-limited the bot guild list. Retry in ~${Math.ceil(retryAfter)}s.`,
          retry_after: retryAfter,
        },
        { status: 200, headers: { "Retry-After": String(Math.ceil(retryAfter)) } }
      );
    }

    if (!botGuildsRes.ok) {
      const txt = await botGuildsRes.text().catch(() => "");
      return NextResponse.json(
        { ok: false, bot_token_source: botTokenSource, error: safeText(`Bot guild list failed (${botGuildsRes.status}). ${txt}`) },
        { status: 500 }
      );
    }

    const botGuilds = await botGuildsRes.json().catch(() => []);
    const installed =
      Array.isArray(botGuilds) && botGuilds.some((g) => String(g?.id) === String(guildId));

    // Keep your DB logic later. For now return defaults.
    return NextResponse.json(
      { ok: true, installed, guildId, bot_token_source: botTokenSource, settings: {} },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
