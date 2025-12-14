// app/dashboard/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useWocTheme } from "../WocThemeProvider";

/**
 * WoC Dashboard v2 (Frontend + real guild fetch)
 * - Real guild list via /api/discord/guilds (server-side NextAuth token)
 * - Server selector UI
 * - Fake “syncing” animation
 * - Vote Claim modal (stubbed verification for now)
 */

const FALLBACK_GUILDS = [
  { id: "1", name: "Mythralight Sanctuary", icon: null, role: "Owner", manageable: true },
  { id: "2", name: "Umbrarealm Archives", icon: null, role: "Admin", manageable: true },
  { id: "3", name: "Aurora District", icon: null, role: "Manager", manageable: true },
];

function GuildIcon({ guild }) {
  // If Discord provides an icon hash, we can build the URL directly
  const url =
    guild?.icon && guild?.id
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
      : null;

  if (!url) {
    return (
      <div className="h-8 w-8 rounded-full bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] border border-[var(--border-subtle)]/60 flex items-center justify-center text-xs">
        🏰
      </div>
    );
  }

  return (
    <span className="relative h-8 w-8 rounded-full overflow-hidden border border-[var(--border-subtle)]/60 bg-[var(--bg-card)]">
      <Image src={url} alt="" fill sizes="32px" className="object-cover" unoptimized />
    </span>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const authed = !!session?.user;

  // Mood hooks (optional)
  let woc = null;
  try {
    woc = useWocTheme();
  } catch {
    woc = null;
  }

  const userName =
    session?.user?.name || session?.user?.email?.split("@")?.[0] || "Adventurer";

  // Guild fetch state
  const [guilds, setGuilds] = useState([]);
  const [guildFetchError, setGuildFetchError] = useState("");
  const [usingFallback, setUsingFallback] = useState(false);
  const [fetchingGuilds, setFetchingGuilds] = useState(false);

  // Selector + fake syncing
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);

  // Vote claim modal
  const [claimOpen, setClaimOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState(null);

  const selectedGuild = useMemo(
    () => guilds.find((g) => g.id === selectedGuildId) || null,
    [guilds, selectedGuildId]
  );

  // Fetch guilds when signed in
  useEffect(() => {
    if (!authed) return;

    let ignore = false;

    async function run() {
      setFetchingGuilds(true);
      setGuildFetchError("");
      setUsingFallback(false);

      try {
        const res = await fetch("/api/discord/guilds", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
          const msg =
            data?.error === "NO_ACCESS_TOKEN"
              ? "No access token found. Check NextAuth callbacks, then sign out and sign in again."
              : data?.message || "Failed to fetch guilds from Discord.";
          throw new Error(msg);
        }

        const normalized = (data.guilds || []).map((g) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          manageable: !!g.manageable,
          role: g.owner ? "Owner" : g.manageable ? "Manage" : "Member",
        }));

        if (!ignore) {
          setGuilds(normalized.length ? normalized : FALLBACK_GUILDS);
          setUsingFallback(!normalized.length);
        }
      } catch (e) {
        if (!ignore) {
          setGuildFetchError(e?.message || "Guild fetch failed.");
          setGuilds(FALLBACK_GUILDS);
          setUsingFallback(true);
        }
      } finally {
        if (!ignore) setFetchingGuilds(false);
      }
    }

    run();

    return () => {
      ignore = true;
    };
  }, [authed]);

  // Auto pick first guild
  useEffect(() => {
    if (!authed) return;
    if (selectedGuildId) return;
    if (!guilds.length) return;
    setSelectedGuildId(guilds[0].id);
  }, [authed, guilds, selectedGuildId]);

  // Fake sync animation
  useEffect(() => {
    if (!syncing) return;

    let t = 0;
    setSyncProgress(0);
    woc?.setMood?.("story");

    const id = setInterval(() => {
      t += 1;
      setSyncProgress((p) => Math.min(100, p + 8));

      if (t === 3) woc?.setMood?.("omen");
      if (t === 6) woc?.setMood?.("battle");

      if (t >= 14) {
        clearInterval(id);
        setSyncing(false);
        setSyncedAt(new Date());
        setSyncProgress(100);
        woc?.setMood?.("playful");
      }
    }, 160);

    return () => clearInterval(id);
  }, [syncing]); // eslint-disable-line react-hooks/exhaustive-deps

  function startSync() {
    setClaimResult(null);
    setSyncedAt(null);
    setSyncing(true);
  }

  async function handleClaim() {
    setClaimResult(null);
    setClaiming(true);
    woc?.setMood?.("flustered");

    await new Promise((r) => setTimeout(r, 1100));

    const ok = Math.random() > 0.2;
    setClaiming(false);

    if (ok) {
      setClaimResult({
        ok: true,
        title: "Claim successful",
        msg: "Reward claimed (stub). Next: wire into /api/votes/verify + /api/rewards/claim.",
      });
      woc?.setMood?.("playful");
    } else {
      setClaimResult({
        ok: false,
        title: "Not verified yet",
        msg: "Vote not detected (stub). This becomes real once Top.gg/DBL are wired.",
      });
      woc?.setMood?.("omen");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-14">
      <div className="woc-card p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)] max-w-2xl">
          Track votes, rewards, and your server progress. Pick a server, sync it,
          then claim vote rewards.
        </p>

        {loading ? (
          <div className="mt-8 text-sm text-[var(--text-muted)]">Loading your portal…</div>
        ) : !authed ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="woc-card p-5">
              <h2 className="font-semibold">Step 1: Invite WoC</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Recommended first. Invite the bot so the dashboard can show meaningful data later.
              </p>
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
              <h2 className="font-semibold">Step 2: Sign in</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Sign in with Discord to access your servers and claim rewards.
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
          <div className="mt-8 space-y-6">
            {/* Signed-in header */}
            <div className="woc-card p-5">
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
                    onClick={() => setClaimOpen(true)}
                    className="woc-btn-ghost text-sm inline-flex items-center gap-2"
                  >
                    Claim vote reward <span>🗳️</span>
                  </button>

                  <Link href="/vote" className="woc-btn-ghost text-sm inline-flex items-center gap-2">
                    Voting links <span>↗</span>
                  </Link>
                </div>
              </div>

              {(guildFetchError || usingFallback) && (
                <div className="mt-4 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3">
                  <div className="font-semibold text-sm">Guild fetch warning</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {guildFetchError ? guildFetchError : "Using fallback server list so the UI still works."}
                  </div>
                </div>
              )}
            </div>

            {/* Selector + Sync */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="woc-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Server selector</h2>
                  <span className="text-xs text-[var(--text-muted)]">
                    {fetchingGuilds ? "Fetching…" : usingFallback ? "Fallback list" : "Live from Discord"}
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
                      woc?.setMood?.("story");
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
                    <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                      <GuildIcon guild={selectedGuild} />
                      <span>
                        Selected:{" "}
                        <span className="text-[var(--text-main)] font-medium">
                          {selectedGuild?.name || "—"}
                        </span>
                      </span>
                    </div>

                    <button
                      onClick={startSync}
                      disabled={syncing || !selectedGuildId}
                      className={`woc-btn-primary text-sm inline-flex items-center gap-2 ${
                        syncing ? "opacity-80 cursor-not-allowed" : ""
                      }`}
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
                  </div>

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
                          : "Not synced yet."}
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
                  <span className="text-xs text-[var(--text-muted)]">
                    {selectedGuild?.role || "—"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: "Votes (7d)", value: "—" },
                    { label: "Vote streak", value: "—" },
                    { label: "Rewards claimable", value: syncing ? "…" : "—" },
                    { label: "WoC currency", value: "—" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-[var(--border-subtle)]/60 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] p-3"
                    >
                      <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
                      <div className="text-lg font-semibold mt-1">{s.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-xs text-[var(--text-muted)]">
                  Next: wire vote verification + server stats from your bot backend.
                </div>
              </div>
            </div>

            {/* Vote claim modal */}
            {claimOpen && (
              <div className="woc-intro-backdrop" role="dialog" aria-modal="true">
                <div className="woc-intro-dialog animate-woc-pop">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Vote Claim</div>
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        Stub now. Later verifies Top.gg + DBL and credits real currency.
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setClaimOpen(false);
                        woc?.setMood?.("story");
                      }}
                      className="woc-btn-ghost text-xs px-3 py-1"
                    >
                      Close ✕
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_75%,transparent)] p-3">
                      <div className="text-xs text-[var(--text-muted)]">Selected server</div>
                      <div className="font-semibold mt-1">{selectedGuild?.name || "—"}</div>
                    </div>

                    <button
                      onClick={handleClaim}
                      disabled={claiming}
                      className={`woc-btn-primary w-full justify-center inline-flex items-center gap-2 ${
                        claiming ? "opacity-80 cursor-not-allowed" : ""
                      }`}
                    >
                      {claiming ? (
                        <>
                          Verifying… <span className="animate-woc-pulse">✨</span>
                        </>
                      ) : (
                        <>
                          Verify & claim <span>🎁</span>
                        </>
                      )}
                    </button>

                    {claimResult && (
                      <div
                        className={`rounded-xl p-3 border ${
                          claimResult.ok
                            ? "border-emerald-400/40 bg-emerald-500/10"
                            : "border-rose-400/40 bg-rose-500/10"
                        }`}
                      >
                        <div className="font-semibold text-sm">{claimResult.title}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          {claimResult.msg}
                        </div>
                      </div>
                    )}

                    <div className="text-[0.72rem] text-[var(--text-muted)]">
                      Next: plug into <code>/api/votes/verify</code> and <code>/api/rewards/claim</code>.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
