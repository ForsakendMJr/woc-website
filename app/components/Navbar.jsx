"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();

  const userName =
    session?.user?.name ||
    session?.user?.email ||
    "Signed in";

  const userImage = session?.user?.image || null;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)]/40 bg-[color-mix(in_oklab,var(--bg-root)_80%,transparent)] backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Bot Avatar + Name */}
        <Link href="/" className="flex items-center gap-3 min-w-[240px]">
          <div
            className="
              relative h-11 w-11 rounded-full overflow-hidden
              shadow-lg border border-[var(--border-subtle)]
              bg-[var(--bg-card)]
            "
            aria-label="WoC"
            title="World of Communities"
          >
            <Image
              src="/woc-avatar.png"
              alt="WoC avatar"
              fill
              sizes="44px"
              priority
              className="
                object-cover
                scale-[1.75]
                translate-x-[6px]
                translate-y-[6px]
                pointer-events-none
              "
            />
            <span
              className="
                pointer-events-none absolute inset-0 rounded-full
                ring-2 ring-[var(--accent)] ring-offset-[3px]
                ring-offset-[var(--bg-root)]
                opacity-90
              "
            />
          </div>

          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">
              World of Communities
            </div>
            {/* Removed subtitle: "Discord adventure engine" */}
          </div>
        </Link>

        {/* Center: nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link
            href="/"
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            Overview
          </Link>

          <Link
            href="/commands"
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            Commands
          </Link>

          <Link
            href="/docs"
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            Docs
          </Link>

          <Link
            href="/vote"
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            Vote
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-[var(--border-subtle)]/60 bg-[color-mix(in_oklab,var(--bg-card)_75%,transparent)] text-[var(--text-main)] hover:-translate-y-[1px] transition-transform"
          >
            <span>Dashboard</span>
            <span className="opacity-70">↗</span>
          </Link>
        </nav>

        {/* Right: theme + user + CTA */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* User chip */}
          {status === "authenticated" ? (
            <div className="flex items-center gap-2">
              <div className="relative h-8 w-8 rounded-full overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                {userImage ? (
                  <Image
                    src={userImage}
                    alt={userName}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[0.7rem] font-semibold text-[var(--text-main)]">
                    {String(userName).slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <button
                onClick={() => signOut()}
                className="hidden sm:inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] text-[var(--text-main)] hover:-translate-y-[1px] transition-transform"
                title={userName}
              >
                <span className="max-w-[140px] truncate">{userName}</span>
                <span className="opacity-70">⏻</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("discord")}
              className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] text-[var(--text-main)] hover:-translate-y-[1px] transition-transform"
            >
              <span>Sign in</span>
              <span>🔑</span>
            </button>
          )}

          {/* CTA */}
          <a
            href="https://discord.com/oauth2/authorize"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-2 text-xs sm:text-sm woc-btn-primary"
          >
            <span>Add WoC to Discord</span>
            <span className="text-base">➕</span>
          </a>
        </div>
      </div>
    </header>
  );
}
