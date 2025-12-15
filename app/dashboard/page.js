"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useWocTheme } from "../WocThemeProvider";

const LS = {
  selectedGuild: "woc-selected-guild",
};

function safeGet(key, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); } catch {}
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
  try { woc = useWocTheme(); } catch { woc = null; }

  const { data: session, status } = useSession();
  const loading = status === "loading";
  const authed = status === "authenticated";

  const [guilds, setGuilds] = useState([]);
  const [guildErr, setGuildErr] = useState("");

  const [selectedGuildId, setSelectedGuildId] = useState(safeGet(LS.selectedGuild, ""));
  const selectedGuild = useMemo(
    () => guilds.find((g) => String(g.id) === String(selectedGuildId)) || null,
    [guilds, selectedGuildId]
  );

  const [install, setInstall] = useState({ loading: false, installed: null, error: "" });

  const [tab, setTab] = useState("overview"); // overview | moderation | logs | personality
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  // settings
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [dirty, setDirty] = useState(false);

  const inviteLinkForGuild = (gid) =>
    `https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || ""}&scope=bot%20applications.commands&permissions=8&guild_id=${gid}&disable_guild_select=true`;

  function showToast(msg, mood = "playful") {
    setToast(msg);
    if (woc?.setMood) woc.setMood(mood);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  // Load manageable guilds
  useEffect(() => {
    if (!authed) {
      setGuilds([]);
      setGuildErr("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setGuildErr("");
        const res = await fetch("/api/discord/guilds", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load guilds"));
        const data = await res.json();

        const list = Array.isArray(data.guilds) ? data.guilds : [];
        if (cancelled) return;

        setGuilds(list);

        // auto select
        const saved = safeGet(LS.selectedGuild, "");
        const exists = list.find((g) => String(g.id) === String(saved));
        const first = list[0]?.id || "";
        const pick = exists ? saved : first;

        setSelectedGuildId(pick);
        if (pick) safeSet(LS.selectedGuild, pick);
      } catch (e) {
        if (cancelled) return;
        setGuildErr(e?.message || "Failed to load guilds.");
        setGuilds([]);
      }
    })();

    return () => { cancelled = true; };
  }, [authed]);

  // On guild change: check install + load settings
  useEffect(() => {
    if (!authed || !selectedGuildId) return;

    safeSet(LS.selectedGuild, selectedGuildId);
    setDirty(false);

    // install check
    setInstall({ loading: true, installed: null, error: "" });
    (async () => {
      try {
        const res = await fetch(`/api/guilds/${selectedGuildId}/status`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || "Install check failed");
        }
        setInstall({ loading: false, installed: !!data.installed, error: "" });
        if (data.installed) showToast("WoC is in the server. The console awakens. ✨", "story");
        else showToast("WoC isn’t in that server yet. Gate closed. 🔒", "omen");
      } catch (e) {
        setInstall({ loading: false, installed: null, error: e?.message || "Install check failed" });
      }
    })();

    // settings fetch
    setSettingsLoading(true);
    setSettings(null);

    (async () => {
      try {
        const res = await fetch(`/api/guilds/${selectedGuildId}/settings`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || "Failed to load settings");
        setSettings(data.settings);
      } catch (e) {
        setSettings({
          guildId: selectedGuildId,
          prefix: "!",
          moderation: { enabled: true, automod: false, antiLink: false, antiSpam: true },
          logs: { enabled: true, generalChannelId: "", modlogChannelId: "" },
          personality: { mood: "story", sass: 35, narration: true },
        });
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, [authed, selectedGuildId]);

  async function saveSettings() {
    if (!selectedGuildId || !settings) return;
    setSettingsLoading(true);
    try {
      const res = await fetch(`/api/guilds/${selectedGuildId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || "Save failed");
      setSettings(data.settings);
      setDirty(false);
      showToast("Settings sealed into the timeline. ✅", "playful");
    } catch (e) {
      showToast(e?.message || "Save failed.", "omen");
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
              This is WoC’s control room. Pick a server you manage, then tune moderation, logs, prefix, and personality.
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
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">{guildErr}</div>
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
                    {install.error ? <Pill>Error ⚠️</Pill> : null}
                  </div>
                </div>

                {install.installed === false ? (
                  <div className="mt-4 woc-card p-4">
                    <div className="text-sm font-semibold">Invite gate</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      WoC can’t manage what it can’t see. Invite the bot to <b>{selectedGuild?.name}</b> to unlock controls.
                    </div>

                    <a
                      className="mt-3 inline-flex items-center gap-2 woc-btn-primary"
                      href={inviteLinkForGuild(selectedGuildId)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => woc?.setMood?.("battle")}
                    >
                      Invite WoC to this server <span>➕</span>
                    </a>

                    <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                      Once invited, refresh this page and the gate will open automatically.
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Save panel */}
              <div className="woc-card p-5">
                <SectionTitle title="Control seal" subtitle="Changes persist per server." />
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    className={`woc-btn-primary ${(!gateInstalled || !dirty || settingsLoading) ? "opacity-60 cursor-not-allowed" : ""}`}
                    disabled={!gateInstalled || !dirty || settingsLoading}
                    onClick={saveSettings}
                    title={!gateInstalled ? "Invite WoC to unlock saving." : !dirty ? "No changes yet." : "Save changes"}
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
                      if (woc?.setMood) woc.setMood(k === "personality" ? "playful" : "story");
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
                  {tab === "overview" ? (
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="woc-card p-4 lg:col-span-2">
                        <div className="font-semibold">What this server is running</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          These are real saved settings (bot wiring next).
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Prefix</div>
                            <div className="text-lg font-semibold mt-1">{settings.prefix}</div>
                          </div>
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Moderation</div>
                            <div className="text-lg font-semibold mt-1">
                              {settings.moderation.enabled ? "On" : "Off"}
                            </div>
                          </div>
                          <div className="woc-card p-3">
                            <div className="text-xs text-[var(--text-muted)]">Logs</div>
                            <div className="text-lg font-semibold mt-1">
                              {settings.logs.enabled ? "On" : "Off"}
                            </div>
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
                          “Your server is a world. I’m just the engine. Turn the dials and let it breathe.”
                        </div>
                        <div className="mt-3 text-[0.72rem] text-[var(--text-muted)]">
                          Next step: your bot reads these settings from Mongo and applies them live.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === "moderation" ? (
                    <div className="space-y-4">
                      <SectionTitle
                        title="Moderation systems"
                        subtitle="Toggle command systems and automod features."
                      />

                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          ["enabled", "Moderation enabled", "Master switch for mod commands."],
                          ["automod", "AutoMod", "Basic auto-filter and actions (wire later)."],
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
                              checked={!!settings.moderation[key]}
                              onChange={(e) => {
                                setSettings((s) => ({
                                  ...s,
                                  moderation: { ...s.moderation, [key]: e.target.checked },
                                }));
                                setDirty(true);
                                if (woc?.setMood) woc.setMood(e.target.checked ? "battle" : "story");
                              }}
                            />
                          </label>
                        ))}
                      </div>

                      <div className="text-[0.72rem] text-[var(--text-muted)]">
                        Bot wiring: your moderation commands should reference these flags before executing.
                      </div>
                    </div>
                  ) : null}

                  {tab === "logs" ? (
                    <div className="space-y-4">
                      <SectionTitle
                        title="Logs & channels"
                        subtitle="Where WoC writes records: general logs vs moderation logs."
                      />

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
                              if (woc?.setMood) woc.setMood(e.target.checked ? "story" : "omen");
                            }}
                          />
                        </label>

                        <label className="woc-card p-4">
                          <div className="font-semibold text-sm">Prefix</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            Short, sharp, and easy to type.
                          </div>
                          <input
                            value={settings.prefix}
                            onChange={(e) => {
                              setSettings((s) => ({ ...s, prefix: e.target.value }));
                              setDirty(true);
                              if (woc?.setMood) woc.setMood("playful");
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
                              setSettings((s) => ({
                                ...s,
                                logs: { ...s.logs, generalChannelId: e.target.value },
                              }));
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
                              setSettings((s) => ({
                                ...s,
                                logs: { ...s.logs, modlogChannelId: e.target.value },
                              }));
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

                      <div className="text-[0.72rem] text-[var(--text-muted)]">
                        Next: we’ll replace raw IDs with a “channel picker” dropdown (requires fetching channels).
                      </div>
                    </div>
                  ) : null}

                  {tab === "personality" ? (
                    <div className="space-y-4">
                      <SectionTitle
                        title="WoC personality controls"
                        subtitle="Make the bot feel like a narrator, a rival, or a calm system voice."
                      />

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="woc-card p-4">
                          <div className="font-semibold text-sm">Mood</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            Sets the dashboard vibe and can influence bot responses later.
                          </div>

                          <select
                            value={settings.personality.mood}
                            onChange={(e) => {
                              const mood = e.target.value;
                              setSettings((s) => ({
                                ...s,
                                personality: { ...s.personality, mood },
                              }));
                              setDirty(true);
                              woc?.setMood?.(mood);
                              showToast(`Mood shifted: ${mood}`, mood);
                            }}
                            className="
                              mt-3 w-full px-3 py-2 rounded-xl
                              border border-[var(--border-subtle)]/70
                              bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                              text-[var(--text-main)]
                              outline-none
                            "
                          >
                            {["story", "battle", "playful", "omen", "flustered"].map((m) => (
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
                              if (woc?.setMood) woc.setMood("playful");
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
                              if (woc?.setMood) woc.setMood(e.target.checked ? "story" : "neutral");
                            }}
                          />
                        </label>
                      </div>

                      <div className="text-[0.72rem] text-[var(--text-muted)]">
                        Bot wiring: your response templates can branch on mood + sass + narration.
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
