// app/dashboard/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useWocTheme } from "../WocThemeProvider";

const LS = { selectedGuild: "woc-selected-guild" };

// Endpoints (App Router)
const GUILDS_ENDPOINT = "/api/discord/guilds";
const STATUS_ENDPOINT = (gid) => `/api/guilds/${gid}/status`;
const SETTINGS_ENDPOINT = (gid) => `/api/guilds/${gid}/settings`;

function safeGet(key, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}

function safeErrorMessage(input) {
  const msg = String(input || "").trim();
  if (!msg) return "";
  const looksLikeHtml =
    msg.includes("<!DOCTYPE") ||
    msg.includes("<html") ||
    msg.includes("<body") ||
    msg.includes("<head");
  if (looksLikeHtml) return "Non-JSON/HTML response received (route missing or misrouted).";
  return msg.length > 260 ? msg.slice(0, 260) + "…" : msg;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    const e = new Error(safeErrorMessage(txt || `Non-JSON response (${res.status})`));
    e.status = res.status;
    throw e;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const e = new Error(safeErrorMessage(data?.error || data?.warning || `Request failed (${res.status})`));
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
    <span className={cx("text-[0.72rem] px-2 py-1 rounded-full border", tones[tone] || tones.default)}>
      {children}
    </span>
  );
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="font-semibold">{title}</div>
        {subtitle ? <div className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</div> : null}
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
        <img src={url} alt={guild?.name || "Server icon"} className="w-full h-full object-cover" />
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
            <div className="text-sm font-semibold truncate">{selected?.name || "Select a server"}</div>
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
                  active ? "bg-[color-mix(in_oklab,var(--accent-soft)_45%,transparent)]" : ""
                )}
              >
                <IconCircle guild={g} size={34} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{g.name}</div>
                  <div className="text-[0.72rem] text-[var(--text-muted)] truncate">{g.role || "Manager"}</div>
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

