import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import GuildSettings from "../../../../models/GuildSettings";

export const dynamic = "force-dynamic";

/**
 * These keys MUST match your dashboard MODULE_TREE category keys
 * and your bot CATEGORY_TO_MODULE_KEY mapping.
 */
const MODULE_KEYS = [
  "moderation",
  "logging",
  "clan",
  "combat",
  "economy",
  "fun",
  "marriage",
  "housing",
  "quest",
  "utility",
  "application",
];

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
    // ✅ IMPORTANT: default modules ON (subs can be empty; dashboard treats missing subs as true)
    modules: MODULE_KEYS.reduce((acc, k) => {
      acc[k] = { enabled: true, subs: {} };
      return acc;
    }, {}),
    personality: { mood: "story", sass: 35, narration: true },
  };
}

/**
 * Merge defaults without overwriting explicit false values.
 * - If category missing -> add it (enabled true)
 * - If enabled missing -> set true
 * - subs: we do NOT need to pre-fill, dashboard uses ?? true
 */
function mergeModuleDefaults(existingModules) {
  const out = existingModules && typeof existingModules === "object" ? existingModules : {};

  for (const key of MODULE_KEYS) {
    if (!out[key] || typeof out[key] !== "object") out[key] = {};
    if (typeof out[key].enabled !== "boolean") out[key].enabled = true;
    if (!out[key].subs || typeof out[key].subs !== "object") out[key].subs = {};
  }

  return out;
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

    // ✅ DO NOT lean() here, we want to be able to save migrations
    let doc = await GuildSettings.findOne({ guildId });
    if (!doc) {
      doc = await GuildSettings.create(defaultSettings(guildId));
    }

    // ✅ MIGRATION: ensure modules/categories exist + default enabled
    const before = JSON.stringify(doc.modules || {});
    doc.modules = mergeModuleDefaults(doc.modules);
    const after = JSON.stringify(doc.modules || {});

    if (before !== after) {
      await doc.save();
    }

    return NextResponse.json(
      { ok: true, settings: doc.toObject(), guildId, warning: "" },
      { status: 200 }
    );
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

    // ✅ Accept BOTH shapes:
    // 1) dashboard sends the settings object directly
    // 2) some clients send { settings: {...} }
    const incoming =
      body && typeof body === "object" && body.settings && typeof body.settings === "object"
        ? body.settings
        : body;

    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json(
        { ok: true, settings: null, guildId, warning: "Body must be JSON." },
        { status: 200 }
      );
    }

    // enforce correct guild + ensure modules defaults so UI doesn't flip weirdly
    incoming.guildId = guildId;
    incoming.modules = mergeModuleDefaults(incoming.modules);

    await dbConnect();

    const updated = await GuildSettings.findOneAndUpdate(
      { guildId },
      { $set: incoming },
      { new: true, upsert: true }
    );

    return NextResponse.json(
      { ok: true, settings: updated?.toObject?.() ?? updated, guildId, warning: "" },
      { status: 200 }
    );
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
