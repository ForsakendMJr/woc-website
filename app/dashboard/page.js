// app/dashboard/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useWocTheme } from "../WocThemeProvider";

const LS = { selectedGuild: "woc-selected-guild" };

// ✅ Match YOUR actual route layout:
const GUILDS_ENDPOINT = "/api/auth/discord/guilds";

// ✅ Your other routes (as you pasted earlier)
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
    const e = new Error(
      safeErrorMessage(data?.error || data?.warning || `Request failed (${res.status})`)
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
    <span className={cx("text-[0.72rem] px-2 py-1 rounded-full border", tones[tone] || tones.default)}>
      {children}
    </span>
  );
}

function SoftNotice({ children }) {
  if (!children) return null;
  return (
    <div className="mt-4 text-xs text-[var(--text-muted)]">
      <span className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-400/70" />
        <span>{children}</span>
      </span>
    </div>
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

const MODULES = [
  { key: "moderation", label: "Moderation", desc: "Commands, automod, anti-spam and guards.", kind: "core" },
  { key: "logs", label: "Logs", desc: "General logs, mod logs, event streams.", kind: "core" },
  { key: "welcome", label: "Welcome", desc: "Greets, roles, onboarding (later).", kind: "coming" },
  { key: "reaction_roles", label: "Reaction Roles", desc: "Self-assign roles by reacting (later).", kind: "coming" },
  { key: "economy", label: "Economy", desc: "Coins, shops, jobs, sinks (later).", kind: "coming" },
  { key: "levels", label: "Levels", desc: "XP, rank cards, boosts (later).", kind: "coming" },
  { key: "custom_commands", label: "Custom Commands", desc: "Server-defined triggers (later).", kind: "coming" },
];

function moduleEnabledFromSettings(modKey, settings) {
  if (!settings) return false;
  if (modKey === "moderation") return !!settings?.moderation?.enabled;
  if (modKey === "logs") return !!settings?.logs?.enabled;
  return false;
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
    installed: null, // true/false/null
    warning: "",
  });

  const [subtab, setSubtab] = useState("overview");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [dirty, setDirty] = useState(false);

  const guildFetchOnceRef = useRef(false);
  const guildAbortRef = useRef(null);
  const perGuildAbortRef = useRef(null);

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

    // install check (soft warnings only)
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
        setInstall({
          loading: false,
          installed: null,
          warning: safeErrorMessage(e?.message || "Gate check unavailable."),
        });
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
        setSettings({
          guildId: selectedGuildId,
          prefix: "!",
          moderation: { enabled: true, automod: false, antiLink: false, antiSpam: true },
          logs: { enabled: true, generalChannelId: "", modlogChannelId: "" },
          personality: { mood: "story", sass: 35, narration: true },
        });
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
      ? "Pick a module. Flip the switches. Let’s duel the chaos."
      : mood === "omen"
      ? "I’m seeing… warnings. Temporary weather."
      : mood === "flustered"
      ? "Too many servers, not enough hands. We cope."
      : mood === "playful"
      ? "Twist the dials. Watch the server react."
      : "This is the control room. Quiet power lives here.";

  const subnav = [
    ["overview", "Overview"],
    ["modules", "Modules"],
    ["moderation", "Moderation"],
    ["logs", "Logs"],
    ["personality", "Personality"],
    ["actionlog", "Action log"],
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="woc-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)] max-w-3xl">
              WoC’s control room. Choose a server, then tune modules, moderation, logs, prefix, and personality.
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
                      {install.installed === true ? <Pill tone="ok">Installed ✅</Pill> : null}
                      {install.installed === false ? <Pill tone="warn">Not installed 🔒</Pill> : null}
                      {/* ✅ We no longer show “Notice ⚠️” as a badge. */}
                    </div>
                  }
                />

                <SoftNotice>{guildWarn || ""}</SoftNotice>

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

                <SoftNotice>{install.warning || ""}</SoftNotice>

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
                      <div className="mt-2 text-[0.72rem] text-rose-200/90">
                        Missing NEXT_PUBLIC_DISCORD_CLIENT_ID. Add it to Vercel env and redeploy.
                      </div>
                    ) : (
                      <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                        Once invited, refresh this page. Gate opens automatically.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

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
                    {gateInstalled
                      ? dirty ? "WoC is watching. Commit the ritual." : "All quiet. No edits pending."
                      : "Gate closed. Invite WoC to enable editing."}
                  </div>
                </div>
              </div>
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
                <div className="mt-4 text-sm text-[var(--text-muted)]">
                  Invite WoC to this server to unlock the dashboard systems.
                </div>
              ) : settingsLoading || !settings ? (
                <div className="mt-4 text-sm text-[var(--text-muted)]">Loading settings…</div>
              ) : (
                <div className="mt-5">
                  {/* OVERVIEW */}
                  {subtab === "overview" ? (
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="woc-card p-4 lg:col-span-2">
                        <div className="font-semibold">Server snapshot</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Live settings in Mongo (bot wiring uses these next).
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Prefix</div>
                            <div className="text-lg font-semibold mt-1">{settings.prefix}</div>
                          </div>
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Moderation</div>
                            <div className="text-lg font-semibold mt-1">{settings.moderation.enabled ? "On" : "Off"}</div>
                          </div>
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Logs</div>
                            <div className="text-lg font-semibold mt-1">{settings.logs.enabled ? "On" : "Off"}</div>
                          </div>
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Mood</div>
                            <div className="text-lg font-semibold mt-1">{settings.personality.mood}</div>
                          </div>
                        </div>
                      </div>

                      <div className="woc-card p-4">
                        <div className="font-semibold">WoC whisper</div>
                        <div className="text-xs text-[var(--text-muted)] mt-2">
                          “A server is a living map. Modules are the weather. Choose wisely.”
                        </div>
                        <div className="mt-3 text-[0.72rem] text-[var(--text-muted)]">
                          Next step: your bot reads these settings and applies them live.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* MODULES */}
                  {subtab === "modules" ? (
                    <div className="space-y-4">
                      <SectionTitle title="Modules" subtitle="Flip systems on/off per server. (Some are preview cards for now.)" />

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {MODULES.map((m) => {
                          const enabled = moduleEnabledFromSettings(m.key, settings);
                          const isCore = m.kind === "core";
                          return (
                            <div key={m.key} className="woc-card p-4 flex flex-col justify-between">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold">{m.label}</div>
                                  <div className="text-xs text-[var(--text-muted)] mt-1">{m.desc}</div>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                  {isCore ? <Pill tone="ok">Core</Pill> : <Pill tone="warn">Coming</Pill>}
                                  <label className="inline-flex items-center gap-2">
                                    <span className="text-[0.72rem] text-[var(--text-muted)]">{enabled ? "On" : "Off"}</span>
                                    <input
                                      type="checkbox"
                                      checked={enabled}
                                      disabled={!isCore}
                                      onChange={(e) => {
                                        if (!isCore) return;

                                        if (m.key === "moderation") {
                                          setSettings((s) => ({
                                            ...s,
                                            moderation: { ...s.moderation, enabled: e.target.checked },
                                          }));
                                        }
                                        if (m.key === "logs") {
                                          setSettings((s) => ({
                                            ...s,
                                            logs: { ...s.logs, enabled: e.target.checked },
                                          }));
                                        }

                                        setDirty(true);
                                        woc?.setMood?.(e.target.checked ? "story" : "omen");
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>

                              <div className="mt-4 flex items-center justify-between">
                                <button
                                  type="button"
                                  className={cx("woc-btn-ghost text-xs", isCore ? "" : "opacity-60 cursor-not-allowed")}
                                  disabled={!isCore}
                                  onClick={() => {
                                    if (!isCore) return;
                                    if (m.key === "moderation") setSubtab("moderation");
                                    if (m.key === "logs") setSubtab("logs");
                                  }}
                                >
                                  ⚙️ Settings
                                </button>
                                <div className="text-[0.72rem] text-[var(--text-muted)]">
                                  {isCore ? "Editable" : "Preview"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="text-[0.72rem] text-[var(--text-muted)]">
                        Pro tip: “Modules” is the overview switchboard; deeper settings live in their panels.
                      </div>
                    </div>
                  ) : null}

                  {/* MODERATION */}
                  {subtab === "moderation" ? (
                    <div className="space-y-4">
                      <SectionTitle
                        title="Moderation"
                        subtitle="Toggle mod systems. Your bot should check these flags before executing commands."
                      />

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
                              checked={!!settings.moderation[key]}
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

                  {/* LOGS */}
                  {subtab === "logs" ? (
                    <div className="space-y-4">
                      <SectionTitle title="Logs" subtitle="Where WoC writes records: general logs vs moderation logs." />

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="woc-card p-4">
                          <div className="font-semibold text-sm">Enable logging</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            If off, WoC stays quiet even when things happen.
                          </div>
                          <input
                            type="checkbox"
                            className="mt-3"
                            checked={!!settings.logs.enabled}
                            onChange={(e) => {
                              setSettings((s) => ({ ...s, logs: { ...s.logs, enabled: e.target.checked } }));
                              setDirty(true);
                              woc?.setMood?.(e.target.checked ? "story" : "omen");
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
                              mt-3 w-full px-3 py-2 rounded-xl
                              border border-[var(--border-subtle)]/70
                              bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                              text-[var(--text-main)]
                              outline-none
                            "
                            maxLength={4}
                            placeholder="!"
                          />
                        </label>

                        <label className="woc-card p-4">
                          <div className="font-semibold text-sm">General log channel ID</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            Joins/leaves, milestones, economy events (later).
                          </div>
                          <input
                            value={settings.logs.generalChannelId}
                            onChange={(e) => {
                              setSettings((s) => ({ ...s, logs: { ...s.logs, generalChannelId: e.target.value } }));
                              setDirty(true);
                            }}
                            className="
                              mt-3 w-full px-3 py-2 rounded-xl
                              border border-[var(--border-subtle)]/70
                              bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                              text-[var(--text-main)]
                              outline-none
                            "
                            placeholder="e.g. 1234567890"
                          />
                        </label>

                        <label className="woc-card p-4">
                          <div className="font-semibold text-sm">Modlog channel ID</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            Bans/kicks/mutes/warns and staff actions.
                          </div>
                          <input
                            value={settings.logs.modlogChannelId}
                            onChange={(e) => {
                              setSettings((s) => ({ ...s, logs: { ...s.logs, modlogChannelId: e.target.value } }));
                              setDirty(true);
                            }}
                            className="
                              mt-3 w-full px-3 py-2 rounded-xl
                              border border-[var(--border-subtle)]/70
                              bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                              text-[var(--text-main)]
                              outline-none
                            "
                            placeholder="e.g. 1234567890"
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {/* PERSONALITY */}
                  {subtab === "personality" ? (
                    <div className="space-y-4">
                      <SectionTitle
                        title="WoC personality"
                        subtitle="Make the bot feel like a narrator, a rival, or a calm system voice."
                      />

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="woc-card p-4">
                          <div className="font-semibold text-sm">Mood</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            Influences dashboard vibe now, and bot responses later.
                          </div>

                          <select
                            value={settings.personality.mood}
                            onChange={(e) => {
                              const m = e.target.value;
                              setSettings((s) => ({ ...s, personality: { ...s.personality, mood: m } }));
                              setDirty(true);
                              woc?.setMood?.(m);
                              showToast(`Mood shifted: ${m}`, m);
                            }}
                            className="
                              mt-3 w-full px-3 py-2 rounded-xl
                              border border-[var(--border-subtle)]/70
                              bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                              text-[var(--text-main)]
                              outline-none
                            "
                          >
                            {["neutral", "battle", "playful", "story", "omen", "flustered"].map((m) => (
                              <option key={m} value={m}>{m}</option>
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
                            value={settings.personality.sass}
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
                            Current: <span className="font-semibold text-[var(--text-main)]">{settings.personality.sass}</span>
                          </div>
                        </label>

                        <label className="woc-card p-4 flex items-start justify-between gap-3 cursor-pointer sm:col-span-2">
                          <div>
                            <div className="font-semibold text-sm">Narration mode</div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">
                              Adds story flavor to announcements and logs (later: bot output style).
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={!!settings.personality.narration}
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
                      <SectionTitle
                        title="Action log"
                        subtitle="Soon: admin actions, toggles changed, mod events (from bot/webhook)."
                      />
                      <div className="woc-card p-4 text-sm text-[var(--text-muted)]">
                        No entries yet. The chronicle is empty… suspiciously peaceful.
                      </div>
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
