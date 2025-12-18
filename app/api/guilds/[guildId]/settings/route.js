// app/api/guilds/[guildId]/settings/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import dbConnect from "@/app/lib/mongodb";
import GuildSettings from "@/app/models/GuildSettings";

const DISCORD_API = "https://discord.com/api/v10";
const PERM_ADMIN = 0x8;

function isManageable(g) {
  const perms = Number(g?.permissions || 0);
  return !!g?.owner || (perms & PERM_ADMIN) === PERM_ADMIN;
}

async function ensureCanManage(req, guildId) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.accessToken) return { ok: false, status: 401, error: "Not authenticated" };

  const meGuildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    cache: "no-store",
  });

  if (!meGuildsRes.ok) {
    const txt = await meGuildsRes.text().catch(() => "");
    return { ok: false, status: 500, error: `Failed to read your guilds: ${meGuildsRes.status} ${txt}` };
  }

  const meGuilds = await meGuildsRes.json();
  const target = (Array.isArray(meGuilds) ? meGuilds : []).find((g) => String(g.id) === String(guildId));

  if (!isManageable(target)) {
    return { ok: false, status: 403, error: "You don't have permission to manage this server." };
  }

  return { ok: true, token };
}

function defaults(guildId) {
  return {
    guildId,
    prefix: "!",
    moderation: { enabled: true, automod: false, antiLink: false, antiSpam: true },
    logs: {
      enabled: true,
      generalChannelId: "",
      modlogChannelId: "",
      joinChannelId: "",
      leaveChannelId: "",
      messageChannelId: "",
      roleChannelId: "",
      nicknameChannelId: "",
      commandChannelId: "",
      editChannelId: "",
    },
    welcome: {
      enabled: false,
      channelId: "",
      message: "Welcome {user} to **{server}**! ✨",
      autoRoleId: "",
    },
    modules: {},
    personality: { mood: "story", sass: 35, narration: true },
  };
}

export async function GET(req, { params }) {
  const guildId = params.guildId;
  const guard = await ensureCanManage(req, guildId);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  await dbConnect();
  const doc = await GuildSettings.findOne({ guildId }).lean();

  return NextResponse.json({ ok: true, settings: doc || defaults(guildId) });
}

export async function PUT(req, { params }) {
  const guildId = params.guildId;
  const guard = await ensureCanManage(req, guildId);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const base = defaults(guildId);

  const next = {
    guildId,
    prefix: String(body?.prefix ?? base.prefix).slice(0, 4),

    moderation: {
      enabled: !!body?.moderation?.enabled,
      automod: !!body?.moderation?.automod,
      antiLink: !!body?.moderation?.antiLink,
      antiSpam: !!body?.moderation?.antiSpam,
    },

    logs: {
      enabled: !!body?.logs?.enabled,
      generalChannelId: String(body?.logs?.generalChannelId ?? ""),
      modlogChannelId: String(body?.logs?.modlogChannelId ?? ""),
      joinChannelId: String(body?.logs?.joinChannelId ?? ""),
      leaveChannelId: String(body?.logs?.leaveChannelId ?? ""),
      messageChannelId: String(body?.logs?.messageChannelId ?? ""),
      roleChannelId: String(body?.logs?.roleChannelId ?? ""),
      nicknameChannelId: String(body?.logs?.nicknameChannelId ?? ""),
      commandChannelId: String(body?.logs?.commandChannelId ?? ""),
      editChannelId: String(body?.logs?.editChannelId ?? ""),
    },

    welcome: {
      enabled: !!body?.welcome?.enabled,
      channelId: String(body?.welcome?.channelId ?? ""),
      message: String(body?.welcome?.message ?? base.welcome.message).slice(0, 2000),
      autoRoleId: String(body?.welcome?.autoRoleId ?? ""),
    },

    // Keep flexible (you’ll expand this freely)
    modules: typeof body?.modules === "object" && body?.modules ? body.modules : {},

    personality: {
      mood: String(body?.personality?.mood || "story"),
      sass: Math.max(0, Math.min(100, Number(body?.personality?.sass ?? 35))),
      narration: !!body?.personality?.narration,
    },
  };

  await dbConnect();
  const saved = await GuildSettings.findOneAndUpdate(
    { guildId },
    { $set: next },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ ok: true, settings: saved });
}
