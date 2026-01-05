// app/api/guilds/[guildId]/settings/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import GuildSettings from "@/app/models/GuildSettings";

export const dynamic = "force-dynamic";
const DISCORD_API = "https://discord.com/api/v10";

/* -------------------- helpers -------------------- */

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

async function botInGuildOrFail(guildId) {
  const { token: botToken, source: botTokenSource } = getBotToken();

  if (!botToken) {
    return {
      ok: false,
      installed: null,
      bot_token_source: botTokenSource,
      error: "Missing bot token. Set DISCORD_BOT_TOKEN (or DISCORD_TOKEN).",
    };
  }

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: "no-store",
  });

  if (res.status === 403 || res.status === 404) {
    return { ok: true, installed: false, guildId, bot_token_source: botTokenSource };
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return {
      ok: false,
      installed: null,
      bot_token_source: botTokenSource,
      error: `Bot guild check failed (${res.status}). ${txt}`,
    };
  }

  return { ok: true, installed: true, guildId, bot_token_source: botTokenSource };
}

function defaultSettings(guildId) {
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
    tickets: {},
  };
}

/* -------------------- GET -------------------- */

export async function GET(req, { params }) {
  const guildId = params?.guildId;
  if (!guildId) {
    return NextResponse.json({ ok: false, error: "Missing guildId." }, { status: 400 });
  }

  const gate = await botInGuildOrFail(guildId);
  if (!gate.ok) return NextResponse.json(gate, { status: 200 });

  await dbConnect();

  if (gate.installed === false) {
    return NextResponse.json(
      { ...gate, settings: defaultSettings(guildId) },
      { status: 200 }
    );
  }

  let doc = await GuildSettings.findOne({ guildId }).lean();

  if (!doc) {
    doc = defaultSettings(guildId);
  }

  return NextResponse.json(
    {
      ...gate,
      settings: doc,
    },
    { status: 200 }
  );
}

/* -------------------- PUT -------------------- */

export async function PUT(req, { params }) {
  const guildId = params?.guildId;
  if (!guildId) {
    return NextResponse.json({ ok: false, error: "Missing guildId." }, { status: 400 });
  }

  const gate = await botInGuildOrFail(guildId);
  if (!gate.ok) return NextResponse.json(gate, { status: 200 });

  if (gate.installed === false) {
    return NextResponse.json(
      { ...gate, error: "Bot not installed in this server. Invite WoC to enable saving." },
      { status: 200 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  await dbConnect();

  const updated = await GuildSettings.findOneAndUpdate(
    { guildId },
    {
      $set: {
        guildId,
        ...body, // ✅ flatten directly into schema
      },
    },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json(
    {
      ...gate,
      settings: updated,
    },
    { status: 200 }
  );
}