/**
 * Modules based on your command folders.
 * Each category has sub-modules that map to “features” you’ll wire later.
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
      { key: "craft", label: "Craft", desc: "Crafting." },
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
      { key: "slap", label: "Slap", desc: "Slap interactions." },
      { key: "punch", label: "Punch", desc: "Punch interactions." },
      { key: "poke", label: "Poke", desc: "Poke interactions." },
      { key: "bite", label: "Bite", desc: "Bite interactions." },
      { key: "tickle", label: "Tickle", desc: "Tickle interactions." },
      { key: "baka", label: "Baka", desc: "Baka interactions." },
      { key: "smug", label: "Smug", desc: "Smug interactions." },
      { key: "chase", label: "Chase", desc: "Chase interactions." },
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
      { key: "premium", label: "Premium", desc: "Premium tools." },
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
    subs: [{ key: "applications", label: "Applications", desc: "Application module." }],
  },
];

function ensureDefaultSettings(selectedGuildId) {
  return {
    guildId: selectedGuildId,
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
    modules: MODULE_TREE.reduce((acc, cat) => {
      acc[cat.key] = {
        enabled: cat.key === "moderation" || cat.key === "logging" || cat.key === "utility",
        subs: (cat.subs || []).reduce((m, s) => {
          m[s.key] = true;
          return m;
        }, {}),
      };
      return acc;
    }, {}),
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
  const [selectedGuildId, setSelectedGuildId] = useState(() => safeGet(LS.selectedGuild, ""));

  const selectedGuild = useMemo(
    () => guilds.find((g) => String(g.id) === String(selectedGuildId)) || null,
    [guilds, selectedGuildId]
  );

  const [install, setInstall] = useState({
    loading: false,
    installed: null,
    warning: "",
  });

  const [subtab, setSubtab] = useState("overview"); // overview | modules | logs | welcome | moderation | personality | actionlog
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [dirty, setDirty] = useState(false);

  const guildFetchOnceRef = useRef(false);
  const guildAbortRef = useRef(null);
  const perGuildAbortRef = useRef(null);

  // Modules panel UI state
  const [moduleCategory, setModuleCategory] = useState("moderation");
  const [moduleSearch, setModuleSearch] = useState("");

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "";
  const inviteLinkForGuild = (gid) =>
    `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=8&guild_id=${gid}&disable_guild_select=true`;

  function showToast(msg, mood = "playful") {
    setToast(msg);
    if (woc?.setMood) woc.setMood(mood);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (guildAbortRef.current) guildAbortRef.current.abort();
      if (perGuildAbortRef.current) perGuildAbortRef.current.abort();
    };
  }, []);

  // Load manageable guilds (once per authed session)
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

        if (list.length) setGuilds(list);

        const saved = safeGet(LS.selectedGuild, "");
        const exists = list.find((g) => String(g.id) === String(saved));
        const first = list[0]?.id || "";
        const pick = exists ? saved : String(first || "");

        if (pick) {
          setSelectedGuildId(pick);
          safeSet(LS.selectedGuild, pick);
        }

        const warn = safeErrorMessage(data.warning || data.error || "");
        if (warn) setGuildWarn(warn);
      } catch (e) {
        if (e?.name === "AbortError") return;
        setGuildWarn(safeErrorMessage(e?.message || "Failed to load guilds."));
      }
    })();
  }, [authed]);

  // On guild change: install gate + settings
  useEffect(() => {
    if (!authed) return;
    if (!selectedGuildId) return;

    safeSet(LS.selectedGuild, selectedGuildId);
    setDirty(false);

    if (perGuildAbortRef.current) perGuildAbortRef.current.abort();
    const ac = new AbortController();
    perGuildAbortRef.current = ac;

    // install check (soft warnings)
    setInstall((s) => ({ ...s, loading: true, warning: "" }));
    (async () => {
      try {
        const data = await fetchJson(STATUS_ENDPOINT(selectedGuildId), { cache: "no-store", signal: ac.signal });
        const warn = safeErrorMessage(data?.warning || "");
        setInstall({ loading: false, installed: data?.installed ?? null, warning: warn });

        if (data?.installed === true) showToast("Gate open. WoC is present. ✨", "story");
        else if (data?.installed === false) showToast("Gate closed. Invite WoC to awaken controls. 🔒", "omen");
      } catch (e) {
        if (e?.name === "AbortError") return;
        setInstall({ loading: false, installed: null, warning: safeErrorMessage(e?.message || "Gate check unavailable.") });
      }
    })();

    // settings fetch
    setSettingsLoading(true);
    setSettings(null);

    (async () => {
      try {
        const data = await fetchJson(SETTINGS_ENDPOINT(selectedGuildId), { cache: "no-store", signal: ac.signal });
        setSettings(data.settings);
      } catch (e) {
        if (e?.name === "AbortError") return;
        setSettings(ensureDefaultSettings(selectedGuildId));
      } finally {
        if (!ac.signal.aborted) setSettingsLoading(false);
      }
    })();
  }, [authed, selectedGuildId]);

  async function saveSettings() {
    if (!selectedGuildId || !settings) return;
    setSettingsLoading(true);
    try {
      const data = await fetchJson(SETTINGS_ENDPOINT(selectedGuildId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSettings(data.settings);
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
    return subs.filter((s) => (s.label + " " + s.desc).toLowerCase().includes(q) || s.key.toLowerCase().includes(q));
  }, [activeCategory, moduleSearch]);

  function setModuleEnabled(categoryKey, enabled) {
    setSettings((prev) => {
      const next = structuredClone(prev);
      next.modules ||= {};
      next.modules[categoryKey] ||= { enabled: false, subs: {} };
      next.modules[categoryKey].enabled = !!enabled;
      return next;
    });
    setDirty(true);
  }

  function setSubEnabled(categoryKey, subKey, enabled) {
    setSettings((prev) => {
      const next = structuredClone(prev);
      next.modules ||= {};
      next.modules[categoryKey] ||= { enabled: true, subs: {} };
      next.modules[categoryKey].subs ||= {};
      next.modules[categoryKey].subs[subKey] = !!enabled;
      return next;
    });
    setDirty(true);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="woc-card p-6 sm:p-8">
        {/* Header */}
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

        {/* Toast */}
        {toast ? (
          <div className="mt-5 woc-card p-3 animate-fadeIn">
            <div className="text-sm">{toast}</div>
          </div>
        ) : null}

        {/* Auth states */}
        {loading ? (
          <div className="mt-8 text-sm text-[var(--text-muted)]">Loading your portal…</div>
        ) : !authed ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="woc-card p-5">
              <SectionTitle title="Step 1: Invite WoC" subtitle="Invite first so the dashboard can control something real." />
              <a
                className="mt-4 inline-flex w-full justify-center items-center gap-2 woc-btn-primary"
                href="https://discord.com/oauth2/authorize"
                target="_blank"
                rel="noreferrer"
              >
                Add WoC to Discord <span className="text-base">➕</span>
              </a>
            </div>

            <div className="woc-card p-5">
              <SectionTitle title="Step 2: Sign in" subtitle="Sign in with Discord so we can see what you manage." />
              <button onClick={() => signIn("discord")} className="mt-4 inline-flex w-full justify-center items-center gap-2 woc-btn-ghost">
                Sign in with Discord <span>🔐</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Server selector row */}
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="woc-card p-5 lg:col-span-2">
                <SectionTitle
                  title="Server selector"
                  subtitle="Only servers you own/admin appear. Icons included. ✨"
                  right={
                    <div className="flex items-center gap-2">
                      {install.loading ? <Pill>Checking gate…</Pill> : null}
                      {install.installed === true ? <Pill tone="ok">Installed ✅</Pill> : null}
                      {install.installed === false ? <Pill tone="warn">Not installed 🔒</Pill> : null}
                      {guildWarn || install.warning ? <Pill tone="warn">Notice ⚠️</Pill> : null}
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
                    value={selectedGuildId}
                    disabled={!guilds.length}
                    onChange={(gid) => {
                      setSelectedGuildId(gid);
                      setSubtab("overview");
                      woc?.setMood?.("story");
                    }}
                  />
                </div>

                {install.warning ? (
                  <div className="mt-4 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    <div className="font-semibold">Gate notice</div>
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">{install.warning}</div>
                  </div>
                ) : null}

                {install.installed === false ? (
                  <div className="mt-4 woc-card p-4">
                    <div className="text-sm font-semibold">Invite gate</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      WoC can’t manage what it can’t see. Invite the bot to <b>{selectedGuild?.name}</b> to unlock controls.
                    </div>

                    <a
                      className={cx("mt-3 inline-flex items-center gap-2 woc-btn-primary", !clientId ? "opacity-60 cursor-not-allowed" : "")}
                      href={clientId ? inviteLinkForGuild(selectedGuildId) : undefined}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => woc?.setMood?.("battle")}
                      title={clientId ? "Invite WoC to this server" : "Set NEXT_PUBLIC_DISCORD_CLIENT_ID in env"}
                    >
                      Invite WoC to this server <span>➕</span>
                    </a>

                    {!clientId ? (
                      <div className="mt-2 text-[0.72rem] text-rose-200/90">Missing NEXT_PUBLIC_DISCORD_CLIENT_ID. Add it to Vercel env and redeploy.</div>
                    ) : (
                      <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">Once invited, refresh this page. Gate opens automatically.</div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Save panel */}
              <div className="woc-card p-5">
                <SectionTitle title="Control seal" subtitle="Changes persist per server." />
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    className={cx("woc-btn-primary", !gateInstalled || !dirty || settingsLoading ? "opacity-60 cursor-not-allowed" : "")}
                    disabled={!gateInstalled || !dirty || settingsLoading}
                    onClick={saveSettings}
                    title={!gateInstalled ? "Invite WoC to unlock saving." : !dirty ? "No changes yet." : "Save changes"}
                  >
                    {settingsLoading ? "Saving…" : dirty ? "Save changes ✅" : "Saved"}
                  </button>

                  <div className="text-[0.72rem] text-[var(--text-muted)]">
                    {gateInstalled ? (dirty ? "WoC is watching. Commit the ritual." : "All quiet. No edits pending.") : "Gate closed. Invite WoC to enable editing."}
                  </div>
                </div>
              </div>
            </div>

            {/* Servers grid (nice quick switch, like your reference image vibe) */}
            <div className="mt-6 woc-card p-5">
              <SectionTitle title="Servers" subtitle={`Servers you can manage (${guilds.length})`} />
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {guilds.slice(0, 12).map((g) => {
                  const active = String(g.id) === String(selectedGuildId);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGuildId(String(g.id));
                        setSubtab("overview");
                        woc?.setMood?.("story");
                      }}
                      className={cx(
                        "text-left rounded-3xl overflow-hidden border transition",
                        "border-[var(--border-subtle)]/70",
                        "bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]",
                        active ? "ring-2 ring-[var(--accent)]/40" : ""
                      )}
                    >
                      <div className="p-4 flex items-center gap-3">
                        <IconCircle guild={g} size={52} />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{g.name}</div>
                          <div className="text-xs text-[var(--text-muted)] truncate">{g.role || "Manager"}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {guilds.length > 12 ? (
                <div className="mt-3 text-[0.72rem] text-[var(--text-muted)]">Showing 12. Use the selector for the full list.</div>
              ) : null}
            </div>

            {/* Secondary navbar */}
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

              {!gateInstalled ? (
                <div className="mt-4 text-sm text-[var(--text-muted)]">Invite WoC to this server to unlock the dashboard systems.</div>
              ) : settingsLoading || !settings ? (
                <div className="mt-4 text-sm text-[var(--text-muted)]">Loading settings…</div>
              ) : (
                <div className="mt-5">
                  {/* OVERVIEW */}
                  {subtab === "overview" ? (
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="woc-card p-4 lg:col-span-2">
                        <div className="font-semibold">Server snapshot</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">Live settings in Mongo.</div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Prefix</div>
                            <div className="text-lg font-semibold mt-1">{settings.prefix}</div>
                          </div>
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Welcome</div>
                            <div className="text-lg font-semibold mt-1">{settings.welcome?.enabled ? "On" : "Off"}</div>
                          </div>
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Logs</div>
                            <div className="text-lg font-semibold mt-1">{settings.logs?.enabled ? "On" : "Off"}</div>
                          </div>
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Mood</div>
                            <div className="text-lg font-semibold mt-1">{settings.personality?.mood}</div>
                          </div>
                        </div>
                      </div>

                      <div className="woc-card p-4">
                        <div className="font-semibold">WoC whisper</div>
                        <div className="text-xs text-[var(--text-muted)] mt-2">“A server is a living map. Modules are the weather. Choose wisely.”</div>
                        <div className="mt-3 text-[0.72rem] text-[var(--text-muted)]">Next step: wire bot runtime to respect these flags.</div>
                      </div>
                    </div>
                  ) : null}

                  {/* MODULES (sidebar like your reference image) */}
                  {subtab === "modules" ? (
                    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                      <div className="woc-card p-4">
                        <div className="font-semibold">Modules</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">Pick a category on the left.</div>

                        <div className="mt-4 space-y-2">
                          {MODULE_TREE.map((cat) => {
                            const active = cat.key === moduleCategory;
                            const enabled = !!settings.modules?.[cat.key]?.enabled;
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
                                    <div className="text-[0.72rem] text-[var(--text-muted)] mt-1 truncate">{cat.desc}</div>
                                  </div>
                                  <span className={cx("text-[0.72rem] px-2 py-1 rounded-full border", enabled ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-amber-400/40 bg-amber-500/10 text-amber-100")}>
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
                            <div className="text-xs text-[var(--text-muted)] mt-1">{activeCategory?.desc}</div>
                          </div>

                          <label className="inline-flex items-center gap-2">
                            <span className="text-[0.72rem] text-[var(--text-muted)]">Category</span>
                            <input
                              type="checkbox"
                              checked={!!settings.modules?.[activeCategory.key]?.enabled}
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
                            const catEnabled = !!settings.modules?.[activeCategory.key]?.enabled;
                            const subEnabled = settings.modules?.[activeCategory.key]?.subs?.[s.key] ?? true;

                            return (
                              <div key={s.key} className="woc-card p-4 flex flex-col justify-between">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-semibold truncate">{s.label}</div>
                                    <div className="text-xs text-[var(--text-muted)] mt-1">{s.desc}</div>
                                    <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">Key: <span className="font-semibold text-[var(--text-main)]">{activeCategory.key}.{s.key}</span></div>
                                  </div>

                                  <label className="inline-flex items-center gap-2">
                                    <span className="text-[0.72rem] text-[var(--text-muted)]">{subEnabled ? "On" : "Off"}</span>
                                    <input
                                      type="checkbox"
                                      checked={!!subEnabled}
                                      disabled={!catEnabled}
                                      onChange={(e) => {
                                        setSubEnabled(activeCategory.key, s.key, e.target.checked);
                                        setDirty(true);
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

                        <div className="mt-4 text-[0.72rem] text-[var(--text-muted)]">
                          This panel controls feature flags. Next step is wiring your bot to read <b>settings.modules</b> and block/allow commands accordingly.
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
                          ["generalChannelId", "General logs channel ID"],
                          ["modlogChannelId", "Mod logs channel ID"],
                          ["joinChannelId", "Join logs channel ID"],
                          ["leaveChannelId", "Leave logs channel ID"],
                          ["commandChannelId", "Command logs channel ID"],
                          ["editChannelId", "Edit logs channel ID"],
                          ["messageChannelId", "Message logs channel ID"],
                          ["roleChannelId", "Role logs channel ID"],
                          ["nicknameChannelId", "Nickname logs channel ID"],
                        ].map(([k, label]) => (
                          <label key={k} className="woc-card p-4">
                            <div className="font-semibold text-sm">{label}</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">Paste a channel ID (you’ll add a channel picker later).</div>
                            <input
                              value={settings.logs?.[k] || ""}
                              onChange={(e) => {
                                setSettings((s) => ({ ...s, logs: { ...s.logs, [k]: e.target.value } }));
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

                        <label className="woc-card p-4">
                          <div className="font-semibold text-sm">Welcome channel ID</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">Where the welcome message is posted.</div>
                          <input
                            value={settings.welcome?.channelId || ""}
                            onChange={(e) => {
                              setSettings((s) => ({ ...s, welcome: { ...s.welcome, channelId: e.target.value } }));
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

                        <label className="woc-card p-4 sm:col-span-2">
                          <div className="font-semibold text-sm">Welcome message</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            Tokens: <b>{"{user}"}</b>, <b>{"{server}"}</b>
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

                        <label className="woc-card p-4 sm:col-span-2">
                          <div className="font-semibold text-sm">Auto role ID</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">Optional: role to assign to new members.</div>
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

                  {/* MODERATION (simple switches, your deeper stuff can expand later) */}
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
                          <label key={key} className="woc-card p-4 flex items-start justify-between gap-3 cursor-pointer">
                            <div>
                              <div className="font-semibold text-sm">{label}</div>
                              <div className="text-xs text-[var(--text-muted)] mt-1">{hint}</div>
                            </div>

                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={!!settings.moderation?.[key]}
                              onChange={(e) => {
                                setSettings((s) => ({ ...s, moderation: { ...s.moderation, [key]: e.target.checked } }));
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
                      <SectionTitle title="WoC personality" subtitle="Keep the dashboard alive, not corporate-boring." />

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="woc-card p-4">
                          <div className="font-semibold text-sm">Mood</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">Influences dashboard vibe now (and bot responses later).</div>

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
                          <div className="text-xs text-[var(--text-muted)] mt-1">0 = polite librarian, 100 = chaotic bard.</div>

                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Number(settings.personality?.sass ?? 35)}
                            onChange={(e) => {
                              setSettings((s) => ({ ...s, personality: { ...s.personality, sass: Number(e.target.value) } }));
                              setDirty(true);
                              woc?.setMood?.("playful");
                            }}
                            className="mt-3 w-full"
                          />

                          <div className="mt-2 text-xs text-[var(--text-muted)]">
                            Current: <span className="font-semibold text-[var(--text-main)]">{Number(settings.personality?.sass ?? 35)}</span>
                          </div>
                        </label>

                        <label className="woc-card p-4 flex items-start justify-between gap-3 cursor-pointer sm:col-span-2">
                          <div>
                            <div className="font-semibold text-sm">Narration mode</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">Adds story flavor to announcements/logs (later: bot output style).</div>
                          </div>

                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={!!settings.personality?.narration}
                            onChange={(e) => {
                              setSettings((s) => ({ ...s, personality: { ...s.personality, narration: e.target.checked } }));
                              setDirty(true);
                              woc?.setMood?.(e.target.checked ? "story" : "neutral");
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {/* ACTION LOG (stub) */}
                  {subtab === "actionlog" ? (
                    <div className="space-y-3">
                      <SectionTitle title="Action log" subtitle="Soon: admin actions, toggles changed, mod events (from bot/webhook)." />
                      <div className="woc-card p-4 text-sm text-[var(--text-muted)]">No entries yet. The chronicle is empty… suspiciously peaceful.</div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
