// app/components/Navbar.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)]/40 bg-[color-mix(in_oklab,var(--bg-root)_80%,transparent)] backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Avatar + title */}
        <div className="flex items-center gap-3">
          {/* WoC avatar logo – mood reactive */}
          <div
            className="
              woc-avatar
              relative h-11 w-11 rounded-full overflow-hidden
              shadow-lg border border-[var(--border-subtle)]
              bg-[var(--bg-card)]
            "
          >
            <Image
              src="/woc-avatar.png"
              alt="WoC avatar"
              fill
              sizes="44px"
              priority
              className="
                object-cover 
                object-[38%_48%]      /* tuned to your art so face sits centered */
                pointer-events-none
              "
            />

            {/* Glow ring – color shifts with mood */}
            <span
              className="
                woc-avatar-ring
                pointer-events-none absolute inset-0 rounded-full 
                ring-2 ring-[var(--accent)] ring-offset-[3px] 
                ring-offset-[var(--bg-root)]
                opacity-90
              "
            />
          </div>

          {/* Name + subtitle */}
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">
              World of Communities
            </div>
            <div className="text-[0.7rem] text-[var(--text-muted)]">
              Discord adventure engine
            </div>
          </div>
        </div>

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

          <span className="inline-flex items-center gap-1 text-[var(--text-muted)] text-xs px-2 py-1 rounded-full bg-[color-mix(in_oklab,var(--bg-card)_75%,transparent)] border border-[var(--border-subtle)]/60">
            <span>Dashboard</span>
            <span className="text-[0.7rem] uppercase tracking-[0.16em]">
              Coming soon
            </span>
          </span>
        </nav>

        {/* Right: theme + CTA */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <a
            href="https://discord.com/oauth2/authorize" // swap with your real invite
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
