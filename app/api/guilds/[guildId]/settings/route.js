import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import GuildSettings from "../../../../models/GuildSettings";

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
    existingModules && typeof existingModules === "object" ? existingModules : {};

  for (const key of MODULE_KEYS) {
    if (!out[key] || typeof out[key] !== "object") out[key] = {};
    if (typeof out[key].enabled !== "boolean") out[key].enabled = true;
    if (!out[key].subs || typeof out[key].subs !== "object") out[key].subs = {};
  }

  return out;
}

// ✅ Full default welcome object (matches dashboard + bot)
function defaultWelcome() {
  return {
    enabled: false,
    channelId: "",
    dmEnabled: false,
    message: "Welcome {user} to **{server}**! ✨",
    autoRoleId: "",

    // canonical
    type: "message", // message | embed | embed_text | card

    // legacy
    mode: "message", // message | embed | both

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

// ✅ Merge helper (deep merge objects, arrays overwritten)
function deepMerge(base, patch) {
  const a = base && typeof base === "object" ? base : {};
  const b = patch && typeof patch === "object" ? patch : {};
  const out = deepClone(a);

  for (const [k, v] of Object.entries(b)) {
    if (Array.isArray(v)) {
      out[k] = v;
    } else if (v && typeof v === "object") {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ✅ Normalize welcome before save (type is truth, mode synced, card.enabled enforced)
function normalizeWelcomeOnSave(welcomeInput) {
  const base = defaultWelcome();
  const w = deepMerge(base, welcomeInput || {});

  // if type missing but mode exists, infer type from mode
  if (!w.type && w.mode) w.type = modeToType(w.mode);

  w.type = normalizeWelcomeType(w.type);
  w.mode = typeToMode(w.type);

  // keep card.enabled aligned
  if (w.type === "card") {
    w.card = w.card || {};
    w.card.enabled = true;
  } else {
    // keep config, don't force-disable
    w.card = w.card || {};
  }

  return w;
}

export async function GET(req, ctx) {
  const guildId = extractGuildId(req, ctx?.params);

  if (!isSnowflake(guildId)) {
    return NextResponse.json(
      { ok: true, settings: null, guildId: "", warning: "Missing/invalid guildId." },
      { status: 200 }
    );
  }

  try {
    await dbConnect();

    let doc = await GuildSettings.findOne({ guildId });
    if (!doc) {
      doc = await GuildSettings.create(defaultSettings(guildId));
    }

    // ensure modules exist
    const before = JSON.stringify(doc.modules || {});
    doc.modules = mergeModuleDefaults(doc.modules);
    const after = JSON.stringify(doc.modules || {});

    // ensure welcome is full + normalized too
    const wBefore = JSON.stringify(doc.welcome || {});
    doc.welcome = normalizeWelcomeOnSave(doc.welcome);
    const wAfter = JSON.stringify(doc.welcome || {});

    if (before !== after || wBefore !== wAfter) {
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

    await dbConnect();

    // ✅ fetch existing so partial updates don't wipe nested objects
    const existingDoc = await GuildSettings.findOne({ guildId });
    const base = existingDoc?.toObject?.() || defaultSettings(guildId);

    // ✅ merge full settings
    const next = deepMerge(base, incoming);
    next.guildId = guildId;
    next.modules = mergeModuleDefaults(next.modules);

    // ✅ IMPORTANT FIX: merge welcome separately, then normalize
    const mergedWelcomeRaw = deepMerge(base?.welcome || {}, incoming?.welcome || {});
    next.welcome = normalizeWelcomeOnSave(mergedWelcomeRaw);

    const updated = await GuildSettings.findOneAndUpdate(
      { guildId },
      { $set: next },
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
