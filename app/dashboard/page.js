// app/dashboard/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useWocTheme } from "../WocThemeProvider";
import WelcomeModule from "./_components/WelcomeModule"; // ✅ ADD THIS

const LS = { selectedGuild: "woc-selected-guild" };

// Endpoints (App Router)
const GUILDS_ENDPOINT = "/api/discord/guilds";
const STATUS_ENDPOINT = (gid) => `/api/guilds/${encodeURIComponent(gid)}/status`;
const SETTINGS_ENDPOINT = (gid) => `/api/guilds/${encodeURIComponent(gid)}/settings`;
const CHANNELS_ENDPOINT = (gid) => `/api/guilds/${encodeURIComponent(gid)}/channels`;

// Fallback endpoint (some builds use this style)
const DISCORD_CHANNELS_FALLBACK = (gid) =>
  `/api/discord/channels?guildId=${encodeURIComponent(gid)}`;

// ✅ Welcome card PNG endpoint (App Router)
const WELCOME_CARD_PNG_ENDPOINT = (gid) =>
  `/api/guilds/${encodeURIComponent(gid)}/welcome-card.png`;

// ✅ Premium status endpoint
const PREMIUM_STATUS_ENDPOINT = "/api/premium/status";

// Premium tiers (must match your API/model)
const PREMIUM_TIERS = ["free", "supporter", "supporter_plus", "supporter_plus_plus"];

function normalizeTier(t) {
  const raw = String(t || "free").trim().toLowerCase();

  // 🔧 Aliases (API/Stripe/DB may use different names)
  const alias = {
    // "premium" naming
    premium: "supporter",
    premium_plus: "supporter_plus",
    premium_plus_plus: "supporter_plus_plus",

    // common shorthand variants
    supporterplus: "supporter_plus",
    supporterplusplus: "supporter_plus_plus",
    "supporter+": "supporter_plus",
    "supporter++": "supporter_plus_plus",

    // spacing variants
    "supporter plus": "supporter_plus",
    "supporter plus plus": "supporter_plus_plus",
  };

  const x = alias[raw] || raw;
  return PREMIUM_TIERS.includes(x) ? x : "free";
}

function tierRank(t) {
  return Math.max(0, PREMIUM_TIERS.indexOf(normalizeTier(t)));
}
function hasTier(currentTier, minTier) {
  return tierRank(currentTier) >= tierRank(minTier);
}


// ✅ Welcome Card Background Options (Free + Premium packs)
// Put files under /public/welcome-backgrounds/... so they always work.
const WELCOME_BG_FREE_OPTIONS = [
  { label: "None (use gradient only)", value: "" },

  { label: "⚫ Black (Free)", value: "/welcome-backgrounds/free/Black.png" },
  { label: "🔵 BlueRed (Free)", value: "/welcome-backgrounds/free/BlueRed.png" },
  { label: "🌑 DarkBlue (Free)", value: "/welcome-backgrounds/free/DarkBlue.png" },
  { label: "🧊 LightBlue (Free)", value: "/welcome-backgrounds/free/LightBlue.png" },
  { label: "🔴 Red (Free)", value: "/welcome-backgrounds/free/Red.png" },
  { label: "🟡 YellowRed (Free)", value: "/welcome-backgrounds/free/YellowRed.png" },
];

// Premium packs. You can rename paths, just keep them in /public.
const WELCOME_BG_PREMIUM_OPTIONS = [
  {
    label: "🌸 Metallic",
    value: "/welcome-backgrounds/premium/Metallic.png",
    tier: "supporter", // ALL tiers can access
  },
  {
    label: "🌸 Rough Paper",
    value: "/welcome-backgrounds/premium/RoughPaper.png",
    tier: "supporter", // ALL tiers can access
  },
  {
    label: "⌛ Art Splash",
    value: "/welcome-backgrounds/premium/ArtSplash.png",
    tier: "supporter_plus", // plus & plus_plus
  },
  {
    label: "⌛ Cloudy",
    value: "/welcome-backgrounds/premium/Clouds.png",
    tier: "supporter_plus",
  },
  {
    label: "✨ Dessert",
    value: "/welcome-backgrounds/premium/SandWaves.png",
    tier: "supporter_plus",
  },
];


// Handy set for quick checks
const PREMIUM_BG_VALUES = new Set(
  WELCOME_BG_PREMIUM_OPTIONS.map((o) => o.value).filter(Boolean)
);

function safeGet(key, fallback = "") {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    if (v === "undefined" || v === "null") return fallback;
    return v;
  } catch {
    return fallback;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, String(val ?? ""));
  } catch {}
}
function safeDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// Discord snowflake guard (prevents "undefined" / junk from ever being used)
function isSnowflake(id) {
  const s = String(id || "").trim();
  if (!s) return false;
  if (s === "undefined" || s === "null") return false;
  return /^[0-9]{17,20}$/.test(s);
}

