// app/components/Navbar.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const { data: session, status } = useSession();
  const authed = status === "authenticated";

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // close dropdown when clicking outside
  useEffect(() => {
    function onDown(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Use Discord avatar if present
  const userName =
    session?.user?.name || session?.user?.email?.split("@")?.[0] || "Adventurer";

  const userImage = session?.user?.image || "/woc-avatar.png";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)]/40 bg-[color-mix(in_oklab,var(--bg-root)_80%,transparent)] backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Avatar + title */}
        <Link href="/" className="flex items-center gap-3 min-w-[220px]">
          {/* WoC avatar logo */}
          <div
            className="
              woc-avatar
              relative h-11 w-11 rounded-full overflow-hidden
              shadow-lg border border-[var(--border-subtle)]
              bg-[var(--bg-card)]
              flex-shrink-0
            "
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
                object-[22%_42%]
                scale-[1.75]
                pointer-events-none
              "
            />
            {/* Glow ring */}
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
            className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full
                       border border-[var(--border-subtle)]/70
                       bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                       text-[var(--text-main)]
                       hover:-translate-y-[1px] transition-transform"
          >
            <span>Dashboard</span>
            <span className="text-[0.75rem] opacity-80">↗</span>
          </Link>
        </nav>

        {/* Right: theme + actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* Small Vote pill */}
          <Link
            href="/vote"
            className="hidden sm:inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full
                       border border-[var(--border-subtle)]/70
                       bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                       text-[var(--text-main)]
                       hover:-translate-y-[1px] transition-transform"
          >
            <span>Vote</span>
            <span>🗳️</span>
          </Link>

          {/* If authed: show account pill */}
          {authed && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="
                  inline-flex items-center gap-2
                  text-xs sm:text-sm
                  px-3 py-1.5 rounded-full
                  border border-[var(--border-subtle)]/70
                  bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                  hover:-translate-y-[1px] transition-transform
                "
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <span className="relative h-6 w-6 rounded-full overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                  <Image
                    src={userImage}
                    alt="Your avatar"
                    fill
                    sizes="24px"
                    className="object-cover"
                  />
                </span>
                <span className="max-w-[110px] truncate">{userName}</span>
                <span className="opacity-70">▾</span>
              </button>

              {open && (
                <div
                  className="
                    absolute right-0 mt-2 w-44
                    rounded-xl border border-[var(--border-subtle)]/70
                    bg-[color-mix(in_oklab,var(--bg-root)_86%,transparent)]
                    backdrop-blur-xl
                    shadow-2xl
                    overflow-hidden
                  "
                  role="menu"
                >
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 text-sm hover:bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]"
                    role="menuitem"
                  >
                    Dashboard
                  </Link>

                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Invite CTA */}
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
