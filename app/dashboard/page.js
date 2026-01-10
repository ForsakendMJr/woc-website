// app/dashboard/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useWocTheme } from "../WocThemeProvider";

const LS = { selectedGuild: "woc-selected-guild" };

// Endpoints (App Router)
const GUILDS_ENDPOINT = "/api/discord/guilds";
const STATUS_ENDPOINT = (gid) => `/api/guilds/${encodeURIComponent(gid)}/status`;
const SETTINGS_ENDPOINT = (gid) => `/api/guilds/${encodeURIComponent(gid)}/settings`;
const CHANNELS_ENDPOINT = (gid) => `/api/guilds/${encodeURIComponent(gid)}/channels`;

// Fallback endpoint (some builds use this style)
const DISCORD_CHANNELS_FALLBACK = (gid) =>
  `/api/discord/channels?guildId=${encodeURIComponent(gid)}`;

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
        <span className="text-xs font-semibold text-[var(--text-muted)]">{label}</span>
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
            <div className="px-3 py-3 text-sm text-[var(--text-muted)]">No servers found.</div>
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
      {allowNone ? <option value="">{noneLabel}</option> : <option value="">{placeholder}</option>}
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
      { key: "cuddle", label: "Cuddle", desc: "Cuddle interactions." },
      { key: "pat", label: "Pat", desc: "Pat interactions." },
      { key: "slap", label: "Slap interactions." },
      { key: "punch", label: "Punch interactions." },
      { key: "poke", label: "Poke interactions." },
      { key: "bite", label: "Bite interactions." },
      { key: "tickle", label: "Tickle interactions." },
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
      { key: "partner", label: "Partner", desc: "Partner system." },
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
    if (typeof out[catKey].enabled !== "boolean") out[catKey].enabled = defCat.enabled;

    if (!out[catKey].subs || typeof out[catKey].subs !== "object") out[catKey].subs = {};
    for (const [subKey, defVal] of Object.entries(defCat.subs || {})) {
      if (typeof out[catKey].subs[subKey] !== "boolean") out[catKey].subs[subKey] = defVal;
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

function ensureWelcomeDefaults(welcome) {
  const w = welcome && typeof welcome === "object" ? deepClone(welcome) : {};
  if (typeof w.enabled !== "boolean") w.enabled = false;
  if (typeof w.type !== "string") w.type = "message"; // message | embed | embed+text | card
  if (typeof w.channelId !== "string") w.channelId = "";
  if (typeof w.message !== "string") w.message = "Welcome {user} to **{server}**! ✨";
  if (typeof w.autoRoleId !== "string") w.autoRoleId = "";

  // Embed config (Dyno-ish starter)
  w.embed ||= {};
  if (typeof w.embed.title !== "string") w.embed.title = "Welcome!";
  if (typeof w.embed.description !== "string")
    w.embed.description = "Welcome {user} to **{server}**!";
  if (typeof w.embed.color !== "string") w.embed.color = "#7c3aed";
  if (typeof w.embed.thumbnailUrl !== "string") w.embed.thumbnailUrl = "{avatar}";
  if (typeof w.embed.imageUrl !== "string") w.embed.imageUrl = "";
  if (typeof w.embed.footerText !== "string") w.embed.footerText = "Member #{membercount}";
  if (typeof w.embed.authorName !== "string") w.embed.authorName = "{server}";
  if (typeof w.embed.authorIconUrl !== "string") w.embed.authorIconUrl = "";

  // Card config (Mee6-ish starter)
  w.card ||= {};
  if (typeof w.card.enabled !== "boolean") w.card.enabled = false;
  if (typeof w.card.title !== "string") w.card.title = "{username} just joined the server";
  if (typeof w.card.subtitle !== "string") w.card.subtitle = "Member #{membercount}";
  if (typeof w.card.backgroundColor !== "string") w.card.backgroundColor = "#0b1020";
  if (typeof w.card.textColor !== "string") w.card.textColor = "#ffffff";
  if (typeof w.card.overlayOpacity !== "number") w.card.overlayOpacity = 0.35;

  // If type is card, keep card enabled in sync
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
    }),
    modules: defaultModules,
    personality: { mood: "story", sass: 35, narration: true },
  };
}