function deepClone(obj) {
  try {
    // eslint-disable-next-line no-undef
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch {}
  return JSON.parse(JSON.stringify(obj));
}

function safeErrorMessage(input) {
  const msg = String(input || "").trim();
  if (!msg) return "";
  const looksLikeHtml =
    msg.includes("<!DOCTYPE") ||
    msg.includes("<html") ||
    msg.includes("<body") ||
    msg.includes("<head");
  if (looksLikeHtml)
    return "Non-JSON/HTML response received (route missing or misrouted).";
  return msg.length > 260 ? msg.slice(0, 260) + "…" : msg;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  // If backend crashes or route missing, Next often returns HTML.
  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    const e = new Error(
      safeErrorMessage(txt || `Non-JSON response (${res.status})`)
    );
    e.status = res.status;
    e.body = txt;
    throw e;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const e = new Error(
      safeErrorMessage(
        data?.error || data?.warning || `Request failed (${res.status})`
      )
    );
    e.status = res.status;
    e.data = data;
    throw e;
  }

  return data;
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Pill({ tone = "default", children }) {
  const tones = {
    default:
      "border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] text-[var(--text-main)]",
    ok: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    warn: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    bad: "border-rose-400/40 bg-rose-500/10 text-rose-100",
  };
  return (
    <span
      className={cx(
        "text-[0.72rem] px-2 py-1 rounded-full border",
        tones[tone] || tones.default
      )}
    >
      {children}
    </span>
  );
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="font-semibold">{title}</div>
        {subtitle ? (
          <div className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</div>
        ) : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

function guildIconUrl(guild) {
  if (!guild?.id || !guild?.icon) return "";
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
}
function initials(name = "?") {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "?";
}
function IconCircle({ guild, size = 40 }) {
  const url = guildIconUrl(guild);
  const label = initials(guild?.name || "?");
  return (
    <div
      className="rounded-2xl overflow-hidden border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_80%,transparent)] flex items-center justify-center"
      style={{ width: size, height: size }}
      title={guild?.name || ""}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={guild?.name || "Server icon"}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xs font-semibold text-[var(--text-muted)]">
          {label}
        </span>
      )}
    </div>
  );
}

/** Custom dropdown so we can render icons */
function GuildPicker({ guilds, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = useMemo(
    () => guilds.find((g) => String(g.id) === String(value)) || null,
    [guilds, value]
  );

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cx(
          `
            w-full flex items-center justify-between gap-3 px-3 py-2 rounded-2xl
            border border-[var(--border-subtle)]/70
            bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
            text-[var(--text-main)]
          `,
          disabled ? "opacity-60 cursor-not-allowed" : ""
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <IconCircle guild={selected} size={34} />
          <div className="min-w-0 text-left">
            <div className="text-sm font-semibold truncate">
              {selected?.name || "Select a server"}
            </div>
            <div className="text-[0.72rem] text-[var(--text-muted)] truncate">
              {selected?.role ? `${selected.role}` : guilds.length ? "—" : "No servers"}
            </div>
          </div>
        </div>

        <span className="text-[var(--text-muted)]">▾</span>
      </button>

      {open ? (
        <div
          className="
            absolute z-30 mt-2 w-full max-h-[360px] overflow-auto rounded-2xl
            border border-[var(--border-subtle)]/70
            bg-[color-mix(in_oklab,var(--bg-card)_92%,transparent)]
            shadow-xl
          "
        >
          {guilds.map((g) => {
            const active = String(g.id) === String(value);
            return (
              <button
                type="button"
                key={g.id}
                onClick={() => {
                  onChange(String(g.id));
                  setOpen(false);
                }}
                className={cx(
                  "w-full px-3 py-2 flex items-center gap-3 text-left",
                  "hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]",
                  active
                    ? "bg-[color-mix(in_oklab,var(--accent-soft)_45%,transparent)]"
                    : ""
                )}
              >
                <IconCircle guild={g} size={34} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{g.name}</div>
                  <div className="text-[0.72rem] text-[var(--text-muted)] truncate">
                    {g.role || "Manager"}
                  </div>
                </div>
              </button>
            );
          })}
          {!guilds.length ? (
            <div className="px-3 py-3 text-sm text-[var(--text-muted)]">
              No servers found.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Simple channel picker (name + #hash) */
function ChannelPicker({
  channels,
  value,
  onChange,
  disabled,
  placeholder = "Select a channel",
  allowNone = true,
  noneLabel = "None",
}) {
  const list = Array.isArray(channels) ? channels : [];

  return (
    <select
      value={value || ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        `
          mt-3 w-full px-3 py-2 rounded-2xl
          border border-[var(--border-subtle)]/70
          bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
          text-[var(--text-main)]
          outline-none
        `,
        disabled ? "opacity-60 cursor-not-allowed" : ""
      )}
    >
      {allowNone ? (
        <option value="">{noneLabel}</option>
      ) : (
        <option value="">{placeholder}</option>
      )}
      {list.map((c) => (
        <option key={c.id} value={c.id}>
          #{c.name}
          {c.typeLabel ? ` (${c.typeLabel})` : ""}
          {c.parentName ? ` in ${c.parentName}` : ""}
        </option>
      ))}
    </select>
  );
}

/**
 * Modules based on your command folders.
 */
const MODULE_TREE = [
  {
    key: "moderation",
    label: "Moderation",
    emoji: "🛡️",
    desc: "Guards and staff tools.",
    subs: [
      { key: "wocban", label: "WoCBan", desc: "Ban pipeline + audit hooks." },
      { key: "wockick", label: "WoCKick", desc: "Kick tools + reasons." },
      { key: "restart", label: "Restart", desc: "Owner-only service restart." },
    ],
  },
  {
    key: "logging",
    label: "Logging",
    emoji: "📜",
    desc: "Server event journals.",
    subs: [
      { key: "commandlogs", label: "Command Logs", desc: "Track command usage." },
      { key: "editlogs", label: "Edit Logs", desc: "Message edits." },
      { key: "joinlogs", label: "Join Logs", desc: "Joins + leaves." },
      { key: "leavelogs", label: "Leave Logs", desc: "Leave tracking." },
      { key: "messagelogs", label: "Message Logs", desc: "Deletes + filters (later)." },
      { key: "modlogs", label: "Mod Logs", desc: "Staff actions." },
      { key: "nickname", label: "Nickname Logs", desc: "Nickname changes." },
      { key: "rolelogs", label: "Role Logs", desc: "Role changes." },
    ],
  },
  {
    key: "clan",
    label: "Clans",
    emoji: "🏰",
    desc: "Clans, members, power paths.",
    subs: [
      { key: "info", label: "Clan Info", desc: "Info + status panels." },
      { key: "join", label: "Join Clan", desc: "Join flows + checks." },
      { key: "leave", label: "Leave Clan", desc: "Leave flows." },
      { key: "kick", label: "Clan Kick", desc: "Kick members." },
      { key: "members", label: "Members", desc: "Roster + roles." },
      { key: "list", label: "Clan List", desc: "Browse clans." },
      { key: "eatfruit", label: "Eat Fruit", desc: "Power unlock hooks." },
      { key: "meditate", label: "Meditate", desc: "Progress + cooldowns." },
      { key: "examstatus", label: "Exam Status", desc: "Status checks." },
    ],
  },
  {
    key: "combat",
    label: "Combat",
    emoji: "⚔️",
    desc: "Duels, raids, dungeons.",
    subs: [
      { key: "duel", label: "Duel", desc: "PvP duel system." },
      { key: "fight", label: "Fight", desc: "Quick combat." },
      { key: "dungeon", label: "Dungeon", desc: "Dungeon runs." },
      { key: "raidboss", label: "Raid Boss", desc: "Boss raids." },
      { key: "raidattack", label: "Raid Attack", desc: "Raid actions." },
      { key: "clanboss", label: "Clan Boss", desc: "Clan boss fights." },
      { key: "exam", label: "Exam", desc: "Exam combat challenges." },
      { key: "duelstats", label: "Duel Stats", desc: "Stats + records." },
      { key: "examleaderboard", label: "Exam Leaderboard", desc: "Rankings." },
      { key: "examclanrank", label: "Exam Clan Rank", desc: "Clan ranking." },
      { key: "examstats", label: "Exam Stats", desc: "Performance." },
    ],
  },
  {
    key: "economy",
    label: "Economy",
    emoji: "💰",
    desc: "Coins, items, shops.",
    subs: [
      { key: "balance", label: "Balance", desc: "Balances + wallets." },
      { key: "daily", label: "Daily", desc: "Daily claims." },
      { key: "work", label: "Work", desc: "Jobs + payouts." },
      { key: "shop", label: "Shop", desc: "Shop + purchases." },
      { key: "buy", label: "Buy", desc: "Purchasing pipeline." },
      { key: "sell", label: "Sell", desc: "Selling pipeline." },
      { key: "inventory", label: "Inventory", desc: "Items + paging." },
      { key: "useitem", label: "Use Item", desc: "Use logic + effects." },
      { key: "crates", label: "Crates", desc: "Loot crates." },
      { key: "craft", label: "Crafting." },
      { key: "gamble", label: "Gamble", desc: "Risk games." },
      { key: "portal", label: "Portal", desc: "Portals/teleport economy hook." },
      { key: "equip", label: "Equip", desc: "Equipment system." },
      { key: "inspect", label: "Inspect", desc: "Inspect items/pets/artifacts." },
      { key: "house", label: "House", desc: "Housing economy link." },
    ],
  },
  {
    key: "fun",
    label: "Fun",
    emoji: "🎭",
    desc: "Social + reaction commands.",
    subs: [
      { key: "hug", label: "Hug", desc: "Hug interactions." },
      { key: "kiss", label: "Kiss", desc: "Kiss interactions." },
      { key: "cuddle", label: "Cuddle interactions." },
      { key: "pat", label: "Pat", desc: "Pat interactions." },
      { key: "slap", label: "Slap", desc: "Slap interactions." },
      { key: "punch", label: "Punch", desc: "Punch interactions." },
      { key: "poke", label: "Poke", desc: "Poke interactions." },
      { key: "bite", label: "Bite", desc: "Bite interactions." },
      { key: "tickle", label: "Tickle", desc: "Tickle interactions." },
      { key: "baka", label: "Baka interactions." },
      { key: "smug", label: "Smug interactions." },
      { key: "chase", label: "Chase interactions." },
      { key: "jokegif", label: "Joke GIF", desc: "GIF jokes." },
      { key: "fish", label: "Fish", desc: "Fishing mini-fun." },
      { key: "feed", label: "Feed", desc: "Feeding interaction." },
      { key: "kick", label: "Kick", desc: "Kick interaction." },
    ],
  },
  {
    key: "marriage",
    label: "Marriage",
    emoji: "💍",
    desc: "Family system + trees.",
    subs: [
      { key: "marry", label: "Marry", desc: "Marriage flow." },
      { key: "divorce", label: "Divorce", desc: "Divorce flow." },
      { key: "adopt", label: "Adopt", desc: "Adoption." },
      { key: "children", label: "Children", desc: "Children list." },
      { key: "parent", label: "Parent", desc: "Parent system." },
      { key: "partner", label: "Partner system." },
      { key: "tree", label: "Tree", desc: "Family tree." },
      { key: "extendedtree", label: "Extended Tree", desc: "Extended tree." },
      { key: "disown", label: "Disown", desc: "Disown flow." },
      { key: "runaway", label: "Runaway", desc: "Runaway flow." },
    ],
  },
  {
    key: "housing",
    label: "Housing",
    emoji: "🏠",
    desc: "Homes and realms.",
    subs: [
      { key: "house", label: "House", desc: "House ownership." },
      { key: "realm", label: "Realm", desc: "Realm system." },
    ],
  },
  {
    key: "quest",
    label: "Quest",
    emoji: "🧭",
    desc: "Quests and progression.",
    subs: [{ key: "quests", label: "Quest System", desc: "Quest hooks (expand later)." }],
  },
  {
    key: "utility",
    label: "Utility",
    emoji: "🧰",
    desc: "Profiles, titles, help, premium.",
    subs: [
      { key: "profile", label: "Profile", desc: "User profile." },
      { key: "leaderboards", label: "Leaderboards", desc: "Leaderboards." },
      { key: "titles", label: "Titles", desc: "Titles system." },
      { key: "premium", label: "Premium tools." },
      { key: "wochelp", label: "WoC Help", desc: "Help menu." },
      { key: "tutorial", label: "Tutorial", desc: "Tutorials." },
      { key: "setprefix", label: "Set Prefix", desc: "Prefix management." },
      { key: "eventstatus", label: "Event Status", desc: "Status reads." },
      { key: "clantutorial", label: "Clan Tutorial", desc: "Clan tutorials." },
      { key: "hybernate", label: "Hibernate", desc: "Hibernate system." },
      { key: "prestige", label: "Prestige", desc: "Prestige system." },
    ],
  },
  {
    key: "application",
    label: "Application",
    emoji: "📝",
    desc: "Applications (expand later).",
    subs: [{ key: "applications", label: "Application module." }],
  },
];

/** Build defaults: everything ON by default */
function buildDefaultModulesFromTree(tree) {
  return (tree || []).reduce((acc, cat) => {
    acc[cat.key] = {
      enabled: true,
      subs: (cat.subs || []).reduce((m, s) => {
        m[s.key] = true;
        return m;
      }, {}),
    };
    return acc;
  }, {});
}

/**
 * Merge defaults in WITHOUT overwriting explicit false values.
 */
function mergeModuleDefaults(existingModules, defaultModules) {
  const out =
    existingModules && typeof existingModules === "object"
      ? deepClone(existingModules)
      : {};

  for (const [catKey, defCat] of Object.entries(defaultModules || {})) {
    if (!out[catKey] || typeof out[catKey] !== "object") out[catKey] = {};
    if (typeof out[catKey].enabled !== "boolean")
      out[catKey].enabled = defCat.enabled;

    if (!out[catKey].subs || typeof out[catKey].subs !== "object")
      out[catKey].subs = {};
    for (const [subKey, defVal] of Object.entries(defCat.subs || {})) {
      if (typeof out[catKey].subs[subKey] !== "boolean")
        out[catKey].subs[subKey] = defVal;
    }
  }

  return out;
}

function isModuleEnabled(modules, catKey) {
  const v = modules?.[catKey]?.enabled;
  return typeof v === "boolean" ? v : true;
}
function isSubEnabled(modules, catKey, subKey) {
  const v = modules?.[catKey]?.subs?.[subKey];
  return typeof v === "boolean" ? v : true;
}

/**
 * Normalise welcome.type so UI + bot always agree.
 * Supported:
 *   message | embed | embed_text | card
 * Backwards compat:
 *   embed+text -> embed_text
 *   both -> embed_text
 */
function normalizeWelcomeType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (!t) return "message";

  // legacy aliases
  if (t === "embed+text") return "embed_text";
  if (t === "both") return "embed_text";

  // canonical
  if (t === "message") return "message";
  if (t === "embed") return "embed";
  if (t === "embed_text") return "embed_text";
  if (t === "card") return "card";

  return "message";
}

// legacy compatibility helpers
function modeToType(mode) {
  const m = String(mode || "").trim().toLowerCase();
  if (m === "both") return "embed_text";
  if (m === "embed") return "embed";
  return "message";
}
function typeToMode(type) {
  const t = normalizeWelcomeType(type);
  if (t === "embed_text") return "both";
  if (t === "embed") return "embed";
  return "message";
}

function ensureWelcomeDefaults(welcome) {
  const w = welcome && typeof welcome === "object" ? deepClone(welcome) : {};

  if (typeof w.enabled !== "boolean") w.enabled = false;

  // ✅ Source of truth is `type`.
  // If it's missing but `mode` exists (old docs), infer it.
  if (!w.type && w.mode) w.type = modeToType(w.mode);
  w.type = normalizeWelcomeType(w.type);

  // ✅ Keep legacy `mode` in sync (but never let it override type)
  w.mode = typeToMode(w.type);

  if (typeof w.channelId !== "string") w.channelId = "";
  if (typeof w.message !== "string")
    w.message = "Welcome {user} to **{server}**! ✨";
  if (typeof w.autoRoleId !== "string") w.autoRoleId = "";
  if (typeof w.dmEnabled !== "boolean") w.dmEnabled = false;

  // Embed config
  w.embed ||= {};
  if (typeof w.embed.title !== "string") w.embed.title = "Welcome!";
  if (typeof w.embed.url !== "string") w.embed.url = "";
  if (typeof w.embed.description !== "string")
    w.embed.description = "Welcome {user} to **{server}**!";
  if (typeof w.embed.color !== "string") w.embed.color = "#7c3aed";
  if (typeof w.embed.thumbnailUrl !== "string") w.embed.thumbnailUrl = "{avatar}";
  if (typeof w.embed.imageUrl !== "string") w.embed.imageUrl = "";
  if (typeof w.embed.author !== "object" || !w.embed.author) w.embed.author = {};
  if (typeof w.embed.author.name !== "string") w.embed.author.name = "{server}";
  if (typeof w.embed.author.iconUrl !== "string") w.embed.author.iconUrl = "";
  if (typeof w.embed.author.url !== "string") w.embed.author.url = "";
  if (typeof w.embed.footer !== "object" || !w.embed.footer) w.embed.footer = {};
  if (typeof w.embed.footer.text !== "string")
    w.embed.footer.text = "Member #{membercount}";
  if (typeof w.embed.footer.iconUrl !== "string") w.embed.footer.iconUrl = "";
  if (!Array.isArray(w.embed.fields)) w.embed.fields = [];

  // Card config
  w.card ||= {};
  if (typeof w.card.enabled !== "boolean") w.card.enabled = false;
  if (typeof w.card.title !== "string")
    w.card.title = "{user.name} just joined the server";
  if (typeof w.card.subtitle !== "string")
    w.card.subtitle = "Member #{membercount}";
  if (typeof w.card.backgroundColor !== "string") w.card.backgroundColor = "#0b1020";
  if (typeof w.card.textColor !== "string") w.card.textColor = "#ffffff";
  if (typeof w.card.overlayOpacity !== "number") w.card.overlayOpacity = 0.35;
  if (typeof w.card.backgroundUrl !== "string") w.card.backgroundUrl = "";
  if (typeof w.card.showAvatar !== "boolean") w.card.showAvatar = true;

  // ✅ Keep in sync: if type is card, ensure card.enabled is true
  if (w.type === "card") w.card.enabled = true;

  return w;
}


function ensureDefaultSettings(guildId) {
  const defaultModules = buildDefaultModulesFromTree(MODULE_TREE);
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
    welcome: ensureWelcomeDefaults({
      enabled: false,
      type: "message",
      channelId: "",
      message: "Welcome {user} to **{server}**! ✨",
      autoRoleId: "",
      dmEnabled: false,
    }),
    modules: defaultModules,
    personality: { mood: "story", sass: 35, narration: true },
  };
}

// ✅ Build a welcome-card PNG URL (client-side safe)
// Adds cache-bust param so refresh always fetches new image.
function buildWelcomeCardPreviewUrl({
  guildId,
  serverName,
  serverIconUrl,
  username,
  tag,
  membercount,
  avatarUrl,
  title,
  subtitle,
  backgroundColor,
  textColor,
  overlayOpacity,
  showAvatar,
  backgroundUrl,
  bust,
}) {
  if (!isSnowflake(guildId)) return "";
  const params = new URLSearchParams();
  if (serverName) params.set("serverName", serverName);
  if (serverIconUrl) params.set("serverIconUrl", serverIconUrl);
  if (username) params.set("username", username);
  if (tag) params.set("tag", tag);
  if (membercount) params.set("membercount", String(membercount));
  if (avatarUrl) params.set("avatarUrl", avatarUrl);

  if (title) params.set("title", title);
  if (subtitle) params.set("subtitle", subtitle);

  if (backgroundColor) params.set("backgroundColor", backgroundColor);
  if (textColor) params.set("textColor", textColor);
  if (typeof overlayOpacity === "number")
    params.set("overlayOpacity", String(overlayOpacity));
  params.set("showAvatar", showAvatar ? "true" : "false");

  if (backgroundUrl) params.set("backgroundUrl", backgroundUrl);

  // Cache bust always last
  params.set("_", String(bust || Date.now()));

  return `${WELCOME_CARD_PNG_ENDPOINT(guildId)}?${params.toString()}`;
}


function safeHexColor(v, fallback = "#7c3aed") {
  const s = String(v || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return s;
  return fallback;
}

function clampNum(n, min, max) {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function ensureEmbedDefaults(embed) {
  const e = embed && typeof embed === "object" ? deepClone(embed) : {};

  if (typeof e.title !== "string") e.title = "Welcome!";
  if (typeof e.url !== "string") e.url = "";
  if (typeof e.description !== "string")
    e.description = "Welcome {user} to **{server}**!";

  e.color = safeHexColor(e.color, "#7c3aed");

  if (typeof e.thumbnailUrl !== "string") e.thumbnailUrl = "{avatar}";
  if (typeof e.imageUrl !== "string") e.imageUrl = "";

  if (!e.author || typeof e.author !== "object") e.author = {};
  if (typeof e.author.name !== "string") e.author.name = "{server}";
  if (typeof e.author.iconUrl !== "string") e.author.iconUrl = "";
  if (typeof e.author.url !== "string") e.author.url = "";

  if (!e.footer || typeof e.footer !== "object") e.footer = {};
  if (typeof e.footer.text !== "string") e.footer.text = "Member #{membercount}";
  if (typeof e.footer.iconUrl !== "string") e.footer.iconUrl = "";

  if (!Array.isArray(e.fields)) e.fields = [];

  // normalize fields
  e.fields = e.fields
    .filter(Boolean)
    .slice(0, 25)
    .map((f) => ({
      name: typeof f?.name === "string" ? f.name : "Field title",
      value: typeof f?.value === "string" ? f.value : "Field value",
      inline: typeof f?.inline === "boolean" ? f.inline : false,
    }));

  return e;
}

function ensureCardDefaults(card) {
  const c = card && typeof card === "object" ? deepClone(card) : {};

  if (typeof c.enabled !== "boolean") c.enabled = false;
  if (typeof c.title !== "string") c.title = "{user.name} just joined the server";
  if (typeof c.subtitle !== "string") c.subtitle = "Member #{membercount}";
  if (typeof c.backgroundColor !== "string") c.backgroundColor = "#0b1020";
  if (typeof c.textColor !== "string") c.textColor = "#ffffff";
  if (typeof c.overlayOpacity !== "number") c.overlayOpacity = 0.35;
  if (typeof c.backgroundUrl !== "string") c.backgroundUrl = "";
  if (typeof c.showAvatar !== "boolean") c.showAvatar = true;

  c.overlayOpacity = clampNum(c.overlayOpacity, 0, 0.85);

  return c;
}

function EmbedPreview({ embed }) {
  const e = ensureEmbedDefaults(embed);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] p-4">
      <div className="text-xs text-[var(--text-muted)] mb-2">Preview (approx)</div>

      <div className="flex gap-3">
        <div
          className="w-1.5 rounded-full"
          style={{ background: safeHexColor(e.color, "#7c3aed") }}
        />
        <div className="min-w-0 flex-1">
          {e.author?.name ? (
            <div className="text-[0.72rem] text-[var(--text-muted)]">
              {e.author.name}
            </div>
          ) : null}

          {e.title ? (
            <div className="font-semibold text-sm break-words">{e.title}</div>
          ) : null}

          {e.description ? (
            <div className="mt-2 text-sm text-[var(--text-muted)] whitespace-pre-wrap break-words">
              {e.description}
            </div>
          ) : null}

          {Array.isArray(e.fields) && e.fields.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {e.fields.slice(0, 6).map((f, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_75%,transparent)] p-3"
                >
                  <div className="text-xs font-semibold break-words">{f.name}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)] whitespace-pre-wrap break-words">
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {e.footer?.text ? (
            <div className="mt-3 text-[0.72rem] text-[var(--text-muted)]">
              {e.footer.text}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 text-[0.7rem] text-[var(--text-muted)]">
        Tokens like {"{user}"} / {"{server}"} / {"{membercount}"} are shown as-is in preview.
      </div>
    </div>
  );
}



export default function DashboardPage() {
  let woc = null;
  try {
    woc = useWocTheme();
  } catch {
    woc = null;
  }

  const { data: session, status } = useSession();
  const loading = status === "loading";
  const authed = status === "authenticated";

  const [guilds, setGuilds] = useState([]);
  const [guildWarn, setGuildWarn] = useState("");

  const [selectedGuildIdRaw, setSelectedGuildIdRaw] = useState("");

  useEffect(() => {
    setSelectedGuildIdRaw(safeGet(LS.selectedGuild, ""));
  }, []);

  const selectedGuildId = useMemo(() => {
    const raw = String(selectedGuildIdRaw || "").trim();
    if (!guilds.length) return "";
    if (isSnowflake(raw) && guilds.some((g) => String(g.id) === raw)) return raw;

    const first = String(guilds[0]?.id || "");
    return isSnowflake(first) ? first : "";
  }, [guilds, selectedGuildIdRaw]);

  const selectedGuild = useMemo(
    () => guilds.find((g) => String(g.id) === String(selectedGuildId)) || null,
    [guilds, selectedGuildId]
  );

  const canonicalGuildId = useMemo(() => {
    const gid =
      selectedGuildId ||
      selectedGuild?.id ||
      selectedGuild?.guildId ||
      safeGet(LS.selectedGuild, "");
    return isSnowflake(gid) ? String(gid) : "";
  }, [selectedGuildId, selectedGuild]);

  const [install, setInstall] = useState({
    loading: false,
    installed: null,
    warning: "",
  });

  const [subtab, setSubtab] = useState("overview");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [dirty, setDirty] = useState(false);

  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsWarn, setChannelsWarn] = useState("");
  const [channels, setChannels] = useState([]);

  const guildFetchOnceRef = useRef(false);
  const guildAbortRef = useRef(null);
  const perGuildAbortRef = useRef(null);
  const channelsAbortRef = useRef(null);

  const [moduleCategory, setModuleCategory] = useState("moderation");
  const [moduleSearch, setModuleSearch] = useState("");

  const [welcomeBgNotice, setWelcomeBgNotice] = useState("");

  // ✅ Welcome card preview state
  const [welcomePreviewBust, setWelcomePreviewBust] = useState(Date.now());
  const [welcomePreviewError, setWelcomePreviewError] = useState("");

  // ✅ Premium status
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumWarn, setPremiumWarn] = useState("");
  const [premiumStatus, setPremiumStatus] = useState({
    ok: true,
    authed: false,
    premium: false,
    active: false,
    tier: "free",
    expiresAt: null,
  });

  const premiumActive = !!premiumStatus?.active || !!premiumStatus?.premium;

  const premiumTier = normalizeTier(premiumStatus?.tier);

  const clientIdRaw = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "";
  const clientId = String(clientIdRaw || "").trim();
  const hasClientId = isSnowflake(clientId);

  // Always build a FULL absolute Discord URL, includes integration_type=0
  function buildBotInviteUrl(gid) {
    if (!hasClientId) return "";

    const params = new URLSearchParams();
    params.set("client_id", clientId);
    params.set("scope", "bot applications.commands");
    params.set("permissions", "8");
    params.set("integration_type", "0");

    const guildId = String(gid || "").trim();
    if (isSnowflake(guildId)) {
      params.set("guild_id", guildId);
      params.set("disable_guild_select", "true");
    }

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }

  function showToast(msg, mood = "playful") {
    setToast(msg);
    if (woc?.setMood) woc.setMood(mood);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  function resetSelectedGuild() {
    safeDel(LS.selectedGuild);
    setSelectedGuildIdRaw("");
    showToast("Selection wiped. Pick a server again. 🧽", "playful");
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (guildAbortRef.current) guildAbortRef.current.abort();
      if (perGuildAbortRef.current) perGuildAbortRef.current.abort();
      if (channelsAbortRef.current) channelsAbortRef.current.abort();
    };
  }, []);

  // ✅ Fetch premium status after auth (Dyno-style account flag)
  useEffect(() => {
    if (!authed) {
      setPremiumWarn("");
      setPremiumStatus({
        ok: true,
        authed: false,
        premium: false,
        active: false,
        tier: "free",
        expiresAt: null,
      });
      return;
    }

    const ac = new AbortController();

    (async () => {
      try {
        setPremiumLoading(true);
        setPremiumWarn("");

        const data = await fetchJson(PREMIUM_STATUS_ENDPOINT, {
          cache: "no-store",
          signal: ac.signal,
        });

        setPremiumStatus({
          ok: !!data?.ok,
          authed: !!data?.authed,
          premium: !!data?.premium,
          active: !!data?.active,
          tier: normalizeTier(data?.tier),
          expiresAt: data?.expiresAt || null,
        });

        if (data?.warning) setPremiumWarn(safeErrorMessage(data.warning));
      } catch (e) {
        if (e?.name === "AbortError") return;
        setPremiumWarn(
          safeErrorMessage(e?.message || "Premium status unavailable.")
        );
        setPremiumStatus((s) => ({
          ...s,
          ok: false,
          premium: false,
          active: false,
          tier: "free",
        }));
      } finally {
        setPremiumLoading(false);
      }
    })();

    return () => ac.abort();
  }, [authed]);

  // Fetch guild list once after auth
  useEffect(() => {
    if (!authed) {
      setGuilds([]);
      setGuildWarn("");
      guildFetchOnceRef.current = false;
      return;
    }
    if (guildFetchOnceRef.current) return;
    guildFetchOnceRef.current = true;

    if (guildAbortRef.current) guildAbortRef.current.abort();
    const ac = new AbortController();
    guildAbortRef.current = ac;

    (async () => {
      try {
        setGuildWarn("");
        const data = await fetchJson(GUILDS_ENDPOINT, {
          cache: "no-store",
          signal: ac.signal,
        });

        const list = Array.isArray(data.guilds) ? data.guilds : [];
        setGuilds(list);

        const warn = safeErrorMessage(data.warning || data.error || "");
        if (warn) setGuildWarn(warn);

        const raw = String(
          selectedGuildIdRaw || safeGet(LS.selectedGuild, "") || ""
        ).trim();
        const first = String(list[0]?.id || "");
        const validRaw = isSnowflake(raw) && list.some((g) => String(g.id) === raw);

        if (validRaw) {
          setSelectedGuildIdRaw(raw);
          safeSet(LS.selectedGuild, raw);
        } else if (isSnowflake(first)) {
          setSelectedGuildIdRaw(first);
          safeSet(LS.selectedGuild, first);
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
        setGuildWarn(safeErrorMessage(e?.message || "Failed to load guilds."));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    if (!isSnowflake(canonicalGuildId)) return;
    safeSet(LS.selectedGuild, canonicalGuildId);
  }, [authed, canonicalGuildId]);

  // Per-guild: status + settings
  useEffect(() => {
    if (!authed) return;
    if (!isSnowflake(canonicalGuildId)) return;

    setDirty(false);
    setWelcomePreviewError("");

    if (perGuildAbortRef.current) perGuildAbortRef.current.abort();
    const ac = new AbortController();
    perGuildAbortRef.current = ac;

    setInstall((s) => ({ ...s, loading: true, warning: "" }));
    (async () => {
      try {
        const data = await fetchJson(STATUS_ENDPOINT(canonicalGuildId), {
          cache: "no-store",
          signal: ac.signal,
        });

        const rawWarn = safeErrorMessage(data?.warning || data?.error || "");
        setInstall({
          loading: false,
          installed: data?.installed ?? null,
          warning: rawWarn === "Missing/invalid guildId." ? "" : rawWarn,
        });
      } catch (e) {
        if (e?.name === "AbortError") return;
        setInstall({
          loading: false,
          installed: null,
          warning: safeErrorMessage(e?.message || "Gate check unavailable."),
        });
      }
    })();

    setSettingsLoading(true);
    setSettings(null);

    (async () => {
      try {
        const data = await fetchJson(SETTINGS_ENDPOINT(canonicalGuildId), {
          cache: "no-store",
          signal: ac.signal,
        });

        const incoming =
          data?.settings && typeof data.settings === "object" ? data.settings : null;
        const base = incoming || ensureDefaultSettings(canonicalGuildId);

        // modules defaults
        const defaults = buildDefaultModulesFromTree(MODULE_TREE);
        const mergedModules = mergeModuleDefaults(base.modules, defaults);

        // welcome defaults
        const mergedWelcome = ensureWelcomeDefaults(base.welcome);

        setSettings({
          ...base,
          guildId: canonicalGuildId,
          modules: mergedModules,
          welcome: mergedWelcome,
        });

        // bump preview after settings load
        setWelcomePreviewBust(Date.now());
      } catch (e) {
        if (e?.name === "AbortError") return;
        setSettings(ensureDefaultSettings(canonicalGuildId));
      } finally {
        if (!ac.signal.aborted) setSettingsLoading(false);
      }
    })();
  }, [authed, canonicalGuildId]);

  async function fetchChannelsForGuild(gid, signal) {
    try {
      const data = await fetchJson(CHANNELS_ENDPOINT(gid), {
        cache: "no-store",
        signal,
      });
      const list = Array.isArray(data.channels) ? data.channels : [];
      return { channels: list, warning: safeErrorMessage(data.warning || "") };
    } catch (e) {
      const status = e?.status;
      const body = String(e?.body || e?.message || "");
      const isMissingAccess =
        status === 403 ||
        body.includes('"code": 50001') ||
        body.toLowerCase().includes("missing access");

      if (isMissingAccess) {
        return { channels: [], warning: "" };
      }

      const msg = safeErrorMessage(e?.message || "");

      const shouldFallback =
        msg.toLowerCase().includes("missing") ||
        msg.toLowerCase().includes("guildid") ||
        msg.toLowerCase().includes("non-json") ||
        msg.toLowerCase().includes("html") ||
        msg.toLowerCase().includes("route") ||
        status === 404;

      if (shouldFallback) {
        const data2 = await fetchJson(DISCORD_CHANNELS_FALLBACK(gid), {
          cache: "no-store",
          signal,
        });
        const list2 = Array.isArray(data2.channels) ? data2.channels : [];
        return { channels: list2, warning: safeErrorMessage(data2.warning || "") };
      }

      throw e;
    }
  }

  // Channels: only fetch if installed
  useEffect(() => {
    if (!authed) return;
    if (!isSnowflake(canonicalGuildId)) return;

    if (install.installed === false) {
      setChannelsLoading(false);
      setChannels([]);
      setChannelsWarn("");
      return;
    }

    if (channelsAbortRef.current) channelsAbortRef.current.abort();
    const ac = new AbortController();
    channelsAbortRef.current = ac;

    setChannelsLoading(true);
    setChannels([]);
    setChannelsWarn("");

    (async () => {
      try {
        const { channels: list, warning } = await fetchChannelsForGuild(
          canonicalGuildId,
          ac.signal
        );
        setChannels(list);
        setChannelsWarn(
          warning && warning !== "Missing/invalid guildId." ? warning : ""
        );
      } catch (e) {
        if (e?.name === "AbortError") return;
        const msg = safeErrorMessage(e?.message || "Failed to load channels.");
        setChannelsWarn(msg === "Missing/invalid guildId." ? "" : msg);
      } finally {
        if (!ac.signal.aborted) setChannelsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [authed, canonicalGuildId, install.installed]);

  async function saveSettings() {
    if (!isSnowflake(canonicalGuildId) || !settings) return;

    const defaults = buildDefaultModulesFromTree(MODULE_TREE);
    const safeSettings = deepClone(settings);
    safeSettings.guildId = canonicalGuildId;
    safeSettings.modules = mergeModuleDefaults(safeSettings.modules, defaults);
    safeSettings.welcome = ensureWelcomeDefaults(safeSettings.welcome);

    setSettingsLoading(true);
    try {
      const data = await fetchJson(SETTINGS_ENDPOINT(canonicalGuildId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: safeSettings }),
      });

      const incoming =
        data?.settings && typeof data.settings === "object"
          ? data.settings
          : safeSettings;
      const mergedModules = mergeModuleDefaults(incoming.modules, defaults);

      setSettings({
        ...incoming,
        guildId: canonicalGuildId,
        modules: mergedModules,
        welcome: ensureWelcomeDefaults(incoming.welcome),
      });
      setDirty(false);
      showToast("Settings sealed. ✅", "playful");
      setWelcomePreviewBust(Date.now());
    } catch (e) {
      showToast(safeErrorMessage(e?.message || "Save failed."), "omen");
    } finally {
      setSettingsLoading(false);
    }
  }

  const gateInstalled = install.installed === true;

  const mood = woc?.mood || "story";
  const moodWhisper =
    mood === "battle"
      ? "Pick a panel. Flip the switches. Let’s duel the chaos."
      : mood === "omen"
      ? "Warnings in the fog. Not fatal. Just dramatic weather."
      : mood === "flustered"
      ? "Too many servers, not enough hands. We cope."
      : mood === "playful"
      ? "Twist the dials. Watch the server react."
      : "This is the control room. Quiet power lives here.";

  const subnav = [
    ["overview", "Overview"],
    ["modules", "Modules"],
    ["logs", "Logs"],
    ["welcome", "Welcome"],
    ["moderation", "Moderation"],
    ["personality", "Personality"],
    ["actionlog", "Action log"],
  ];

  const activeCategory = useMemo(
    () => MODULE_TREE.find((c) => c.key === moduleCategory) || MODULE_TREE[0],
    [moduleCategory]
  );

  const filteredSubs = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    const subs = activeCategory?.subs || [];
    if (!q) return subs;
    return subs.filter(
      (s) =>
        (s.label + " " + (s.desc || "")).toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q)
    );
  }, [activeCategory, moduleSearch]);

  function setModuleEnabled(categoryKey, enabled) {
    setSettings((prev) => {
      const next = deepClone(prev);
      next.modules ||= {};
      next.modules[categoryKey] ||= { enabled: true, subs: {} };
      next.modules[categoryKey].enabled = !!enabled;
      return next;
    });
    setDirty(true);
  }

  function setSubEnabled(categoryKey, subKey, enabled) {
    setSettings((prev) => {
      const next = deepClone(prev);
      next.modules ||= {};
      next.modules[categoryKey] ||= { enabled: true, subs: {} };
      next.modules[categoryKey].subs ||= {};
      next.modules[categoryKey].subs[subKey] = !!enabled;
      return next;
    });
    setDirty(true);
  }

  const textChannels = useMemo(() => {
    const list = Array.isArray(channels) ? channels : [];
    return list.filter((c) => {
      const t = String(c?.type || "").toLowerCase();
      const label = String(c?.typeLabel || "").toLowerCase();
      return (
        t.includes("text") ||
        label.includes("text") ||
        t.includes("announcement") ||
        label.includes("announce")
      );
    });
  }, [channels]);

  const debugStatusUrl = isSnowflake(canonicalGuildId)
    ? `${STATUS_ENDPOINT(canonicalGuildId)}`
    : "";
  const debugChannelsUrl = isSnowflake(canonicalGuildId)
    ? `${CHANNELS_ENDPOINT(canonicalGuildId)}`
    : "";

  // ✅ Compute welcome card preview endpoint (with premium background gating)
  const welcomeCardPreviewUrl = useMemo(() => {
    if (!gateInstalled) return "";
    if (!isSnowflake(canonicalGuildId)) return "";
    if (!settings?.welcome) return "";
    if (normalizeWelcomeType(settings.welcome?.type) !== "card") return "";

    const guildName = selectedGuild?.name || "Server";
    const guildIcon = guildIconUrl(selectedGuild) || "";

    const userName =
      String(session?.user?.name || session?.user?.email || "New Member").trim() ||
      "New Member";
    const userImage = String(session?.user?.image || "").trim();

    // Try to pull something sensible for membercount
    const membercount =
      String(selectedGuild?.memberCount || selectedGuild?.member_count || "").trim() ||
      "123";

    const card = ensureWelcomeDefaults(settings.welcome).card;

    // ✅ Prevent preview URL from using premium background if user isn’t allowed
    const rawBg = card?.backgroundUrl || "";
    const premOpt = WELCOME_BG_PREMIUM_OPTIONS.find((o) => o.value === rawBg);

    let bgForPreview = rawBg;

    if (premOpt) {
      const required = normalizeTier(premOpt.tier || "supporter");
      const allowed = premiumActive && hasTier(premiumTier, required);
      if (!allowed) bgForPreview = ""; // strip premium bg from preview if not allowed
    }

    return buildWelcomeCardPreviewUrl({
      guildId: canonicalGuildId,
      serverName: guildName,
      serverIconUrl: guildIcon,
      username: userName,
      tag: "",
      membercount,
      avatarUrl: userImage,
      title: card?.title || "{user.name} just joined the server",
      subtitle: card?.subtitle || "Member #{membercount}",
      backgroundColor: card?.backgroundColor || "#0b1020",
      textColor: card?.textColor || "#ffffff",
      overlayOpacity: Number(card?.overlayOpacity ?? 0.35),
      showAvatar: card?.showAvatar !== false,
      backgroundUrl: bgForPreview,
      bust: welcomePreviewBust,
    });
  }, [
    gateInstalled,
    canonicalGuildId,
    settings,
    selectedGuild,
    session,
    welcomePreviewBust,
    premiumActive,
    premiumTier,
  ]);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="woc-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)] max-w-3xl">
              WoC’s control room. Choose a server, then tune modules, logs, welcome,
              moderation, and personality.
            </p>
            <p className="mt-2 text-[0.78rem] text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-main)]">WOC whisper:</span>{" "}
              {moodWhisper}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/vote" className="woc-btn-ghost text-xs sm:text-sm">
              Vote page 🗳️
            </Link>
            <Link href="/premium" className="woc-btn-ghost text-xs sm:text-sm">
              Premium ✨
            </Link>
          </div>
        </div>

        {toast ? (
          <div className="mt-5 woc-card p-3 animate-fadeIn">
            <div className="text-sm">{toast}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 text-sm text-[var(--text-muted)]">
            Loading your portal…
          </div>
        ) : !authed ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="woc-card p-5">
              <SectionTitle
                title="Step 1: Invite WoC"
                subtitle="Invite first so the dashboard can control something real."
              />

              <a
                className={cx(
                  "mt-4 inline-flex w-full justify-center items-center gap-2 woc-btn-primary",
                  !hasClientId ? "opacity-60 cursor-not-allowed" : ""
                )}
                href={hasClientId ? buildBotInviteUrl("") : undefined}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (!hasClientId) e.preventDefault();
                }}
                title={
                  hasClientId
                    ? "Invite WoC to a server"
                    : "Set NEXT_PUBLIC_DISCORD_CLIENT_ID in env and redeploy"
                }
              >
                Add WoC to Discord <span className="text-base">➕</span>
              </a>

              {!hasClientId ? (
                <div className="mt-2 text-[0.72rem] text-rose-200/90">
                  Missing/invalid NEXT_PUBLIC_DISCORD_CLIENT_ID. Add it to env and redeploy.
                </div>
              ) : null}
            </div>

            <div className="woc-card p-5">
              <SectionTitle
                title="Step 2: Sign in"
                subtitle="Sign in with Discord so we can see what you manage."
              />
              <button
                onClick={() => signIn("discord")}
                className="mt-4 inline-flex w-full justify-center items-center gap-2 woc-btn-ghost"
              >
                Sign in with Discord <span>🔐</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="woc-card p-5 lg:col-span-2">
                <SectionTitle
                  title="Server selector"
                  subtitle="Only servers you own/admin appear. Icons included. ✨"
                  right={
                    <div className="flex items-center gap-2">
                      {install.loading ? <Pill>Checking gate…</Pill> : null}
                      {channelsLoading ? <Pill>Loading channels…</Pill> : null}

                      {premiumLoading ? <Pill>Checking Premium…</Pill> : null}
                      {!premiumLoading && premiumActive ? (
                        <Pill tone="ok">
                          Premium: {premiumTier.replaceAll("_", " ")} ✨
                        </Pill>
                      ) : null}
                      {!premiumLoading && !premiumActive ? (
                        <Pill tone="warn">Premium: Free</Pill>
                      ) : null}

                      {install.installed === true ? (
                        <Pill tone="ok">Installed ✅</Pill>
                      ) : null}
                      {install.installed === false ? (
                        <Pill tone="warn">Not installed 🔒</Pill>
                      ) : null}
                      {!isSnowflake(canonicalGuildId) ? (
                        <Pill tone="warn">Pick a server</Pill>
                      ) : null}
                      <button
                        type="button"
                        className="woc-btn-ghost text-xs"
                        onClick={resetSelectedGuild}
                      >
                        Reset selection
                      </button>
                    </div>
                  }
                />

                {premiumWarn ? (
                  <div className="mt-4 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    <div className="font-semibold">Premium notice</div>
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">
                      {premiumWarn}
                    </div>
                  </div>
                ) : null}

                {guildWarn ? (
                  <div className="mt-4 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    <div className="font-semibold">Guild list notice</div>
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">
                      {guildWarn}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <GuildPicker
                    guilds={guilds}
                    value={canonicalGuildId}
                    disabled={!guilds.length}
                    onChange={(gid) => {
                      const next = String(gid);
                      setSelectedGuildIdRaw(next);
                      safeSet(LS.selectedGuild, next);
                      setSubtab("overview");
                      woc?.setMood?.("story");
                      setModuleSearch("");
                      setWelcomePreviewError("");
                      setWelcomePreviewBust(Date.now());
                    }}
                  />
                </div>

                {process.env.NODE_ENV !== "production" && isSnowflake(canonicalGuildId) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      className="woc-btn-ghost text-xs"
                      href={debugStatusUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open status JSON
                    </a>
                    <a
                      className="woc-btn-ghost text-xs"
                      href={debugChannelsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open channels JSON
                    </a>
                  </div>
                ) : null}

                {install.warning ? (
                  <div className="mt-4 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    <div className="font-semibold">Gate notice</div>
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">
                      {install.warning}
                    </div>
                  </div>
                ) : null}

                {channelsWarn && isSnowflake(canonicalGuildId) && gateInstalled ? (
                  <div className="mt-4 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    <div className="font-semibold">Channel list notice</div>
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">
                      {channelsWarn}
                    </div>
                  </div>
                ) : null}

                {install.installed === false ? (
                  <div className="mt-4 woc-card p-4">
                    <div className="text-sm font-semibold">Invite gate</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      Invite WoC to <b>{selectedGuild?.name}</b> to unlock the dashboard controls.
                    </div>

                    <a
                      className={cx(
                        "mt-3 inline-flex items-center gap-2 woc-btn-primary",
                        !hasClientId || !isSnowflake(canonicalGuildId)
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      )}
                      href={
                        hasClientId && isSnowflake(canonicalGuildId)
                          ? buildBotInviteUrl(canonicalGuildId)
                          : undefined
                      }
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        if (!hasClientId || !isSnowflake(canonicalGuildId)) e.preventDefault();
                        woc?.setMood?.("battle");
                      }}
                      title={
                        hasClientId
                          ? "Invite WoC to this server"
                          : "Set NEXT_PUBLIC_DISCORD_CLIENT_ID in env and redeploy"
                      }
                    >
                      Invite WoC to this server <span>➕</span>
                    </a>

                    {!hasClientId ? (
                      <div className="mt-2 text-[0.72rem] text-rose-200/90">
                        Missing/invalid NEXT_PUBLIC_DISCORD_CLIENT_ID. Add it to env and redeploy.
                      </div>
                    ) : (
                      <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                        Once invited, refresh this page. The gate opens automatically.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="woc-card p-5">
                <SectionTitle title="Control seal" subtitle="Changes persist per server." />
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    className={cx(
                      "woc-btn-primary",
                      !gateInstalled || !dirty || settingsLoading || !isSnowflake(canonicalGuildId)
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    )}
                    disabled={
                      !gateInstalled || !dirty || settingsLoading || !isSnowflake(canonicalGuildId)
                    }
                    onClick={saveSettings}
                    title={
                      !isSnowflake(canonicalGuildId)
                        ? "Pick a server first."
                        : !gateInstalled
                        ? "Invite WoC to unlock the dashboard."
                        : !dirty
                        ? "No changes yet."
                        : "Save changes"
                    }
                  >
                    {settingsLoading ? "Saving…" : dirty ? "Save changes ✅" : "Saved"}
                  </button>

                  <div className="text-[0.72rem] text-[var(--text-muted)]">
                    {gateInstalled
                      ? dirty
                        ? "WoC is watching. Commit the ritual."
                        : "All quiet. No edits pending."
                      : "Invite WoC to unlock controls for this server."}
                  </div>

                  <div className="mt-2 text-[0.7rem] text-[var(--text-muted)]">
                    Selected guildId:{" "}
                    <span
                      className={cx(
                        "font-semibold",
                        isSnowflake(canonicalGuildId) ? "text-emerald-200" : "text-amber-200"
                      )}
                    >
                      {canonicalGuildId || "(none)"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ If bot not installed: do NOT show tabs/modules/settings at all */}
            {!gateInstalled ? null : (
              <div className="mt-6 woc-card p-5">
                <div className="flex flex-wrap gap-2">
                  {subnav.map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => {
                        setSubtab(k);
                        woc?.setMood?.(k === "personality" ? "playful" : "story");
                      }}
                      className={cx(
                        "text-xs sm:text-sm px-3 py-2 rounded-full border transition",
                        "border-[var(--border-subtle)]/70",
                        subtab === k
                          ? "bg-[color-mix(in_oklab,var(--accent-soft)_55%,transparent)]"
                          : "bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {settingsLoading || !settings ? (
                  <div className="mt-4 text-sm text-[var(--text-muted)]">Loading settings…</div>
                ) : (
                  <div className="mt-5">
                    {/* OVERVIEW */}
                    {subtab === "overview" ? (
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="woc-card p-4 lg:col-span-2">
                          <div className="font-semibold">Server snapshot</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            Live settings in Mongo (once your API is happy).
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="woc-card p-3">
                              <div className="text-xs text-[var(--text-muted)]">Prefix</div>
                              <div className="text-lg font-semibold mt-1">{settings.prefix}</div>
                            </div>
                            <div className="woc-card p-3">
                              <div className="text-xs text-[var(--text-muted)]">Welcome</div>
                              <div className="text-lg font-semibold mt-1">
                                {settings.welcome?.enabled ? "On" : "Off"}
                              </div>
                            </div>
                            <div className="woc-card p-3">
                              <div className="text-xs text-[var(--text-muted)]">Logs</div>
                              <div className="text-lg font-semibold mt-1">
                                {settings.logs?.enabled ? "On" : "Off"}
                              </div>
                            </div>
                            <div className="woc-card p-3">
                              <div className="text-xs text-[var(--text-muted)]">Mood</div>
                              <div className="text-lg font-semibold mt-1">
                                {settings.personality?.mood}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="woc-card p-4">
                          <div className="font-semibold">WoC whisper</div>
                          <div className="text-xs text-[var(--text-muted)] mt-2">
                            “A server is a living map. Modules are the weather. Choose wisely.”
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* MODULES */}
                    {subtab === "modules" ? (
                      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                        <div className="woc-card p-4">
                          <div className="font-semibold">Modules</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            Pick a category on the left.
                          </div>

                          <div className="mt-4 space-y-2">
                            {MODULE_TREE.map((cat) => {
                              const active = cat.key === moduleCategory;
                              const enabled = isModuleEnabled(settings.modules, cat.key);

                              return (
                                <button
                                  key={cat.key}
                                  type="button"
                                  onClick={() => {
                                    setModuleCategory(cat.key);
                                    setModuleSearch("");
                                    woc?.setMood?.(enabled ? "story" : "omen");
                                  }}
                                  className={cx(
                                    "w-full text-left rounded-2xl border px-3 py-3 transition",
                                    "border-[var(--border-subtle)]/70",
                                    active
                                      ? "bg-[color-mix(in_oklab,var(--accent-soft)_55%,transparent)]"
                                      : "bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="font-semibold truncate">
                                        {cat.emoji} {cat.label}
                                      </div>
                                      <div className="text-[0.72rem] text-[var(--text-muted)] mt-1 truncate">
                                        {cat.desc}
                                      </div>
                                    </div>
                                    <span
                                      className={cx(
                                        "text-[0.72rem] px-2 py-1 rounded-full border",
                                        enabled
                                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                                          : "border-amber-400/40 bg-amber-500/10 text-amber-100"
                                      )}
                                    >
                                      {enabled ? "On" : "Off"}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="woc-card p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-xl">
                                {activeCategory?.emoji} {activeCategory?.label}
                              </div>
                              <div className="text-xs text-[var(--text-muted)] mt-1">
                                {activeCategory?.desc}
                              </div>
                            </div>

                            <label className="inline-flex items-center gap-2">
                              <span className="text-[0.72rem] text-[var(--text-muted)]">
                                Category
                              </span>
                              <input
                                type="checkbox"
                                checked={isModuleEnabled(settings.modules, activeCategory.key)}
                                onChange={(e) => {
                                  setModuleEnabled(activeCategory.key, e.target.checked);
                                  woc?.setMood?.(e.target.checked ? "story" : "omen");
                                }}
                              />
                            </label>
                          </div>

                          <div className="mt-4">
                            <input
                              value={moduleSearch}
                              onChange={(e) => setModuleSearch(e.target.value)}
                              placeholder="Search features…"
                              className="
                                w-full px-3 py-2 rounded-2xl
                                border border-[var(--border-subtle)]/70
                                bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                                text-[var(--text-main)]
                                outline-none
                              "
                            />
                          </div>

                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            {filteredSubs.map((s) => {
                              const catEnabled = isModuleEnabled(
                                settings.modules,
                                activeCategory.key
                              );
                              const subEnabled = isSubEnabled(
                                settings.modules,
                                activeCategory.key,
                                s.key
                              );

                              return (
                                <div
                                  key={s.key}
                                  className="woc-card p-4 flex flex-col justify-between"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="font-semibold truncate">{s.label}</div>
                                      <div className="text-xs text-[var(--text-muted)] mt-1">
                                        {s.desc || ""}
                                      </div>
                                      <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                                        Key:{" "}
                                        <span className="font-semibold text-[var(--text-main)]">
                                          {activeCategory.key}.{s.key}
                                        </span>
                                      </div>
                                    </div>

                                    <label className="inline-flex items-center gap-2">
                                      <span className="text-[0.72rem] text-[var(--text-muted)]">
                                        {subEnabled ? "On" : "Off"}
                                      </span>
                                      <input
                                        type="checkbox"
                                        checked={!!subEnabled}
                                        disabled={!catEnabled}
                                        onChange={(e) => {
                                          setSubEnabled(
                                            activeCategory.key,
                                            s.key,
                                            e.target.checked
                                          );
                                        }}
                                      />
                                    </label>
                                  </div>

                                  {!catEnabled ? (
                                    <div className="mt-3 text-[0.72rem] text-amber-200/90">
                                      Category is off. Enable it above to activate feature toggles.
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* LOGS */}
                    {subtab === "logs" ? (
                      <div className="space-y-4">
                        <SectionTitle title="Logs" subtitle="Choose where WoC writes records." />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="woc-card p-4">
                            <div className="font-semibold text-sm">Enable logging</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">
                              Master switch for logs.
                            </div>
                            <input
                              type="checkbox"
                              className="mt-3"
                              checked={!!settings.logs?.enabled}
                              onChange={(e) => {
                                setSettings((s) => ({
                                  ...s,
                                  logs: { ...s.logs, enabled: e.target.checked },
                                }));
                                setDirty(true);
                              }}
                            />
                          </label>

                          <label className="woc-card p-4">
                            <div className="font-semibold text-sm">Prefix</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">
                              Short, sharp, easy to type.
                            </div>
                            <input
                              value={settings.prefix}
                              onChange={(e) => {
                                setSettings((s) => ({ ...s, prefix: e.target.value }));
                                setDirty(true);
                                woc?.setMood?.("playful");
                              }}
                              className="
                                mt-3 w-full px-3 py-2 rounded-2xl
                                border border-[var(--border-subtle)]/70
                                bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                                text-[var(--text-main)]
                                outline-none
                              "
                              maxLength={4}
                              placeholder="!"
                            />
                          </label>

                          {[
                            ["generalChannelId", "General logs channel"],
                            ["modlogChannelId", "Mod logs channel"],
                            ["joinChannelId", "Join logs channel"],
                            ["leaveChannelId", "Leave logs channel"],
                            ["commandChannelId", "Command logs channel"],
                            ["editChannelId", "Edit logs channel"],
                            ["messageChannelId", "Message logs channel"],
                            ["roleChannelId", "Role logs channel"],
                            ["nicknameChannelId", "Nickname logs channel"],
                          ].map(([k, label]) => (
                            <div key={k} className="woc-card p-4">
                              <div className="font-semibold text-sm">{label}</div>
                              <div className="text-xs text-[var(--text-muted)] mt-1">
                                Pick a channel. (Empty means unrouted.)
                              </div>

                              <ChannelPicker
                                channels={textChannels}
                                value={settings.logs?.[k] || ""}
                                disabled={!gateInstalled || channelsLoading}
                                onChange={(val) => {
                                  setSettings((s) => ({
                                    ...s,
                                    logs: { ...s.logs, [k]: val },
                                  }));
                                  setDirty(true);
                                }}
                                noneLabel="None"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* WELCOME */}
{subtab === "welcome" ? (
  <div className="space-y-4">
    <WelcomeModule
      guildId={canonicalGuildId}
      settings={settings}
      onChange={(nextSettings) => {
        setSettings(nextSettings);
        setDirty(true);

        // optional: if you want the dashboard-level preview bust to refresh too
        setWelcomePreviewBust(Date.now());
        setWelcomePreviewError("");
      }}
      channels={channels}
      premiumActive={premiumActive}
      premiumTier={premiumTier}
      freeBackgrounds={WELCOME_BG_FREE_OPTIONS}
      premiumBackgrounds={WELCOME_BG_PREMIUM_OPTIONS}
    />
  </div>
) : null}




                    {/* ACTION LOG */}
                    {subtab === "actionlog" ? (
                      <div className="space-y-3">
                        <SectionTitle
                          title="Action log"
                          subtitle="Soon: admin actions, toggles changed, mod events."
                        />
                        <div className="woc-card p-4 text-sm text-[var(--text-muted)]">
                          No entries yet. The chronicle is empty.
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
