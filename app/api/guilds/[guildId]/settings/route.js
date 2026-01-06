import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import GuildSettings from "@/app/models/GuildSettings";

export const dynamic = "force-dynamic";

function isSnowflake(x) {
  return typeof x === "string" && /^\d{16,20}$/.test(x);
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
  };
}

// GET = load settings
export async function GET(_req, { params }) {
  const guildId = params?.guildId ? String(params.guildId) : "";
  if (!isSnowflake(guildId)) {
    return NextResponse.json({ ok: false, error: "Missing guildId." }, { status: 400 });
  }

  await dbConnect();

  const doc = await GuildSettings.findOne({ guildId }).lean();
  const settings = doc && doc.guildId ? doc : defaultSettings(guildId);

  return NextResponse.json({ ok: true, settings }, { status: 200 });
}

// PUT = save settings
export async function PUT(req, { params }) {
  const guildId = params?.guildId ? String(params.guildId) : "";
  if (!isSnowflake(guildId)) {
    return NextResponse.json({ ok: false, error: "Missing guildId." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  await dbConnect();

  // Force guildId consistency
  const next = { ...body, guildId };

  const updated = await GuildSettings.findOneAndUpdate(
    { guildId },
    { $set: next },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ ok: true, settings: updated }, { status: 200 });
}
