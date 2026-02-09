// app/api/guilds/[guildId]/settings/route.js
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import GuildSettings from "../../../../models/GuildSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const p = params?.guildId ? String(params.guildId).trim() : "";
  if (isSnowflake(p)) return p;

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("guildId") || "").trim();
    if (isSnowflake(q)) return q;

    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("guilds");
    const fromPath = i !== -1 ? (parts[i + 1] || "").trim() : "";
    if (isSnowflake(fromPath)) return fromPath;
  } catch {}

  return "";
}

function deepClone(obj) {
  try {
    // eslint-disable-next-line no-undef
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch {}
  return JSON.parse(JSON.stringify(obj));
}

/** Deep merge objects; arrays overwritten */
function deepMerge(base, patch) {
  const a = base && typeof base === "object" ? base : {};
  const b = patch && typeof patch === "object" ? patch : {};
  const out = deepClone(a);

  for (const [k, v] of Object.entries(b)) {
    if (Array.isArray(v)) out[k] = v;
    else if (v && typeof v === "object") out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}

function normalizeWelcomeType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (!t) return "message";
  if (t === "embed+text") return "embed_text";
  if (t === "both") return "embed_text";
  if (t === "message") return "message";
  if (t === "embed") return "embed";
  if (t === "embed_text") return "embed_text";
  if (t === "card") return "card";
  return "message";
}

function typeToMode(type) {
  const t = normalizeWelcomeType(type);
  if (t === "embed_text") return "both";
  if (t === "embed") return "embed";
  return "message";
}
function modeToType(mode) {
  const m = String(mode || "").trim().toLowerCase();
  if (m === "both") return "embed_text";
  if (m === "embed") return "embed";
  return "message";
}

function mergeModuleDefaults(existingModules) {
  const out =
    existingModules && typeof existingModules === "object"
      ? deepClone(existingModules)
      : {};

  for (const key of MODULE_KEYS) {
    if (!out[key] || typeof out[key] !== "object") out[key] = {};
    if (typeof out[key].enabled !== "boolean") out[key].enabled = true;
    if (!out[key].subs || typeof out[key].subs !== "object") out[key].subs = {};
  }

  return out;
}

// Full default welcome payload
function defaultWelcome() {
  return {
    enabled: false,
    channelId: "",
    dmEnabled: false,
    message: "Welcome {user} to **{server}**! ✨",
    autoRoleId: "",

    type: "message", // message | embed | embed_text | card
    mode: "message", // legacy: message | embed | both

    embed: {
      color: "#7c3aed",
      title: "Welcome!",
      url: "",
      description: "Welcome {user} to **{server}**!",
      author: { name: "{server}", iconUrl: "", url: "" },
      thumbnailUrl: "{avatar}",
      imageUrl: "",
      footer: { text: "Member #{membercount}", iconUrl: "" },
      fields: [],
    },

    card: {
      enabled: false,
      title: "{user.name} just joined the server",
      subtitle: "Member #{membercount}",
      backgroundColor: "#0b1020",
      textColor: "#ffffff",
      overlayOpacity: 0.35,
      backgroundUrl: "",
      showAvatar: true,
    },
  };
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
    welcome: defaultWelcome(),
    modules: MODULE_KEYS.reduce((acc, k) => {
      acc[k] = { enabled: true, subs: {} };
      return acc;
    }, {}),
    personality: { mood: "story", sass: 35, narration: true },
  };
}

function normalizeWelcomeOnSave(welcomeInput) {
  const base = defaultWelcome();
  const w = deepMerge(base, welcomeInput || {});

  // infer type from legacy mode if missing
  if (!w.type && w.mode) w.type = modeToType(w.mode);

  w.type = normalizeWelcomeType(w.type);
  w.mode = typeToMode(w.type);

  // ensure card.enabled true when type=card
  if (w.type === "card") {
    w.card = w.card || {};
    w.card.enabled = true;
  } else {
    w.card = w.card || {};
  }

  return w;
}

export async function GET(req, ctx) {
  const guildId = extractGuildId(req, ctx?.params);

  if (!isSnowflake(guildId)) {
    return NextResponse.json(
      { ok: false, settings: null, guildId: "", error: "Missing/invalid guildId." },
      { status: 400 }
    );
  }

  try {
    await dbConnect();

    let doc = await GuildSettings.findOne({ guildId });
    if (!doc) doc = await GuildSettings.create(defaultSettings(guildId));

    // normalize + ensure defaults exist
    const beforeModules = JSON.stringify(doc.modules || {});
    const beforeWelcome = JSON.stringify(doc.welcome || {});

    doc.modules = mergeModuleDefaults(doc.modules);
    doc.welcome = normalizeWelcomeOnSave(doc.welcome);

    const afterModules = JSON.stringify(doc.modules || {});
    const afterWelcome = JSON.stringify(doc.welcome || {});

    if (beforeModules !== afterModules || beforeWelcome !== afterWelcome) {
      await doc.save();
    }

    return NextResponse.json(
      { ok: true, settings: doc.toObject(), guildId },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, settings: null, guildId, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function PUT(req, ctx) {
  const guildId = extractGuildId(req, ctx?.params);

  if (!isSnowflake(guildId)) {
    return NextResponse.json(
      { ok: false, settings: null, guildId: "", error: "Missing/invalid guildId." },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const incoming =
      body && typeof body === "object" && body.settings && typeof body.settings === "object"
        ? body.settings
        : body;

    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json(
        { ok: false, settings: null, guildId, error: "Body must be JSON." },
        { status: 400 }
      );
    }

    await dbConnect();

    const existingDoc = await GuildSettings.findOne({ guildId });
    const base = existingDoc?.toObject?.() || defaultSettings(guildId);

    const next = deepMerge(base, incoming);
    next.guildId = guildId;
    next.modules = mergeModuleDefaults(next.modules);

    // merge + normalize welcome safely
    const mergedWelcomeRaw = deepMerge(base?.welcome || {}, incoming?.welcome || {});
    next.welcome = normalizeWelcomeOnSave(mergedWelcomeRaw);

    const updated = await GuildSettings.findOneAndUpdate(
      { guildId },
      { $set: next },
      { new: true, upsert: true }
    );

    return NextResponse.json(
      { ok: true, settings: updated?.toObject?.() ?? updated, guildId },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, settings: null, guildId, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
