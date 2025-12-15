// app/dashboard/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useWocTheme } from "../WocThemeProvider";

const LS = { selectedGuild: "woc-selected-guild" };

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
    msg.includes("<!DOCTYPE") || msg.includes("<html") || msg.includes("<body");
  if (looksLikeHtml) return "Non-JSON/HTML response received (route may be misrouted).";
  return msg.length > 240 ? msg.slice(0, 240) + "…" : msg;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  // If non-JSON, read text safely
  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    const err = safeErrorMessage(txt || `Non-JSON response (${res.status})`);
    const e = new Error(err);
    e.status = res.status;
    throw e;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const e = new Error(
      safeErrorMessage(data?.error || `Request failed (${res.status})`)
    );
    e.status = res.status;
    throw e;
  }

  return data;
}

function Pill({ children }) {
  return (
    <span className="text-[0.72rem] px-2 py-1 rounded-full border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]">
      {children}
    </span>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="font-semibold">{title}</div>
        {subtitle ? (
          <div className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</div>
        ) : null}
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

  const { status } = useSession();
  const loading = status === "loading";
  const authed = status === "authenticated";

  const [guilds, setGuilds] = useState([]);
  const [guildErr, setGuildErr] = useState("");

  const [selectedGuildId, setSelectedGuildId] = useState(() =>
    safeGet(LS.selectedGuild, "")
  );

  const selectedGuild = useMemo(
    () => guilds.find((g) => String(g.id) === String(selectedGuildId)) || null,
    [guilds, selectedGuildId]
  );

  const [install, setInstall] = useState({
    loading: false,
    installed: null,
    error: "",
  });

  const [tab, setTab] = useState("overview"); // overview | moderation | logs | personality
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  // settings
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [dirty, setDirty] = useState(false);

  // Prevent duplicate guild fetch (dev strict mode + rerenders)
  const guildFetchOnceRef = useRef(false);

  // Abort controllers (so old requests don’t overwrite new state)
  const guildAbortRef = useRef(null);
  const perGuildAbortRef = useRef(null);

  // Status retry/debounce timers
  const statusRetryTimerRef = useRef(null);
  const statusDebounceTimerRef = useRef(null);

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
      if (statusRetryTimerRef.current) clearTimeout(statusRetryTimerRef.current);
      if (statusDebounceTimerRef.current) clearTimeout(statusDebounceTimerRef.current);
    };
  }, []);

  // Load manageable guilds (once per authed session)
  useEffect(() => {
    if (!authed) {
      setGuilds([]);
      setGuildErr("");
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
        setGuildErr("");

        const data = await fetchJson("/api/discord/guilds", {
          cache: "no-store",
          signal: ac.signal,
        });

        const list = Array.isArray(data.guilds) ? data.guilds : [];
        setGuilds(list);

        // auto select
        const saved = safeGet(LS.selectedGuild, "");
        const exists = list.find((g) => String(g.id) === String(saved));
        const first = list[0]?.id || "";
        const pick = exists ? saved : first;

        setSelectedGuildId(pick);
        if (pick) safeSet(LS.selectedGuild, pick);

        // If API includes an informational error field, display it
        if (data?.error) setGuildErr(safeErrorMessage(data.error));
      } catch (e) {
        if (e?.name === "AbortError") return;
        setGuildErr(safeErrorMessage(e?.message || "Failed to load guilds."));
        setGuilds([]);
      }
    })();
  }, [authed]);

  // On guild change: check install + load settings
  useEffect(() => {
    if (!authed || !selectedGuildId) return;

    safeSet(LS.selectedGuild, selectedGuildId);
    setDirty(false);

    // Abort previous per-guild calls
    if (perGuildAbortRef.current) perGuildAbortRef.current.abort();
    const ac = new AbortController();
    perGuildAbortRef.current = ac;

    // ===== INSTALL CHECK (debounced + 429 backoff) =====
    if (statusRetryTimerRef.current) clearTimeout(statusRetryTimerRef.current);
    if (statusDebounceTimerRef.current) clearTimeout(statusDebounceTimerRef.current);

    setInstall({ loading: true, installed: null, error: "" });

    const runStatus = async () => {
      try {
        const data = await fetchJson(`/api/guilds/${selectedGuildId}/status`, {
          cache: "no-store",
          signal: ac.signal,
        });

        const installed = !!data.installed;
        setInstall({ loading: false, installed, error: "" });

        if (installed) showToast("WoC is in the server. The console awakens. ✨", "story");
        else showToast("WoC isn’t in that server yet. Gate closed. 🔒", "omen");
      } catch (e) {
        if (e?.name === "AbortError") return;

        // If rate-limited, wait and retry automatically
        if (e?.status === 429) {
          setInstall({
            loading: true,
            installed: null,
            error: safeErrorMessage(e?.message || "Rate limited (429). Retrying…"),
          });

          // If your status route later returns retry_after, you can parse it here.
          const retryMs = 1200;

          statusRetryTimerRef.current = setTimeout(() => {
            if (!ac.signal.aborted) runStatus();
          }, retryMs);

          return;
        }

        setInstall({
          loading: false,
          installed: null,
          error: safeErrorMessage(e?.message || "Install check failed"),
        });
      }
    };

    // Debounce so quick switching doesn’t spam your API
    statusDebounceTimerRef.current = setTimeout(() => {
      if (!ac.signal.aborted) runStatus();
    }, 250);

    // ===== SETTINGS FETCH =====
    setSettingsLoading(true);
    setSettings(null);

    (async () => {
      try {
        const data = await fetchJson(`/api/guilds/${selectedGuildId}/settings`, {
          cache: "no-store",
          signal: ac.signal,
        });
        setSettings(data.settings);
      } catch (e) {
        if (e?.name === "AbortError") return;

        // fallback defaults so UI still works
        setSettings({
          guildId: selectedGuildId,
          prefix: "!",
          moderation: {
            enabled: true,
            automod: false,
            antiLink: false,
            antiSpam: true,
          },
          logs: { enabled: true, generalChannelId: "", modlogChannelId: "" },
          personality: { mood: "story", sass: 35, narration: true },
        });
      } finally {
        if (ac.signal.aborted) return;
        setSettingsLoading(false);
      }
    })();
  }, [authed, selectedGuildId]);

  async function saveSettings() {
    if (!selectedGuildId || !settings) return;
    setSettingsLoading(true);
    try {
      const data = await fetchJson(`/api/guilds/${selectedGuildId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      setSettings(data.settings);
      setDirty(false);
      showToast("Settings sealed into the timeline. ✅", "playful");
    } catch (e) {
      showToast(safeErrorMessage(e?.message || "Save failed."), "omen");
    } finally {
      setSettingsLoading(false);
    }
  }

  const gateInstalled = install.installed === true;

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-14">
      <div className="woc-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)] max-w-2xl">
              This is WoC’s control room. Pick a server you manage, then tune moderation,
              logs, prefix, and personality.
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
                subtitle="Invite first so the dashboard can actually control something real."
              />
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
            {/* Selector + gate */}
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="woc-card p-5 lg:col-span-2">
                <SectionTitle
                  title="Server selector"
                  subtitle="Only servers you own/admin will appear here."
                />

                {guildErr ? (
                  <div className="mt-4 text-xs text-rose-200/90 bg-rose-500/10 border border-rose-400/30 rounded-xl p-3">
                    <div className="font-semibold">Guild fetch warning</div>
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">
                      {guildErr}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3 items-center">
                  <select
                    value={selectedGuildId}
                    onChange={(e) => {
                      setSelectedGuildId(e.target.value);
                      setTab("overview");
                      if (woc?.setMood) woc.setMood("story");
                    }}
                    className="
                      min-w-[260px] flex-1 px-3 py-2 rounded-xl
                      border border-[var(--border-subtle)]/70
                      bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                      text-[var(--text-main)]
                      outline-none
                    "
                  >
                    {guilds.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.role})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    {install.loading ? <Pill>Checking gate…</Pill> : null}
                    {install.installed === true ? <Pill>Installed ✅</Pill> : null}
                    {install.installed === false ? <Pill>Not installed 🔒</Pill> : null}
                    {install.error ? (
                      <Pill>
                        {install.error.includes("429") ? "Rate limited ⏳" : "Error ⚠️"}
                      </Pill>
                    ) : null}
                  </div>
                </div>

                {install.installed === false ? (
                  <div className="mt-4 woc-card p-4">
                    <div className="text-sm font-semibold">Invite gate</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      WoC can’t manage what it can’t see. Invite the bot to{" "}
                      <b>{selectedGuild?.name}</b> to unlock controls.
                    </div>

                    <a
                      className={`mt-3 inline-flex items-center gap-2 woc-btn-primary ${
                        !clientId ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                      href={clientId ? inviteLinkForGuild(selectedGuildId) : undefined}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => woc?.setMood?.("battle")}
                      title={
                        clientId
                          ? "Invite WoC to this server"
                          : "Set NEXT_PUBLIC_DISCORD_CLIENT_ID in your env"
                      }
                    >
                      Invite WoC to this server <span>➕</span>
                    </a>

                    {!clientId ? (
                      <div className="mt-2 text-[0.72rem] text-rose-200/90">
                        Missing NEXT_PUBLIC_DISCORD_CLIENT_ID. Add it to Vercel env and redeploy.
                      </div>
                    ) : (
                      <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                        Once invited, refresh this page and the gate will open automatically.
                      </div>
                    )}
                  </div>
                ) : null}

                {install.error ? (
                  <div className="mt-3 text-[0.72rem] text-[var(--text-muted)]">
                    Detail: {install.error}
                  </div>
                ) : null}
              </div>

              {/* Save panel */}
              <div className="woc-card p-5">
                <SectionTitle title="Control seal" subtitle="Changes persist per server." />
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    className={`woc-btn-primary ${
                      !gateInstalled || !dirty || settingsLoading
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                    disabled={!gateInstalled || !dirty || settingsLoading}
                    onClick={saveSettings}
                    title={
                      !gateInstalled
                        ? "Invite WoC to unlock saving."
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
                      : "Gate closed. Invite WoC to enable editing."}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 woc-card p-5">
              <div className="flex flex-wrap gap-2">
                {[
                  ["overview", "Overview"],
                  ["moderation", "Moderation"],
                  ["logs", "Logs"],
                  ["personality", "Personality"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setTab(k);
                      if (woc?.setMood)
                        woc.setMood(k === "personality" ? "playful" : "story");
                    }}
                    className={[
                      "text-xs sm:text-sm px-3 py-2 rounded-full border transition",
                      "border-[var(--border-subtle)]/70",
                      tab === k
                        ? "bg-[color-mix(in_oklab,var(--accent-soft)_55%,transparent)]"
                        : "bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]",
                    ].join(" ")}
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
                  {/* ✅ Paste your existing Overview / Moderation / Logs / Personality UI blocks here */}
                  {/* This file focuses on fixing the rate-limit + error-pill behaviour */}
                  <div className="text-sm text-[var(--text-muted)]">
                    Paste your tab contents back in here (unchanged).
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
