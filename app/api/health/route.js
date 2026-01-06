import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const DISCORD_API = "https://discord.com/api/v10";

function getBotToken() {
  return (
    process.env.DISCORD_BOT_TOKEN ||
    process.env.DISCORD_TOKEN ||
    process.env.DICSORD_BOT_TOKEN ||
    ""
  );
}

export async function GET() {
  const token = getBotToken();
  if (!token) return NextResponse.json({ ok: false, error: "No bot token found." }, { status: 200 });

  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `Discord error ${res.status}`, data }, { status: 200 });
  }

  return NextResponse.json(
    { ok: true, bot: { id: data.id, username: data.username, discriminator: data.discriminator } },
    { status: 200 }
  );
}
