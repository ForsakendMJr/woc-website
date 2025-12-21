// app/api/guilds/[guildId]/channels/route.js
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";

function getBotToken() {
  return process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || null;
}

export async function GET(req, { params }) {
  try {
    const guildId = params?.guildId;
    if (!guildId) {
      return NextResponse.json({ ok: false, error: "Missing guildId." }, { status: 400 });
    }

    const botToken = getBotToken();
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "Missing bot token." }, { status: 500 });
    }

    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${botToken}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.message || `Failed to fetch channels (${res.status}).` },
        { status: 200 }
      );
    }

    // Keep it simple: Text channels (0) + Announcement channels (5)
    const allowed = new Set([0, 5]);

    const channels = (Array.isArray(data) ? data : [])
      .filter((c) => allowed.has(c.type))
      .map((c) => ({
        id: String(c.id),
        name: c.name,
        type: c.type,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ ok: true, channels }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 200 }
    );
  }
}
