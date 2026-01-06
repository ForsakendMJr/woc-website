import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const { guildId } = params;

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "DISCORD_BOT_TOKEN missing" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/users/@me/guilds`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Discord API error" },
        { status: 500 }
      );
    }

    const guilds = await res.json();
    const botInGuild = guilds.some(g => g.id === guildId);

    return NextResponse.json({
      ok: true,
      guildId,
      botInGuild,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
