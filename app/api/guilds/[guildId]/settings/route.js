import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import GuildSettings from "@/app/models/GuildSettings";

export const dynamic = "force-dynamic";

function isSnowflake(x) {
  return typeof x === "string" && /^\d{17,20}$/.test(x);
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

async function getOrCreate(guildId) {
  await dbConnect();
  let doc = await GuildSettings.findOne({ guildId }).lean();
  if (!doc) {
    const created = await GuildSettings.create(defaultSettings(guildId));
    doc = created.toObject();
  }
  return doc;
}

export async function GET(_req, { params }) {
  const guildId = params?.guildId ? String(params.guildId) : "";
  if (!isSnowflake(guildId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid guildId." }, { status: 400 });
  }

  try {
    const settings = await getOrCreate(guildId);
    return NextResponse.json({ ok: true, settings }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || "Failed to load settings.") },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  const guildId = params?.guildId ? String(params.guildId) : "";
  if (!isSnowflake(guildId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid guildId." }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const incoming = body?.settings;

    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json(
        { ok: false, error: "Body must be JSON: { settings: { ... } }" },
        { status: 400 }
      );
    }

    // Force correct guildId and prevent accidental cross-guild writes
    incoming.guildId = guildId;

    await dbConnect();

    const updated = await GuildSettings.findOneAndUpdate(
      { guildId },
      { $set: incoming },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({ ok: true, settings: updated }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || "Failed to save settings.") },
      { status: 500 }
    );
  }
}
