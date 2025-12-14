// app/dashboard/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useWocTheme } from "../WocThemeProvider";

/**
 * WoC Dashboard v2.1 (Frontend-first, production-safe)
 * ✅ Fetch guilds via your own API route: /api/discord/guilds
 * ✅ Server selector UI + fake “Link & Sync” animation
 * ✅ Vote Claim modal (stubbed verification + cooldown timers)
 *
 * Notes:
 * - This avoids calling discord.com from the browser (CORS/security/token issues).
 * - Your /api/discord/guilds route should read the access token server-side (NextAuth getToken()).
 * - Vote claim is still stubbed and uses localStorage cooldowns until you wire real verification.
 */

const LS = {
  invited: "woc-dashboard-invited",
  selectedGuild: "woc-selected-guild",
  linkedGuild: "woc-linked-guild",
  claimTopggAt: "woc-claim-topgg-at",
  claimDblAt: "woc-claim-dbl-at",
};

const COOLDOWN_HOURS = 12;
const CLAIM_REWARD = 250;

// Fallback list (UI still works even if guild fetch fails)
const FALLBACK_GUILDS = [
  { id: "1", name: "Mythralight Sanctuary", icon: null, role: "Owner" },
  { id: "2", name: "Umbrarealm Archives", icon: null, role: "Admin" },
  { id: "3", name: "Aurora District", icon: null, role: "Manager" },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function hoursToMs(h) {
  return h * 60 * 60 * 1000;
}

function formatTimeLeft(ms) {
  if (ms <= 0) return "Ready";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function safeLocalGet(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeLocalSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

function Modal({ open, onClose, title, subtitle, children }) {
  if (!open) return null;
  return (
    <div className="woc-intro-backdrop" role="dialog" aria-modal="true">
      <div className="woc-card woc-intro-dialog animate-woc-pop">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{title}</div>
            {subtitle ? (
              <div className="text-[0.78rem] text-[var(--text-muted)] mt-1">
                {subtitle}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="woc-btn-ghost text-xs px-3 py-1"
          >
            Close ✖
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)]/60 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] p-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {hint ? (
        <div className="text-[0.72rem] text-[var(--text-muted)] mt-1">{hint}</div>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  // Optional mood hook (won’t crash if provider not wired)
  let woc = null;
  try {
    woc = useWocTheme();
  } catch {
    woc = null;
  }

  const { data: session, status } = useSession();
  const loading = status === "loading";
  const authed = status === "authenticated";

  const userName =
    session?.user?.name || session?.user?.email?.split("@")?.[0] || "Adventurer";

  // Invite gate (local-only for now)
  const [invited, setInvited] = useState(false);

  // Guilds (fetched via /api/discord/guilds)
  const [guilds, setGuilds] = useState([]);
  const [guildsSource, setGuildsSource] = useState("loading"); // "loading" | "live" | "fallback"
  const [guildsError, setGuildsError] = useState("");

  // Selector + link/sync UI
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [linkedGuildId, setLinkedGuildId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncedAt, setSyncedAt] = useState(null);

  // Vote claim modal
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimingSource, setClaimingSource] = useState(null); // "topgg" | "dbl" | null
  const [claimResult, setClaimResult] = useState(null);

  // Cooldowns
  const [topggLeft, setTopggLeft] = useState(0);
  const [dblLeft, setDblLeft] = useState(0);

  // Toast
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  function showToast(msg, mood = "playful") {
    setToast(msg);
    if (woc?.setMood) woc.setMood(mood);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2300);
  }

  // Load persisted UI state
  useEffect(() => {
    setInvited(safeLocalGet(LS.invited, "0") === "1");
    setSelectedGuildId(safeLocalGet(LS.selectedGuild, "") || "");
    setLinkedGuildId(safeLocalGet(LS.linkedGuild, "") || "");
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Persist selection/link
  useEffect(() => {
    if (selectedGuildId) safeLocalSet(LS.selectedGuild, selectedGuildId);
  }, [selectedGuildId]);

  useEffect(() => {
    if (linkedGuildId) safeLocalSet(LS.linkedGuild, linkedGuildId);
  }, [linkedGuildId]);

  // Fetch guilds via your API route (server-side Discord call)
  useEffect(() => {
    if (!authed) {
      setGuilds([]);
      setGuildsError("");
      setGuildsSource("loading");
      return;
    }

    let cancelled = false;

    async function run() {
      setGuildsError("");
      setGuildsSource("loading");

      try {
        const res = await fetch("/api/discord/guilds", { cache: "no-store" });

        // If route isn't created yet or errors, we fall back
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Guild fetch failed (${res.status}). ${txt}`.trim());
        }

        const data = await res.json().catch(() => ({}));

        // expected-ish: { guilds: [...], source?: "live"|"fallback", error?: string }
        const list = Array.isArray(data.guilds) ? data.guilds : [];
        const src = data.source === "live" || data.source === "fallback" ? data.source : "live";
        const err = typeof data.error === "string" ? data.error : "";

        if (cancelled) return;

        if (!list.length) {
          setGuilds(FALLBACK_GUILDS);
          setGuildsSource("fallback");
          setGuildsError(err || "No manageable guilds returned. Using fallback list.");
        } else {
          setGuilds(
            list.map((g) => ({
              id: String(g.id),
              name: g.name,
              icon: g.icon ?? null,
              role: g.role || "Manager",
            }))
          );
          setGuildsSource(src);
          if (err) setGuildsError(err);
        }

        // Selection: keep saved if exists, else first
        const savedSel = safeLocalGet(LS.selectedGuild, "") || "";
        const effective = (list.length ? list : FALLBACK_GUILDS).find((x) => String(x.id) === String(savedSel));
        const firstId = String((list.length ? list : FALLBACK_GUILDS)[0]?.id || "");
        setSelectedGuildId(savedSel && effective ? String(savedSel) : firstId);

      } catch (e) {
        if (cancelled) return;
        setGuilds(FALLBACK_GUILDS);
        setGuildsSource("fallback");
        setGuildsError(
          e?.message ||
            "Failed to fetch guilds. Make sure /api/discord/guilds exists and NextAuth is configured."
        );
        setSelectedGuildId((prev) => prev || String(FALLBACK_GUILDS[0]?.id || ""));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  const selectedGuild = useMemo(
    () => guilds.find((g) => g.id === selectedGuildId) || null,
    [guilds, selectedGuildId]
  );

  const linkedGuild = useMemo(
    () => guilds.find((g) => g.id === linkedGuildId) || null,
    [guilds, linkedGuildId]
  );

  const inviteGateReady = invited && authed;

  function handleInviteClick() {
    safeLocalSet(LS.invited, "1");
    setInvited(true);
    showToast("Invite step marked as done. WoC approves. ✅", "story");
  }

  // Fake “link & sync”
  function beginFakeSync() {
    if (!selectedGuildId) return;

    setClaimResult(null);
    setSyncedAt(null);
    setSyncing(true);
    setSyncProgress(2);

    if (woc?.setMood) woc.setMood("battle");

    let t = 0;
    const interval = setInterval(() => {
      t += 1;

      setSyncProgress((p) => {
        const bump = p + (p < 70 ? 8 : p < 90 ? 4 : 2);
        return clamp(bump, 0, 99);
      });

      if (t === 4 && woc?.setMood) woc.setMood("omen");
      if (t === 7 && woc?.setMood) woc.setMood("story");

      if (t >= 14) {
        clearInterval(interval);
        setTimeout(() => {
          setSyncProgress(100);
          setTimeout(() => {
            setSyncing(false);
            setLinkedGuildId(selectedGuildId);
            setSyncedAt(new Date());
            showToast("Server linked. Threads aligned. ✨", "playful");
          }, 260);
        }, 260);
      }
    }, 170);
  }

  // Cooldown ticker
  useEffect(() => {
    function tick() {
      try {
        const topAt = parseInt(safeLocalGet(LS.claimTopggAt, "0") || "0", 10);
        const dblAt2 = parseInt(safeLocalGet(LS.claimDblAt, "0") || "0", 10);
        const cd = hoursToMs(COOLDOWN_HOURS);
        const now = Date.now();
        setTopggLeft(topAt ? Math.max(0, topAt + cd - now) : 0);
        setDblLeft(dblAt2 ? Math.max(0, dblAt2 + cd - now) : 0);
      } catch {
        setTopggLeft(0);
        setDblLeft(0);
      }
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Fake claim (returns {ok:boolean, title, msg})
  async function fakeVerifyAndClaim(source) {
    setClaimResult(null);
    setClaimingSource(source);
    if (woc?.setMood) woc.setMood("flustered");

    await new Promise((r) => setTimeout(r, 1100));

    const ok = Math.random() > 0.22;

    if (!ok) {
      const res = {
        ok: false,
        title: "Claim failed",
        msg: "Vote not verified yet. (This will plug into Top.gg + DBL APIs later.)",
      };
      setClaimResult(res);
      setClaimingSource(null);
      if (woc?.setMood) woc.setMood("omen");
      return res;
    }

    // set cooldown now (single source of truth)
    const key = source === "topgg" ? LS.claimTopggAt : LS.claimDblAt;
    safeLocalSet(key, String(Date.now()));

    const res = {
      ok: true,
      title: "Claim successful",
      msg: `+${CLAIM_REWARD} WoC Coins queued. (Backend wiring later.)`,
    };
    setClaimResult(res);
    setClaimingSource(null);
    if (woc?.setMood) woc.setMood("playful");
    return res;
  }

  const inviteLink = "https://discord.com/oauth2/authorize"; // swap later to your real invite URL

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-14">
      <div className="woc-card p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)] max-w-2xl">
              Track votes, rewards, and your server progress. WoC doesn’t hand out coins for free,
              it makes you earn them with style.
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

        {/* Main states */}
        {loading ? (
          <div className="mt-8 text-sm text-[var(--text-muted)]">Loading your portal…</div>
        ) : !authed ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="woc-card p-5">
              <h2 className="font-semibold">Step 1: Invite WoC</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Recommended first. Invite the bot to your server so the dashboard can actually show
                something meaningful.
              </p>

              <a
                className="mt-4 inline-flex w-full justify-center items-center gap-2 woc-btn-primary"
                href={inviteLink}
                target="_blank"
                rel="noreferrer"
                onClick={handleInviteClick}
              >
                Add WoC to Discord <span className="text-base">➕</span>
              </a>

              <p className="mt-3 text-xs text-[var(--text-muted)]">
                (This just marks the step as done for now. Later we’ll detect real installs.)
              </p>
            </div>

            <div className="woc-card p-5">
              <h2 className="font-semibold">Step 2: Sign in</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Sign in with Discord to see your servers and claim rewards.
              </p>

              <button
                onClick={() => signIn("discord")}
                className="mt-4 inline-flex w-full justify-center items-center gap-2 woc-btn-ghost"
              >
                Sign in with Discord <span>🔐</span>
              </button>

              <p className="mt-3 text-xs text-[var(--text-muted)]">
                No account creation. Discord does the paperwork.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Signed-in banner */}
            <div className="mt-8 woc-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-[var(--text-muted)]">Signed in as</div>
                  <div className="font-semibold">{userName}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    Choose a server, link it, then claim vote rewards.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (!invited) return showToast("Invite WoC first to unlock claiming.", "omen");
                      setClaimOpen(true);
                      if (woc?.setMood) woc.setMood("omen");
                    }}
                    className="woc-btn-ghost text-sm inline-flex items-center gap-2"
                  >
                    Claim vote reward <span>🗳️</span>
                  </button>
                </div>
              </div>

              {guildsError ? (
                <div className="mt-4 text-xs text-rose-200/90 bg-rose-500/10 border border-rose-400/30 rounded-xl p-3">
                  <div className="font-semibold">Guild fetch warning</div>
                  <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">{guildsError}</div>
                  <div className="mt-2 text-[0.78rem] text-[var(--text-muted)]">
                    Using fallback server list so the UI still works.
                  </div>
                </div>
              ) : null}
            </div>

            {/* Main grid */}
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {/* Server selector */}
              <div className="woc-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Server selector</h2>
                  <span className="text-xs text-[var(--text-muted)]">
                    {guildsSource === "fallback"
                      ? "(demo)"
                      : guildsSource === "live"
                      ? "(live guilds)"
                      : "(loading)"}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="text-xs text-[var(--text-muted)]">Select a server you manage</label>

                  <select
                    value={selectedGuildId}
                    onChange={(e) => {
                      setSelectedGuildId(e.target.value);
                      setSyncedAt(null);
                      setClaimResult(null);
                      if (woc?.setMood) woc.setMood("story");
                    }}
                    className="
                      w-full px-3 py-2 rounded-xl
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

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-[var(--text-muted)]">
                      Selected:{" "}
                      <span className="text-[var(--text-main)] font-medium">
                        {selectedGuild?.name || "—"}
                      </span>
                    </div>

                    {!invited ? (
                      <a
                        href={inviteLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={handleInviteClick}
                        className="woc-btn-primary text-sm inline-flex items-center gap-2"
                      >
                        Invite WoC <span>➕</span>
                      </a>
                    ) : (
                      <button
                        onClick={beginFakeSync}
                        disabled={syncing || !inviteGateReady}
                        className={`woc-btn-primary text-sm inline-flex items-center gap-2 ${
                          syncing ? "opacity-80 cursor-not-allowed" : ""
                        }`}
                        title={!inviteGateReady ? "Invite + be signed in to link." : "Link & sync"}
                      >
                        {syncing ? (
                          <>
                            Syncing… <span className="animate-woc-pulse">✨</span>
                          </>
                        ) : (
                          <>
                            Link & sync <span>🔄</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Sync bar */}
                  <div className="mt-3">
                    <div className="h-2 w-full rounded-full bg-[color-mix(in_oklab,var(--bg-card)_60%,transparent)] border border-[var(--border-subtle)]/60 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${syncProgress}%`,
                          background: "var(--accent)",
                          transition: "width 160ms linear",
                        }}
                      />
                    </div>

                    <div className="mt-2 text-xs text-[var(--text-muted)] flex items-center justify-between">
                      <span>
                        {syncing
                          ? "Scanning server data, inventories, and vote status…"
                          : syncedAt
                          ? `Synced: ${syncedAt.toLocaleTimeString()}`
                          : linkedGuildId
                          ? "Linked (not synced yet)"
                          : "Not linked yet."}
                      </span>
                      <span>{syncProgress}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats preview */}
              <div className="woc-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Server stats (preview)</h2>
                  <span className="text-xs text-[var(--text-muted)]">{selectedGuild?.role || "—"}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <StatTile label="Votes (7d)" value="—" hint="(wire later)" />
                  <StatTile label="Vote streak" value="—" hint="(wire later)" />
                  <StatTile
                    label="Rewards claimable"
                    value={syncing ? "…" : invited ? "Yes" : "No"}
                    hint={invited ? "invite gate passed" : "invite WoC first"}
                  />
                  <StatTile label="WoC currency" value="—" hint="(wire later)" />
                </div>

                <div className="mt-4 text-xs text-[var(--text-muted)]">
                  Linked server:{" "}
                  <span className="text-[var(--text-main)] font-medium">
                    {linkedGuild?.name || "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Coming next */}
            <div className="mt-6 woc-card p-6">
              <h2 className="font-semibold">Coming next</h2>
              <ul className="mt-2 text-sm text-[var(--text-muted)] list-disc pl-5 space-y-1">
                <li>Real bot install detection per server (invite gate becomes real)</li>
                <li>Top.gg + DBL vote verification via webhooks + your backend DB</li>
                <li>/api/votes/verify + /api/rewards/claim endpoints</li>
                <li>Rewards ledger + claim history</li>
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Vote Claim Modal */}
      <Modal
        open={claimOpen}
        onClose={() => {
          setClaimOpen(false);
          setClaimResult(null);
          if (woc?.setMood) woc.setMood("story");
        }}
        title="Vote Claim Terminal"
        subtitle="This will later verify Top.gg + DBL votes via API."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_75%,transparent)] p-3">
            <div className="text-xs text-[var(--text-muted)]">Selected server</div>
            <div className="font-semibold mt-1">{selectedGuild?.name || "—"}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Top.gg */}
            <div className="woc-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Top.gg</div>
                  <div className="text-[0.78rem] text-[var(--text-muted)]">
                    Cooldown: {COOLDOWN_HOURS}h
                  </div>
                </div>
                <span className="woc-tag">+{CLAIM_REWARD}</span>
              </div>

              <div className="mt-3 text-sm text-[var(--text-muted)]">
                Status:{" "}
                {topggLeft > 0 ? (
                  <span className="font-semibold">{formatTimeLeft(topggLeft)}</span>
                ) : (
                  <span className="font-semibold text-[var(--text-main)]">Ready</span>
                )}
              </div>

              <button
                type="button"
                className="mt-3 woc-btn-primary w-full"
                disabled={topggLeft > 0 || !!claimingSource}
                onClick={() => fakeVerifyAndClaim("topgg")}
              >
                {claimingSource === "topgg" ? "Verifying…" : "Verify + claim"}
              </button>

              <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                Later: verify via Top.gg webhook/API for this user.
              </div>
            </div>

            {/* DBL */}
            <div className="woc-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">DiscordBotList</div>
                  <div className="text-[0.78rem] text-[var(--text-muted)]">
                    Cooldown: {COOLDOWN_HOURS}h
                  </div>
                </div>
                <span className="woc-tag">+{CLAIM_REWARD}</span>
              </div>

              <div className="mt-3 text-sm text-[var(--text-muted)]">
                Status:{" "}
                {dblLeft > 0 ? (
                  <span className="font-semibold">{formatTimeLeft(dblLeft)}</span>
                ) : (
                  <span className="font-semibold text-[var(--text-main)]">Ready</span>
                )}
              </div>

              <button
                type="button"
                className="mt-3 woc-btn-primary w-full"
                disabled={dblLeft > 0 || !!claimingSource}
                onClick={() => fakeVerifyAndClaim("dbl")}
              >
                {claimingSource === "dbl" ? "Verifying…" : "Verify + claim"}
              </button>

              <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                Later: verify via DBL webhook/API for this user.
              </div>
            </div>
          </div>

          {claimResult ? (
            <div
              className={`rounded-xl p-3 border ${
                claimResult.ok
                  ? "border-emerald-400/40 bg-emerald-500/10"
                  : "border-rose-400/40 bg-rose-500/10"
              }`}
            >
              <div className="font-semibold text-sm">{claimResult.title}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{claimResult.msg}</div>
            </div>
          ) : null}

          <div className="text-[0.72rem] text-[var(--text-muted)]">
            Next step: wire this modal into <code>/api/votes/verify</code> and{" "}
            <code>/api/rewards/claim</code>.
          </div>
        </div>
      </Modal>
    </div>
  );
}
