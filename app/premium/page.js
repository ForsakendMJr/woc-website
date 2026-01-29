// app/premium/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const STATUS_ENDPOINT = "/api/premium/status";

const TIERS = [
  { level: "1", tier: "supporter", label: "Level 1", perks: ["Core premium", "Basic donor perks"] },
  { level: "2", tier: "supporter_plus", label: "Level 2", perks: ["Everything in L1", "More premium modules"] },
  { level: "3", tier: "supporter_plus_plus", label: "Level 3", perks: ["Everything in L2", "Highest tier perks"] },
];

const TIER_ORDER = ["free", "supporter", "supporter_plus", "supporter_plus_plus"];
const tierRank = (t) => {
  const x = String(t || "free").toLowerCase().trim();
  const i = TIER_ORDER.indexOf(x);
  return i === -1 ? 0 : i;
};

function TierBadge({ tier }) {
  const label =
    tier === "supporter"
      ? "Supporter"
      : tier === "supporter_plus"
      ? "Supporter+"
      : tier === "supporter_plus_plus"
      ? "Supporter++"
      : "Free";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/90">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      Premium: <span className="font-semibold">{label}</span>
    </span>
  );
}

function Card({ children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-md">
      {children}
    </div>
  );
}

export default function PremiumPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function loadStatus() {
    setErr("");
    setLoading(true);
    try {
      const r = await fetch(STATUS_ENDPOINT, { cache: "no-store" });
      const j = await r.json();
      setStatus(j);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  const currentTier = useMemo(() => {
    return String(status?.tier || "free").toLowerCase().trim();
  }, [status]);

  const currentRank = useMemo(() => tierRank(currentTier), [currentTier]);

  const authed = !!status?.authed;

  function goCheckout(level) {
    // your checkout route is /api/premium/checkout?level=#
    window.location.href = `/api/premium/checkout?level=${encodeURIComponent(level)}`;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#070B18] via-[#070B18] to-black px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">WoC Premium</h1>
            <p className="mt-2 text-white/70">
              Manage your subscription, unlock premium features, and sync your donor powers in the WoC hub.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <TierBadge tier={currentTier} />
            <button
              onClick={loadStatus}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Refresh status
            </button>
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <Card>
          <div className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-white/60">Your status</div>
                <div className="mt-1 text-lg font-semibold">
                  {loading ? "Checking the vault..." : authed ? "Signed in ✅" : "Not signed in"}
                </div>
              </div>

              <div className="text-sm text-white/70">
                {err ? (
                  <span className="text-red-300">Error: {err}</span>
                ) : status?.discordId ? (
                  <>
                    Discord ID: <span className="font-mono text-white/90">{status.discordId}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
              {loading ? (
                <div className="animate-pulse text-white/60">Loading status JSON…</div>
              ) : (
                <pre className="whitespace-pre-wrap break-words">{JSON.stringify(status, null, 2)}</pre>
              )}
            </div>

            <div className="mt-4 text-xs text-white/50">
              Roles are applied in your WoC hub server automatically after purchase. If you’re already in the hub, it
              should sync within seconds (sometimes Discord takes a moment).
            </div>
          </div>
        </Card>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => {
            const rank = tierRank(t.tier);
            const isCurrent = authed && currentRank === rank;
            const isBelowOrEqual = authed && currentRank >= rank;

            // ✅ Hide lower tiers completely once you’re above them
            if (authed && currentRank > rank) return null;

            return (
              <Card key={t.level}>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/60">{t.label}</div>
                      <div className="mt-1 text-xl font-semibold">{t.tier.replaceAll("_", " ")}</div>
                    </div>

                    {isCurrent ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                        Current
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                        Upgrade
                      </span>
                    )}
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-white/70">
                    {t.perks.map((p) => (
                      <li key={p} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                        {p}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {!authed ? (
                      <Link
                        href="/dashboard"
                        className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
                      >
                        Sign in via dashboard
                      </Link>
                    ) : isCurrent ? (
                      <button
                        disabled
                        className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/50"
                      >
                        You’re already {t.label}
                      </button>
                    ) : isBelowOrEqual ? (
                      <button
                        onClick={() => goCheckout(t.level)}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-violet-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
                      >
                        Upgrade to {t.label}
                      </button>
                    ) : (
                      <button
                        onClick={() => goCheckout(t.level)}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-violet-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
                      >
                        Buy {t.label}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-white/60">
          <div>
            Need help? If you bought Premium but don’t see roles, make sure you’re in the hub server:{" "}
            <span className="font-mono text-white/80">902705980993859634</span>
          </div>
          <div className="flex gap-3">
            <Link href="/premium/success" className="hover:text-white">
              Success page
            </Link>
            <span className="text-white/30">•</span>
            <a href="/api/premium/status" className="hover:text-white">
              Status API
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
