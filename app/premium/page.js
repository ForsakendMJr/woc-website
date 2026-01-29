// app/premium/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const STATUS_ENDPOINT = "/api/premium/status";
const CHECKOUT_ENDPOINT = (level) =>
  `/api/premium/checkout?level=${encodeURIComponent(level)}`;
const SCHEDULE_UPGRADE_ENDPOINT = "/api/premium/schedule-upgrade";
const SYNC_ENDPOINT = "/api/premium/sync-roles";
const PORTAL_ENDPOINT = "/api/premium/portal";

const TIER_ORDER = ["free", "supporter", "supporter_plus", "supporter_plus_plus"];

function tierRank(tier) {
  const t = String(tier || "free").toLowerCase().trim();
  const i = TIER_ORDER.indexOf(t);
  return i === -1 ? 0 : i;
}

function prettyTier(tier) {
  const t = String(tier || "free").toLowerCase().trim();
  if (t === "supporter") return "Level 1 (Supporter)";
  if (t === "supporter_plus") return "Level 2 (Supporter+)";
  if (t === "supporter_plus_plus") return "Level 3 (Supporter++)";
  return "Free";
}

function tierPill(tier) {
  const t = String(tier || "free").toLowerCase().trim();
  if (t === "supporter") return "Premium: Level 1 ✨";
  if (t === "supporter_plus") return "Premium: Level 2 ✨✨";
  if (t === "supporter_plus_plus") return "Premium: Level 3 ✨✨✨";
  return "Premium: Free";
}

function planEmoji(rank) {
  if (rank === 3) return "👑";
  if (rank === 2) return "⚡";
  return "✨";
}

