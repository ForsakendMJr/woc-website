import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";

export async function GET(req, { params }) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { ok: false, installed: null, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const guildId = params?.guildId;
    if (!guildId) {
      return NextResponse.json(
        { ok: false, installed: null, error: "Missing guildId." },
        { status: 400 }
      );
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { ok: false, installed: null, error: "Missing DISCORD_BOT_TOKEN on server." },
        { status: 500 }
      );
    }

    const botGuildRes = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${botToken}` },
      cache: "no-store",
    });

    // Handle rate limit nicely so your UI can show "try again"
    if (botGuildRes.status === 429) {
      const body = await botGuildRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          ok: false,
          installed: null,
          error: `Discord rate limited (429). retry_after: ${body?.retry_after ?? "?"}`,
          retry_after: body?.retry_after ?? null,
        },
        { status: 429 }
      );
    }

    // Bot not in guild (or no access)
    if (botGuildRes.status === 403 || botGuildRes.status === 404) {
      return NextResponse.json({ ok: true, installed: false, guildId }, { status: 200 });
    }

    if (!botGuildRes.ok) {
      const txt = await botGuildRes.text().catch(() => "");
      return NextResponse.json(
        { ok: false, installed: null, error: `Bot guild check failed: ${botGuildRes.status} ${txt}`.trim() },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, installed: true, guildId }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, installed: null, error: err?.message || "Unknown error." },
      { status: 500 }
    );
  }
}
