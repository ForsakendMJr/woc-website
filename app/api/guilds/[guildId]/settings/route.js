// app/api/guilds/[guildId]/status/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";
const DISCORD_API = "https://discord.com/api/v10";

function getGuildIdFromPath(req) {
  try {
    // /api/guilds/<guildId>/status
    const parts = req.nextUrl.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("guilds");
    const gid = i >= 0 ? parts[i + 1] : "";
    return gid || "";
  } catch {
    return "";
  }
}

export async function GET(req, ctx) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ ok: false, installed: null, warning: "Not authenticated." }, { status: 200 });
    }

    // Prefer params, but fall back to path parsing (prevents “Missing guildId” when ctx is weird)
    const guildId = ctx?.params?.guildId || getGuildIdFromPath(req);
    if (!guildId || guildId === "undefined" || guildId === "null") {
      return NextResponse.json(
        { ok: true, installed: null, warning: "No server selected yet." },
        { status: 200 }
      );
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { ok: true, installed: null, warning: "Missing DISCORD_BOT_TOKEN on server." },
        { status: 200 }
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
          warning: `Discord rate-limited the bot guild check. Retry in ~${Math.ceil(retryAfter)}s.`,
          retry_after: retryAfter,
        },
        { status: 200, headers: { "Retry-After": String(Math.ceil(retryAfter)) } }
      );
    }

    if (botGuildRes.status === 403 || botGuildRes.status === 404) {
      return NextResponse.json({ ok: true, installed: false, guildId }, { status: 200 });
    }

    if (!botGuildRes.ok) {
      const txt = await botGuildRes.text().catch(() => "");
      return NextResponse.json(
        { ok: true, installed: null, warning: `Bot guild check failed: ${botGuildRes.status} ${txt}`.trim() },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, installed: true, guildId }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: true, installed: null, warning: err?.message || "Unknown error." }, { status: 200 });
  }
}
