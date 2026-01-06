import { NextResponse } from "next/server";

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

export async function GET(req, { params }) {
  const guildId = params?.guildId;

  const { token, source } = getBotToken();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Missing bot token env", bot_token_source: source },
      { status: 200 }
    );
  }

  // 1) prove token works
  const meRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });

  const meText = await meRes.text().catch(() => "");
  let meJson = null;
  try { meJson = JSON.parse(meText); } catch {}

  // 2) check guild membership
  const gRes = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });

  const gText = await gRes.text().catch(() => "");
  let gJson = null;
  try { gJson = JSON.parse(gText); } catch {}

  return NextResponse.json(
    {
      ok: true,
      bot_token_source: source,
      guildId,
      botCheck: {
        status: meRes.status,
        ok: meRes.ok,
        bot: meJson?.id ? { id: meJson.id, username: meJson.username } : null,
        bodyPreview: meRes.ok ? null : String(meText).slice(0, 200),
      },
      guildCheck: {
        status: gRes.status,
        ok: gRes.ok,
        bodyPreview: gRes.ok ? null : String(gText).slice(0, 200),
      },
      botInGuild: gRes.ok,
    },
    { status: 200 }
  );
}
