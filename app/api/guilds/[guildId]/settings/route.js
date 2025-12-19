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

function getGuildIdFromPath(req) {
  try {
    const parts = req.nextUrl.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("guilds");
    const gid = i >= 0 ? parts[i + 1] : "";
    return gid || "";
  } catch {
    return "";
  }
}

export async function GET(req, { params }) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const guildId = params?.guildId || getGuildIdFromPath(req);

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
          warning: `Discord rate-limited the bot guild check. Retry in ~${Math.ceil(retryAfter)}s.`,
          retry_after: retryAfter,
        },
        { status: 200, headers: { "Retry-After": String(Math.ceil(retryAfter)) } }
      );
    }

    if (botGuildRes.status === 403 || botGuildRes.status === 404) {
      return NextResponse.json({ ok: true, installed: false, guildId, bot_token_source: botTokenSource }, { status: 200 });
    }

    if (!botGuildRes.ok) {
      const txt = await botGuildRes.text().catch(() => "");
      return NextResponse.json(
        { ok: false, bot_token_source: botTokenSource, error: `Bot guild check failed (${botGuildRes.status}). ${txt}` },
        { status: 500 }
      );
    }

    // Your existing settings storage logic can stay as-is below.
    // If your file already has DB read/write code after this point, keep it.
    return NextResponse.json({ ok: true, installed: true, guildId, bot_token_source: botTokenSource, settings: {} }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