function formatDateTime(iso) {
  try {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDate(iso) {
  try {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function PremiumPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState("");

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const [portalLoading, setPortalLoading] = useState(false);

  const [schedLoading, setSchedLoading] = useState(false);
  const [schedMsg, setSchedMsg] = useState("");

  async function loadStatus() {
    try {
      setErr("");
      setLoading(true);
      const res = await fetch(STATUS_ENDPOINT, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load premium status.");
      setStatus(data);
    } catch (e) {
      setErr(String(e?.message || e));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  const authed = !!status?.authed;
  const tier = String(status?.tier || "free").toLowerCase().trim();
  const rank = tierRank(tier);
  const discordId = status?.discordId || "";
  const isPremium = !!status?.premium;

  // Optional: if your status endpoint exposes these, we’ll display them
  const pendingTier = String(status?.pendingTier || "").toLowerCase().trim();
  const pendingEffectiveAt = status?.pendingEffectiveAt || "";

  // NEW: renewal date + cancel state (if status endpoint provides it)
  const renewalAt = status?.renewalAt || "";
  const cancelAtPeriodEnd = !!status?.cancelAtPeriodEnd;

  const plans = useMemo(() => {
    return [
      {
        level: "1",
        tierKey: "supporter",
        title: "Level 1",
        subtitle: "Supporter",
        badge: "Starter",
        priceLabel: "£4.99/mo",
        perks: [
          "Premium modules unlocked",
          "Access to supporter-only features",
          "Donator role in WoC hub",
        ],
      },
      {
        level: "2",
        tierKey: "supporter_plus",
        title: "Level 2",
        subtitle: "Supporter+",
        badge: "Upgrade",
        priceLabel: "£7.99/mo",
        perks: [
          "Everything in Level 1",
          "More premium controls & perks",
          "Higher tier role in WoC hub",
        ],
      },
      {
        level: "3",
        tierKey: "supporter_plus_plus",
        title: "Level 3",
        subtitle: "Supporter++",
        badge: "Max",
        priceLabel: "£11.99/mo",
        perks: [
          "Everything in Level 2",
          "Full premium access",
          "Top tier role in WoC hub",
        ],
      },
    ];
  }, []);

  function goCheckout(level) {
    // For FREE users only, we start a new subscription
    window.location.href = CHECKOUT_ENDPOINT(level);
  }

  async function scheduleUpgrade(level) {
    try {
      setSchedLoading(true);
      setSchedMsg("");
      setErr("");

      const res = await fetch(SCHEDULE_UPGRADE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to schedule upgrade.");
      }

      const when = data?.pendingEffectiveAt
        ? new Date(data.pendingEffectiveAt).toLocaleString()
        : "next renewal";

      setSchedMsg(`Upgrade scheduled ✅ Takes effect ${when}.`);
      await loadStatus();
    } catch (e) {
      setSchedMsg(String(e?.message || e));
    } finally {
      setSchedLoading(false);
    }
  }

  async function syncRoles() {
    try {
      setSyncing(true);
      setSyncMsg("");
      const res = await fetch(SYNC_ENDPOINT, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Sync failed.");
      setSyncMsg(`Roles synced ✅ (tier: ${data.tier})`);
      await loadStatus();
    } catch (e) {
      setSyncMsg(String(e?.message || e));
    } finally {
      setSyncing(false);
    }
  }

  async function openPortal() {
    try {
      setPortalLoading(true);
      setErr("");

      const res = await fetch(PORTAL_ENDPOINT, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "Failed to create portal session.");
      }

      window.location.href = data.url;
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setPortalLoading(false);
    }
  }

  const showPendingBanner = authed && pendingTier && pendingTier !== tier;

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(168,85,247,0.35),transparent),radial-gradient(900px_500px_at_90%_10%,rgba(59,130,246,0.25),transparent)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm text-white/60">WoC Premium</div>
            <h1 className="text-3xl font-semibold text-white">
              Upgrade your control room ✨
            </h1>
            <p className="mt-2 max-w-2xl text-white/70">
              Unlock premium features, sync donor roles in the WoC hub, and manage your subscription anytime.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Back to dashboard
            </Link>
            <button
              onClick={loadStatus}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Status card */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white/5 ring-1 ring-white/10 grid place-items-center">
                <span className="text-lg">🔮</span>
              </div>
              <div>
                <div className="text-white font-medium">
                  {loading ? "Loading status…" : authed ? "Signed in ✅" : "Not signed in"}
                </div>
                <div className="text-sm text-white/60">
                  {loading ? "Checking your premium tier…" : tierPill(tier)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {authed ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                    <span className="text-white/60">Current:</span>{" "}
                    <span className="text-white">{prettyTier(tier)}</span>
                  </div>

                  {/* NEW: Renewal date */}
                  {isPremium && renewalAt ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                      <span className="text-white/60">Renews:</span>{" "}
                      <span className="text-white">{formatDate(renewalAt)}</span>
                      {cancelAtPeriodEnd ? (
                        <span className="ml-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-100">
                          Cancel scheduled
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {discordId ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                      <span className="text-white/60">Discord ID:</span>{" "}
                      <span className="text-white">{discordId}</span>
                    </div>
                  ) : null}

                  <button
                    onClick={syncRoles}
                    disabled={syncing}
                    className="rounded-xl border border-white/10 bg-gradient-to-r from-violet-500/20 to-sky-500/20 px-4 py-2 text-sm text-white hover:from-violet-500/30 hover:to-sky-500/30 disabled:opacity-50"
                  >
                    {syncing ? "Syncing…" : "Sync Discord roles"}
                  </button>

                  <button
                    onClick={openPortal}
                    disabled={!isPremium || portalLoading}
                    title={!isPremium ? "You need an active premium plan to manage it in the portal." : ""}
                    className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-50"
                  >
                    {portalLoading ? "Opening…" : "Manage subscription"}
                  </button>
                </>
              ) : (
                <Link
                  href="/dashboard"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
                >
                  Sign in via dashboard
                </Link>
              )}
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {err}
            </div>
          ) : null}

          {showPendingBanner ? (
            <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm text-white/85">
              <div className="font-medium text-white">Upgrade scheduled ✅</div>
              <div className="mt-1 text-white/75">
                Your plan will switch to{" "}
                <span className="text-white">{prettyTier(pendingTier)}</span>{" "}
                {pendingEffectiveAt ? (
                  <>
                    on <span className="text-white">{formatDateTime(pendingEffectiveAt)}</span>.
                  </>
                ) : (
                  <>at your next renewal.</>
                )}
              </div>
            </div>
          ) : null}

          {syncMsg ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              {syncMsg}
            </div>
          ) : schedMsg ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              {schedMsg}
            </div>
          ) : (
            <div className="mt-4 text-sm text-white/60">
              If you just bought premium, Discord roles can take a moment. Hit{" "}
              <span className="text-white">Sync Discord roles</span> if it doesn’t update quickly.
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const pRank = tierRank(p.tierKey);
            const isCurrent = authed && pRank === rank;
            const isLower = authed && pRank < rank;
            const isUpgrade = authed && pRank > rank;

            // Strategy:
            // - Free users can buy any level (starts new subscription)
            // - Premium users cannot "upgrade instantly" (no mid-cycle switching)
            //   so show "Schedule upgrade next cycle" for higher tiers.
            // - Lower tiers are not actionable.
            const canBuy = authed && rank === 0 && !isCurrent;
            const canSchedule = authed && rank > 0 && isUpgrade;

            const disabled = !authed || isCurrent || isLower;

            const actionLabel = !authed
              ? "Sign in to purchase"
              : isCurrent
              ? "Current plan"
              : isLower
              ? "Lower tier"
              : canBuy
              ? `Buy Level ${p.level}`
              : canSchedule
              ? "Schedule upgrade (next cycle)"
              : "Unavailable";

            const actionHandler = () => {
              if (!authed) return;
              if (canBuy) return goCheckout(p.level);
              if (canSchedule) return scheduleUpgrade(p.level);
            };

            return (
              <div
                key={p.level}
                className={[
                  "relative overflow-hidden rounded-2xl border p-6",
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_60px_rgba(0,0,0,0.35)]",
                  isCurrent
                    ? "border-violet-400/30 bg-violet-500/[0.08]"
                    : isUpgrade
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-white/10 bg-white/[0.02]",
                  isLower ? "opacity-60" : "",
                ].join(" ")}
              >
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/5 blur-2xl" />

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white text-xl font-semibold">
                      {p.title} <span className="text-white/60">·</span>{" "}
                      <span className="text-white/80">{p.subtitle}</span>
                    </div>

                    {/* NEW: price label */}
                    <div className="mt-1 text-sm text-white/60">
                      {p.badge} {planEmoji(pRank)}{" "}
                      <span className="text-white/40">·</span>{" "}
                      <span className="text-white/85 font-medium">{p.priceLabel}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    {isCurrent ? "Current" : isLower ? "Lower" : isUpgrade ? "Upgrade" : "Available"}
                  </div>
                </div>

                <ul className="mt-5 space-y-2 text-sm text-white/70">
                  {p.perks.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-white/50">•</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={actionHandler}
                    disabled={disabled || (!canBuy && !canSchedule && !isCurrent && !isLower) || (schedLoading && canSchedule)}
                    className={[
                      "w-full rounded-xl px-4 py-2 text-sm font-medium transition",
                      !authed || isCurrent || isLower
                        ? "cursor-not-allowed border border-white/10 bg-white/5 text-white/50"
                        : canBuy
                        ? "border border-white/10 bg-white/10 text-white hover:bg-white/15"
                        : canSchedule
                        ? "border border-white/10 bg-gradient-to-r from-violet-500/25 to-sky-500/25 text-white hover:from-violet-500/35 hover:to-sky-500/35"
                        : "cursor-not-allowed border border-white/10 bg-white/5 text-white/50",
                    ].join(" ")}
                  >
                    {schedLoading && canSchedule ? "Scheduling…" : actionLabel}
                  </button>
                </div>

                {authed && canSchedule ? (
                  <div className="mt-3 text-xs text-white/50">
                    This upgrade is scheduled for your next billing cycle (no mid-month charges).
                  </div>
                ) : null}

                {authed && isLower ? (
                  <div className="mt-3 text-xs text-white/50">
                    You already have a higher tier.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/70">
          <div className="text-white/90 font-medium">Manage & cancel</div>
          <div className="mt-2">
            Use <span className="text-white">Manage subscription</span> to update payment method, cancel, or view invoices
            in Stripe’s secure portal.
          </div>
          <div className="mt-2 text-white/60">
            Upgrades are scheduled for renewal to avoid proration surprises.
          </div>
        </div>
      </div>
    </div>
  );
}