export default function DashboardPage() {
  let woc = null;
  try {
    woc = useWocTheme();
  } catch {
    woc = null;
  }

  const { status } = useSession();
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
        const data = await fetchJson(GUILDS_ENDPOINT, { cache: "no-store", signal: ac.signal });

        const list = Array.isArray(data.guilds) ? data.guilds : [];
        setGuilds(list);

        const warn = safeErrorMessage(data.warning || data.error || "");
        if (warn) setGuildWarn(warn);

        const raw = String(selectedGuildIdRaw || safeGet(LS.selectedGuild, "") || "").trim();
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
      const data = await fetchJson(CHANNELS_ENDPOINT(gid), { cache: "no-store", signal });
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
        const data2 = await fetchJson(DISCORD_CHANNELS_FALLBACK(gid), { cache: "no-store", signal });
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
        const { channels: list, warning } = await fetchChannelsForGuild(canonicalGuildId, ac.signal);
        setChannels(list);
        setChannelsWarn(warning && warning !== "Missing/invalid guildId." ? warning : "");
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
        data?.settings && typeof data.settings === "object" ? data.settings : safeSettings;
      const mergedModules = mergeModuleDefaults(incoming.modules, defaults);

      setSettings({
        ...incoming,
        guildId: canonicalGuildId,
        modules: mergedModules,
        welcome: ensureWelcomeDefaults(incoming.welcome),
      });
      setDirty(false);
      showToast("Settings sealed. ✅", "playful");
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

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="woc-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)] max-w-3xl">
              WoC’s control room. Choose a server, then tune modules, logs, welcome, moderation, and personality.
            </p>
            <p className="mt-2 text-[0.78rem] text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-main)]">WOC whisper:</span> {moodWhisper}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/vote" className="woc-btn-ghost text-xs sm:text-sm">
              Vote page 🗳️
            </Link>
          </div>
        </div>

        {toast ? (
          <div className="mt-5 woc-card p-3 animate-fadeIn">
            <div className="text-sm">{toast}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 text-sm text-[var(--text-muted)]">Loading your portal…</div>
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
                      {install.installed === true ? <Pill tone="ok">Installed ✅</Pill> : null}
                      {install.installed === false ? <Pill tone="warn">Not installed 🔒</Pill> : null}
                      {!isSnowflake(canonicalGuildId) ? <Pill tone="warn">Pick a server</Pill> : null}
                      <button type="button" className="woc-btn-ghost text-xs" onClick={resetSelectedGuild}>
                        Reset selection
                      </button>
                    </div>
                  }
                />

                {guildWarn ? (
                  <div className="mt-4 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    <div className="font-semibold">Guild list notice</div>
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">{guildWarn}</div>
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
                    }}
                  />
                </div>

                {process.env.NODE_ENV !== "production" && isSnowflake(canonicalGuildId) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a className="woc-btn-ghost text-xs" href={debugStatusUrl} target="_blank" rel="noreferrer">
                      Open status JSON
                    </a>
                    <a className="woc-btn-ghost text-xs" href={debugChannelsUrl} target="_blank" rel="noreferrer">
                      Open channels JSON
                    </a>
                  </div>
                ) : null}

                {install.warning ? (
                  <div className="mt-4 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    <div className="font-semibold">Gate notice</div>
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">{install.warning}</div>
                  </div>
                ) : null}

                {channelsWarn && isSnowflake(canonicalGuildId) && gateInstalled ? (
                  <div className="mt-4 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    <div className="font-semibold">Channel list notice</div>
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">{channelsWarn}</div>
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
                        !hasClientId || !isSnowflake(canonicalGuildId) ? "opacity-60 cursor-not-allowed" : ""
                      )}
                      href={hasClientId && isSnowflake(canonicalGuildId) ? buildBotInviteUrl(canonicalGuildId) : undefined}
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
                    disabled={!gateInstalled || !dirty || settingsLoading || !isSnowflake(canonicalGuildId)}
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
                              <div className="text-lg font-semibold mt-1">{settings.personality?.mood}</div>
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
                              <span className="text-[0.72rem] text-[var(--text-muted)]">Category</span>
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
                              const catEnabled = isModuleEnabled(settings.modules, activeCategory.key);
                              const subEnabled = isSubEnabled(settings.modules, activeCategory.key, s.key);

                              return (
                                <div key={s.key} className="woc-card p-4 flex flex-col justify-between">
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
                                          setSubEnabled(activeCategory.key, s.key, e.target.checked);
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
                            <div className="text-xs text-[var(--text-muted)] mt-1">Master switch for logs.</div>
                            <input
                              type="checkbox"
                              className="mt-3"
                              checked={!!settings.logs?.enabled}
                              onChange={(e) => {
                                setSettings((s) => ({ ...s, logs: { ...s.logs, enabled: e.target.checked } }));
                                setDirty(true);
                              }}
                            />
                          </label>

                          <label className="woc-card p-4">
                            <div className="font-semibold text-sm">Prefix</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">Short, sharp, easy to type.</div>
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
                                  setSettings((s) => ({ ...s, logs: { ...s.logs, [k]: val } }));
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
                        <SectionTitle title="Welcome" subtitle="Welcome channel + message template + autorole." />

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="woc-card p-4">
                            <div className="font-semibold text-sm">Enable welcome</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">Turns on welcome posts.</div>
                            <input
                              type="checkbox"
                              className="mt-3"
                              checked={!!settings.welcome?.enabled}
                              onChange={(e) => {
                                setSettings((s) => ({ ...s, welcome: { ...s.welcome, enabled: e.target.checked } }));
                                setDirty(true);
                              }}
                            />
                          </label>

                          <div className="woc-card p-4">
                            <div className="font-semibold text-sm">Welcome channel</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">
                              Where the welcome message is posted.
                            </div>

                            <ChannelPicker
                              channels={textChannels}
                              value={settings.welcome?.channelId || ""}
                              disabled={!gateInstalled || channelsLoading}
                              onChange={(val) => {
                                setSettings((s) => ({ ...s, welcome: { ...s.welcome, channelId: val } }));
                                setDirty(true);
                              }}
                              allowNone={false}
                              placeholder="Select a channel"
                            />
                          </div>

                          {/* Message type selector */}
                          <div className="woc-card p-4 sm:col-span-2">
                            <div className="font-semibold text-sm mb-2">Message type</div>

                            <div className="flex flex-wrap gap-2">
                              {[
                                ["message", "Message"],
                                ["embed", "Embed"],
                                ["embed+text", "Embed + Text"],
                                ["card", "Card"],
                              ].map(([val, label]) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => {
                                    setSettings((s) => ({
                                      ...s,
                                      welcome: {
                                        ...s.welcome,
                                        type: val,
                                        card: {
                                          ...s.welcome.card,
                                          enabled: val === "card",
                                        },
                                      },
                                    }));
                                    setDirty(true);
                                  }}
                                  className={cx(
                                    "px-3 py-2 rounded-full border text-xs",
                                    "border-[var(--border-subtle)]/70",
                                    settings.welcome?.type === val
                                      ? "bg-[color-mix(in_oklab,var(--accent-soft)_55%,transparent)]"
                                      : "bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]"
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>

                            <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                              Tokens: {"{user}"} {"{server}"} {"{username}"} {"{tag}"} {"{membercount}"} {"{id}"} {"{avatar}"}
                            </div>
                          </div>

                          {/* Text message editor (Message or Embed + Text) */}
                          {["message", "embed+text"].includes(settings.welcome?.type || "message") ? (
                            <label className="woc-card p-4 sm:col-span-2">
                              <div className="font-semibold text-sm">Welcome message</div>
                              <div className="text-xs text-[var(--text-muted)] mt-1">
                                Tokens: <b>{"{user}"}</b>, <b>{"{server}"}</b>, <b>{"{membercount}"}</b>
                              </div>
                              <textarea
                                value={settings.welcome?.message || ""}
                                onChange={(e) => {
                                  setSettings((s) => ({ ...s, welcome: { ...s.welcome, message: e.target.value } }));
                                  setDirty(true);
                                }}
                                className="
                                  mt-3 w-full px-3 py-2 rounded-2xl min-h-[90px]
                                  border border-[var(--border-subtle)]/70
                                  bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                                  text-[var(--text-main)]
                                  outline-none
                                "
                                placeholder="Welcome {user} to {server}!"
                              />
                            </label>
                          ) : null}

                          {/* Embed editor (Embed or Embed + Text) */}
                          {["embed", "embed+text"].includes(settings.welcome?.type || "message") ? (
                            <div className="woc-card p-4 sm:col-span-2 space-y-3">
                              <div className="font-semibold text-sm">Embed options</div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <label>
                                  <div className="text-xs mb-1 text-[var(--text-muted)]">Title</div>
                                  <input
                                    value={settings.welcome?.embed?.title || ""}
                                    onChange={(e) => {
                                      setSettings((s) => ({
                                        ...s,
                                        welcome: { ...s.welcome, embed: { ...s.welcome.embed, title: e.target.value } },
                                      }));
                                      setDirty(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                                  />
                                </label>

                                <label>
                                  <div className="text-xs mb-1 text-[var(--text-muted)]">Color</div>
                                  <input
                                    type="color"
                                    value={settings.welcome?.embed?.color || "#7c3aed"}
                                    onChange={(e) => {
                                      setSettings((s) => ({
                                        ...s,
                                        welcome: { ...s.welcome, embed: { ...s.welcome.embed, color: e.target.value } },
                                      }));
                                      setDirty(true);
                                    }}
                                  />
                                </label>

                                <label className="sm:col-span-2">
                                  <div className="text-xs mb-1 text-[var(--text-muted)]">Description</div>
                                  <textarea
                                    value={settings.welcome?.embed?.description || ""}
                                    onChange={(e) => {
                                      setSettings((s) => ({
                                        ...s,
                                        welcome: {
                                          ...s.welcome,
                                          embed: { ...s.welcome.embed, description: e.target.value },
                                        },
                                      }));
                                      setDirty(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none min-h-[90px]"
                                  />
                                </label>

                                <label>
                                  <div className="text-xs mb-1 text-[var(--text-muted)]">Thumbnail URL</div>
                                  <input
                                    value={settings.welcome?.embed?.thumbnailUrl || ""}
                                    onChange={(e) => {
                                      setSettings((s) => ({
                                        ...s,
                                        welcome: {
                                          ...s.welcome,
                                          embed: { ...s.welcome.embed, thumbnailUrl: e.target.value },
                                        },
                                      }));
                                      setDirty(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                                    placeholder="{avatar}"
                                  />
                                </label>

                                <label>
                                  <div className="text-xs mb-1 text-[var(--text-muted)]">Image URL</div>
                                  <input
                                    value={settings.welcome?.embed?.imageUrl || ""}
                                    onChange={(e) => {
                                      setSettings((s) => ({
                                        ...s,
                                        welcome: {
                                          ...s.welcome,
                                          embed: { ...s.welcome.embed, imageUrl: e.target.value },
                                        },
                                      }));
                                      setDirty(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                                    placeholder="https://..."
                                  />
                                </label>

                                <label>
                                  <div className="text-xs mb-1 text-[var(--text-muted)]">Footer</div>
                                  <input
                                    value={settings.welcome?.embed?.footerText || ""}
                                    onChange={(e) => {
                                      setSettings((s) => ({
                                        ...s,
                                        welcome: {
                                          ...s.welcome,
                                          embed: { ...s.welcome.embed, footerText: e.target.value },
                                        },
                                      }));
                                      setDirty(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                                    placeholder="Member #{membercount}"
                                  />
                                </label>

                                <label>
                                  <div className="text-xs mb-1 text-[var(--text-muted)]">Author name</div>
                                  <input
                                    value={settings.welcome?.embed?.authorName || ""}
                                    onChange={(e) => {
                                      setSettings((s) => ({
                                        ...s,
                                        welcome: {
                                          ...s.welcome,
                                          embed: { ...s.welcome.embed, authorName: e.target.value },
                                        },
                                      }));
                                      setDirty(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                                    placeholder="{server}"
                                  />
                                </label>
                              </div>
                            </div>
                          ) : null}

                          {/* Card editor */}
                          {settings.welcome?.type === "card" ? (
                            <div className="woc-card p-5 sm:col-span-2">
                              <div className="font-semibold text-sm">Welcome card</div>
                              <div className="text-xs text-[var(--text-muted)] mt-1">
                                Sends a visual welcome card when a member joins.
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                                <label>
                                  <div className="text-xs mb-1 text-[var(--text-muted)]">Title</div>
                                  <input
                                    value={settings.welcome?.card?.title || ""}
                                    onChange={(e) => {
                                      setSettings((s) => ({
                                        ...s,
                                        welcome: {
                                          ...s.welcome,
                                          card: { ...s.welcome.card, title: e.target.value },
                                        },
                                      }));
                                      setDirty(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                                  />
                                </label>

                                <label>
                                  <div className="text-xs mb-1 text-[var(--text-muted)]">Subtitle</div>
                                  <input
                                    value={settings.welcome?.card?.subtitle || ""}
                                    onChange={(e) => {
                                      setSettings((s) => ({
                                        ...s,
                                        welcome: {
                                          ...s.welcome,
                                          card: { ...s.welcome.card, subtitle: e.target.value },
                                        },
                                      }));
                                      setDirty(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                                  />
                                </label>

                                <label className="flex items-center gap-3">
                                  <div>
                                    <div className="text-xs mb-1 text-[var(--text-muted)]">Background</div>
                                    <input
                                      type="color"
                                      value={settings.welcome?.card?.backgroundColor || "#0b1020"}
                                      onChange={(e) => {
                                        setSettings((s) => ({
                                          ...s,
                                          welcome: {
                                            ...s.welcome,
                                            card: { ...s.welcome.card, backgroundColor: e.target.value },
                                          },
                                        }));
                                        setDirty(true);
                                      }}
                                    />
                                  </div>
                                </label>

                                <label className="flex items-center gap-3">
                                  <div>
                                    <div className="text-xs mb-1 text-[var(--text-muted)]">Text color</div>
                                    <input
                                      type="color"
                                      value={settings.welcome?.card?.textColor || "#ffffff"}
                                      onChange={(e) => {
                                        setSettings((s) => ({
                                          ...s,
                                          welcome: {
                                            ...s.welcome,
                                            card: { ...s.welcome.card, textColor: e.target.value },
                                          },
                                        }));
                                        setDirty(true);
                                      }}
                                    />
                                  </div>
                                </label>

                                <label className="sm:col-span-2">
                                  <div className="text-xs mb-1 text-[var(--text-muted)]">
                                    Overlay opacity:{" "}
                                    <span className="font-semibold text-[var(--text-main)]">
                                      {Number(settings.welcome?.card?.overlayOpacity ?? 0.35).toFixed(2)}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={settings.welcome?.card?.overlayOpacity ?? 0.35}
                                    onChange={(e) => {
                                      setSettings((s) => ({
                                        ...s,
                                        welcome: {
                                          ...s.welcome,
                                          card: { ...s.welcome.card, overlayOpacity: Number(e.target.value) },
                                        },
                                      }));
                                      setDirty(true);
                                    }}
                                    className="w-full"
                                  />
                                </label>
                              </div>
                            </div>
                          ) : null}

                          <label className="woc-card p-4 sm:col-span-2">
                            <div className="font-semibold text-sm">Auto role ID</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">
                              Optional: role to assign to new members.
                            </div>
                            <input
                              value={settings.welcome?.autoRoleId || ""}
                              onChange={(e) => {
                                setSettings((s) => ({ ...s, welcome: { ...s.welcome, autoRoleId: e.target.value } }));
                                setDirty(true);
                              }}
                              className="
                                mt-3 w-full px-3 py-2 rounded-2xl
                                border border-[var(--border-subtle)]/70
                                bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                                text-[var(--text-main)]
                                outline-none
                              "
                              placeholder="e.g. 123456789012345678"
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}

                    {/* MODERATION */}
                    {subtab === "moderation" ? (
                      <div className="space-y-4">
                        <SectionTitle title="Moderation" subtitle="Toggle mod systems." />
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            ["enabled", "Moderation enabled", "Master switch for mod commands."],
                            ["automod", "AutoMod", "Basic filters and actions (wire rules later)."],
                            ["antiLink", "Anti-link", "Block invite links and suspicious URLs."],
                            ["antiSpam", "Anti-spam", "Rate limit repeated messages."],
                          ].map(([key, label, hint]) => (
                            <label
                              key={key}
                              className="woc-card p-4 flex items-start justify-between gap-3 cursor-pointer"
                            >
                              <div>
                                <div className="font-semibold text-sm">{label}</div>
                                <div className="text-xs text-[var(--text-muted)] mt-1">{hint}</div>
                              </div>

                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={!!settings.moderation?.[key]}
                                onChange={(e) => {
                                  setSettings((s) => ({
                                    ...s,
                                    moderation: { ...s.moderation, [key]: e.target.checked },
                                  }));
                                  setDirty(true);
                                  woc?.setMood?.(e.target.checked ? "battle" : "story");
                                }}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* PERSONALITY */}
                    {subtab === "personality" ? (
                      <div className="space-y-4">
                        <SectionTitle title="WoC personality" subtitle="Keep the dashboard alive." />

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="woc-card p-4">
                            <div className="font-semibold text-sm">Mood</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">
                              Influences dashboard vibe now (and bot responses later).
                            </div>

                            <select
                              value={settings.personality?.mood || "story"}
                              onChange={(e) => {
                                const m = e.target.value;
                                setSettings((s) => ({ ...s, personality: { ...s.personality, mood: m } }));
                                setDirty(true);
                                woc?.setMood?.(m);
                                showToast(`Mood shifted: ${m}`, m);
                              }}
                              className="
                                mt-3 w-full px-3 py-2 rounded-2xl
                                border border-[var(--border-subtle)]/70
                                bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                                text-[var(--text-main)]
                                outline-none
                              "
                            >
                              {["neutral", "battle", "playful", "story", "omen", "flustered"].map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="woc-card p-4">
                            <div className="font-semibold text-sm">Sass level</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">
                              0 = polite librarian, 100 = chaotic bard.
                            </div>

                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={Number(settings.personality?.sass ?? 35)}
                              onChange={(e) => {
                                setSettings((s) => ({
                                  ...s,
                                  personality: { ...s.personality, sass: Number(e.target.value) },
                                }));
                                setDirty(true);
                                woc?.setMood?.("playful");
                              }}
                              className="mt-3 w-full"
                            />

                            <div className="mt-2 text-xs text-[var(--text-muted)]">
                              Current:{" "}
                              <span className="font-semibold text-[var(--text-main)]">
                                {Number(settings.personality?.sass ?? 35)}
                              </span>
                            </div>
                          </label>

                          <label className="woc-card p-4 flex items-start justify-between gap-3 cursor-pointer sm:col-span-2">
                            <div>
                              <div className="font-semibold text-sm">Narration mode</div>
                              <div className="text-xs text-[var(--text-muted)] mt-1">
                                Adds story flavor to announcements/logs (later: bot output style).
                              </div>
                            </div>

                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={!!settings.personality?.narration}
                              onChange={(e) => {
                                setSettings((s) => ({
                                  ...s,
                                  personality: { ...s.personality, narration: e.target.checked },
                                }));
                                setDirty(true);
                                woc?.setMood?.(e.target.checked ? "story" : "neutral");
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}

                    {/* ACTION LOG */}
                    {subtab === "actionlog" ? (
                      <div className="space-y-3">
                        <SectionTitle title="Action log" subtitle="Soon: admin actions, toggles changed, mod events." />
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
