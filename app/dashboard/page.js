// app/dashboard/page.js
"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const authed = !!session?.user;

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-14">
      <div className="woc-card p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)] max-w-2xl">
          Track votes, rewards, and your server progress. WoC doesn’t hand out coins
          for free, it makes you earn them with style.
        </p>

        {loading ? (
          <div className="mt-8 text-sm text-[var(--text-muted)]">
            Loading your portal…
          </div>
        ) : !authed ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {/* Invite first */}
            <div className="woc-card p-5">
              <h2 className="font-semibold">Step 1: Invite WoC</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Recommended first. Invite the bot to your server so the dashboard can
                actually show something meaningful.
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

            {/* Sign in */}
            <div className="woc-card p-5">
              <h2 className="font-semibold">Step 2: Sign in</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Sign in with Discord to track votes and claim rewards.
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
          <div className="mt-8 space-y-4">
            <div className="woc-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-[var(--text-muted)]">Signed in as</div>
                  <div className="font-semibold">
                    {session.user?.name || "Discord User"}
                  </div>
                </div>

                <Link
                  href="/vote"
                  className="inline-flex items-center gap-2 woc-btn-ghost text-sm"
                >
                  Go vote for rewards <span>🗳️</span>
                </Link>
              </div>

              <div className="mt-4 text-sm text-[var(--text-muted)]">
                Next: we’ll plug your servers + vote history in here (Top.gg + DBL),
                then show your earned WoC currency.
              </div>
            </div>

            <div className="woc-card p-5">
              <h2 className="font-semibold">Coming next</h2>
              <ul className="mt-2 text-sm text-[var(--text-muted)] list-disc pl-5 space-y-1">
                <li>Server selector (guilds you manage)</li>
                <li>Vote streaks + claim timers</li>
                <li>Rewards ledger (what you earned + when)</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
