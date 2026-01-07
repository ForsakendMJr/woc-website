import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import GuildSettings from "@/app/models/GuildSettings";

export const dynamic = "force-dynamic";

function isSnowflake(x) {
  const s = String(x || "").trim();
  return /^\d{17,20}$/.test(s);
}

function extractGuildId(req, params) {
  // 1) Normal Next App Router param
  const p = params?.guildId ? String(params.guildId).trim() : "";
  if (isSnowflake(p)) return p;

  // 2) Query param fallback (if you ever hit it like ?guildId=)
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("guildId") || "").trim();
    if (isSnowflake(q)) return q;

    // 3) Path parsing fallback: /api/guilds/<ID>/settings
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("guilds");
    const fromPath = i !== -1 ? (parts[i + 1] || "").trim() : "";
    if (isSnowflake(fromPath)) return fromPath;
  } catch {}

  return "";
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

export async function GET(req, ctx) {
  const guildId = extractGuildId(req, ctx?.params);

  // IMPORTANT: return 200 with ok:true + warning (matches your status/channels style)
  if (!isSnowflake(guildId)) {
    return NextResponse.json(
      { ok: true, settings: null, guildId: "", warning: "Missing/invalid guildId." },
      { status: 200 }
    );
  }

  try {
    await dbConnect();

    let doc = await GuildSettings.findOne({ guildId }).lean();
    if (!doc) {
      const created = await GuildSettings.create(defaultSettings(guildId));
      doc = created.toObject();
    }

    return NextResponse.json({ ok: true, settings: doc, guildId, warning: "" }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: true,
        settings: defaultSettings(guildId),
        guildId,
        warning: String(e?.message || "Failed to load settings."),
      },
      { status: 200 }
    );
  }
}

export async function PUT(req, ctx) {
  const guildId = extractGuildId(req, ctx?.params);

  if (!isSnowflake(guildId)) {
    return NextResponse.json(
      { ok: true, settings: null, guildId: "", warning: "Missing/invalid guildId." },
      { status: 200 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const incoming = body?.settings;

    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json(
        { ok: true, settings: null, guildId, warning: "Body must be JSON: { settings: { ... } }" },
        { status: 200 }
      );
    }

    incoming.guildId = guildId; // enforce correct guild

    await dbConnect();

    const updated = await GuildSettings.findOneAndUpdate(
      { guildId },
      { $set: incoming },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({ ok: true, settings: updated, guildId, warning: "" }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: true,
        settings: null,
        guildId,
        warning: String(e?.message || "Failed to save settings."),
      },
      { status: 200 }
    );
  }
}
