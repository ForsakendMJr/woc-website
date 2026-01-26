"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import { useSession, signIn, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isSnowflake(id) {
  const s = String(id || "").trim();
  if (!s) return false;
  if (s === "undefined" || s === "null") return false;
  return /^[0-9]{17,20}$/.test(s);
}

function NavLink({ href, children }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={cx(
        "relative text-sm transition",
        "text-[var(--text-muted)] hover:text-[var(--text-main)]",
        "px-3 py-2 rounded-full",
        active
          ? "text-[var(--text-main)] bg-[color-mix(in_oklab,var(--accent-soft)_35%,transparent)] border border-[var(--border-subtle)]/70"
          : "hover:bg-[color-mix(in_oklab,var(--bg-card)_55%,transparent)]"
      )}
    >
      {children}
      {active ? (
        <span className="pointer-events-none absolute inset-x-3 -bottom-[7px] h-[2px] rounded-full bg-[var(--accent)] opacity-80" />
      ) : null}
    </Link>
  );
}

export default function Navbar() {
  const { data: session, status } = useSession();

  const userName = session?.user?.name || session?.user?.email || "Signed in";
  const userImage = session?.user?.image || null;

  // Invite URL (same logic as dashboard)
  const clientIdRaw = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "";
  const clientId = String(clientIdRaw || "").trim();
  const hasClientId = isSnowflake(clientId);

  const inviteUrl = (() => {
    if (!hasClientId) return "";
    const params = new URLSearchParams();
    params.set("client_id", clientId);
    params.set("scope", "bot applications.commands");
    params.set("permissions", "8");
    params.set("integration_type", "0");
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  })();

  return (
    <header
      className="
        sticky top-0 z-40
        border-b border-[var(--border-subtle)]/35
        bg-[color-mix(in_oklab,var(--bg-root)_70%,transparent)]
        backdrop-blur-xl
      "
    >
      {/* glow line */}
      <div className="pointer-events-none h-[1px] w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <Link href="/" className="group flex items-center gap-3 min-w-[220px]">
          {/* Bot avatar (fixed: no translate/scale hacks) */}
          <div
            className="
              relative h-10 w-10 sm:h-11 sm:w-11
              rounded-full overflow-hidden
              border border-[var(--border-subtle)]/70
              bg-[color-mix(in_oklab,var(--bg-card)_80%,transparent)]
              shadow-[0_10px_30px_rgba(0,0,0,0.35)]
            "
            aria-label="WoC"
            title="Web of Communities"
          >
            <Image
              src="/woc-avatar.png"
              alt="WoC avatar"
              fill
              sizes="44px"
              priority
              className="object-cover object-center"
            />
            {/* ring glow */}
            <span
              className="
                pointer-events-none absolute inset-0 rounded-full
                ring-2 ring-[var(--accent)]/70 ring-offset-[3px]
                ring-offset-[color-mix(in_oklab,var(--bg-root)_85%,transparent)]
              "
            />
          </div>

          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide text-[var(--text-main)]">
              Web of Communities
            </div>
            <div className="text-[0.72rem] text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition">
              Control panel · modules · logs · vibes
            </div>
          </div>
        </Link>

        {/* Center: nav links */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink href="/">Overview</NavLink>
          <NavLink href="/commands">Commands</NavLink>
          <NavLink href="/docs">Docs</NavLink>
          <NavLink href="/vote">Vote</NavLink>

          <Link
            href="/dashboard"
            className="
              ml-2 inline-flex items-center gap-2
              text-sm px-4 py-2 rounded-full
              border border-[var(--border-subtle)]/70
              bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
              text-[var(--text-main)]
              hover:-translate-y-[1px] hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]
              transition
              shadow-[0_10px_30px_rgba(0,0,0,0.18)]
            "
          >
            <span>Dashboard</span>
            <span className="opacity-70">↗</span>
          </Link>
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* User chip */}
          {status === "authenticated" ? (
            <div className="flex items-center gap-2">
              <div
                className="
                  relative h-9 w-9 rounded-full overflow-hidden
                  border border-[var(--border-subtle)]/70
                  bg-[color-mix(in_oklab,var(--bg-card)_80%,transparent)]
                "
                title={userName}
              >
                {userImage ? (
                  <Image src={userImage} alt={userName} fill sizes="36px" className="object-cover object-center" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[0.75rem] font-semibold text-[var(--text-main)]">
                    {String(userName).slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <button
                onClick={() => signOut()}
                className="
                  hidden sm:inline-flex items-center gap-2
                  text-xs px-3 py-2 rounded-full
                  border border-[var(--border-subtle)]/70
                  bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                  text-[var(--text-main)]
                  hover:-translate-y-[1px] hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]
                  transition
                "
                title="Sign out"
              >
                <span className="max-w-[140px] truncate">{userName}</span>
                <span className="opacity-70">⏻</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("discord")}
              className="
                inline-flex items-center gap-2
                text-xs px-3 py-2 rounded-full
                border border-[var(--border-subtle)]/70
                bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                text-[var(--text-main)]
                hover:-translate-y-[1px] hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]
                transition
              "
            >
              <span>Sign in</span>
              <span>🔑</span>
            </button>
          )}

          {/* CTA */}
          <a
            href={hasClientId ? inviteUrl : undefined}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (!hasClientId) e.preventDefault();
            }}
            title={
              hasClientId
                ? "Invite WoC to a server"
                : "Missing NEXT_PUBLIC_DISCORD_CLIENT_ID (set it in env and redeploy)"
            }
            className={cx(
              `
                hidden sm:inline-flex items-center gap-2
                text-xs sm:text-sm px-4 py-2 rounded-full
                text-[var(--text-main)]
                border border-[color-mix(in_oklab,var(--accent)_55%,transparent)]
                bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_75%,transparent),color-mix(in_oklab,var(--accent-soft)_55%,transparent))]
                shadow-[0_14px_40px_rgba(0,0,0,0.35)]
                hover:-translate-y-[1px] active:translate-y-0
                transition
              `,
              !hasClientId ? "opacity-60 cursor-not-allowed" : ""
            )}
          >
            <span>Add WoC to Discord</span>
            <span className="text-base">➕</span>
          </a>
        </div>
      </div>
    </header>
  );
}
