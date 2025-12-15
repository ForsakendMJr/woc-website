import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const DISCORD_API = "https://discord.com/api/v10";
const PERM_ADMIN = 0x8;

function isManageable(g) {
  if (!g) return false;
  const perms = Number(g.permissions || 0);
  return !!g.owner || (perms & PERM_ADMIN) === PERM_ADMIN;
}

export async function GET(req, { params }) {
  const token = await getToken({ req });
  if (!token?.accessToken) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const guildId = params.guildId;
  if (!guildId) {
    return NextResponse.json(
      { ok: false, error: "Missing guildId" },
      { status: 400 }
    );
  }

  // Ensure the user actually manages this guild (from OAuth guild list)
  const meGuildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    cache: "no-store",
  });

  if (!meGuildsRes.ok) {
    const txt = await meGuildsRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: `Failed to read your guilds: ${meGuildsRes.status} ${txt}` },
      { status: 500 }
    );
  }

  const meGuilds = await meGuildsRes.json();
  const target = (Array.isArray(meGuilds) ? meGuilds : []).find((g) => String(g.id) === String(guildId));

  if (!isManageable(target)) {
    return NextResponse.json(
      { ok: false, error: "You don't have permission to manage this server." },
      { status: 403 }
    );
  }

  // Bot presence check (real invite gate)
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { ok: false, error: "Missing DISCORD_BOT_TOKEN on server" },
      { status: 500 }
    );
  }

  const botGuildRes = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: "no-store",
  });

  if (botGuildRes.status === 403 || botGuildRes.status === 404) {
    return NextResponse.json({
      ok: true,
      installed: false,
      guildId,
      guildName: target?.name || null,
      reason: "Bot not in guild (or no access).",
    });
  }

  if (!botGuildRes.ok) {
    const txt = await botGuildRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: `Bot guild check failed: ${botGuildRes.status} ${txt}` },
      { status: 500 }
    );
  }

  const g = await botGuildRes.json();
  return NextResponse.json({
    ok: true,
    installed: true,
    guildId,
    guildName: g?.name || target?.name || null,
  });
}
