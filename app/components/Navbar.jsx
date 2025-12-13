// app/components/Navbar.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import { useSession } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();
  const isAuthed = !!session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)]/40 bg-[color-mix(in_oklab,var(--bg-root)_80%,transparent)] backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* LEFT: Avatar + title */}
        <div className="flex items-center gap-3">
          <div
            className="
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
                object-[26%_40%]
                scale-[1.7]
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
            <div className="text-[0.7rem] text-[var(--text-muted)]">
              Discord adventure engine
            </div>
          </div>
        </div>

        {/* CENTER: navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/" className="nav-link">Overview</Link>
          <Link href="/commands" className="nav-link">Commands</Link>
          <Link href="/docs" className="nav-link">Docs</Link>
          <Link href="/vote" className="nav-link">Vote</Link>

          {/* Dashboard always visible */}
          <Link
            href="/dashboard"
            className="
              inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full
              border border-[var(--border-subtle)]/60
              bg-[color-mix(in_oklab,var(--bg-card)_75%,transparent)]
              hover:-translate-y-[1px] transition-transform
            "
          >
            <span>Dashboard</span>
            {!isAuthed && (
              <span className="text-[0.65rem] uppercase tracking-wider text-[var(--text-muted)]">
                Login
              </span>
            )}
          </Link>
        </nav>

        {/* RIGHT: theme + CTA */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <Link
            href="/vote"
            className="
              inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full
              border border-[var(--border-subtle)]/70
              bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
              hover:-translate-y-[1px] transition-transform
            "
          >
            <span>Vote</span>
            <span>🗳️</span>
          </Link>

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

      {/* small utility styles */}
      <style jsx>{`
        .nav-link {
          color: var(--text-muted);
          transition: color 0.15s ease;
        }
        .nav-link:hover {
          color: var(--text-main);
        }
      `}</style>
    </header>
  );
}
