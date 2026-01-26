// app/dashboard/premium/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useWocTheme } from "../../WocThemeProvider";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

/** ---------- Premium model (single source of truth) ---------- **/
const TIER_ORDER = ["free", "supporter", "supporter_plus", "supporter_plus_plus"];

function tierIndex(tier) {
  const i = TIER_ORDER.indexOf(String(tier || "free"));
  return i === -1 ? 0 : i;
}
function hasTier(userTier, requiredTier) {
  return tierIndex(userTier) >= tierIndex(requiredTier);
}

const TIERS = [
  {
    key: "free",
    title: "Wanderer",
    priceLabel: "Free",
    flavor:
      "A traveler between realms. You get the essentials, the core systems, and the first taste of the clans.",
    crest: "🧭",
    accent: "from-slate-700/40 to-slate-900/40",
    perks: [
      { k: "welcome_bg_free", label: "Welcome card backgrounds (Free pack)", tier: "free" },
      { k: "welcome_style_base", label: "Standard card layout + colors", tier: "free" },
      { k: "support_badge", label: "Profile badge", tier: "supporter", locked: true },
      { k: "welcome_bg_premium", label: "Premium background packs", tier: "supporter", locked: true },
      { k: "welcome_uploads", label: "Upload your own background", tier: "supporter_plus", locked: true },
      { k: "animated_overlays", label: "Animated overlays (later)", tier: "supporter_plus_plus", locked: true },
    ],
    highlights: ["Core dashboard features", "Free welcome backgrounds", "Baseline rates"],
  },
  {
    key: "supporter",
    title: "Clan Ally",
    priceLabel: "£4.99 / mo",
    flavor:
      "You’ve pledged to the World of Communities. The clans recognize you with a crest and new cosmetic power.",
    crest: "🏰",
    accent: "from-violet-500/20 to-indigo-500/10",
    perks: [
      { k: "badge_supporter", label: "Supporter badge on dashboard + profile", tier: "supporter" },
      { k: "welcome_bg_pack1", label: "Premium welcome backgrounds: Pack I", tier: "supporter" },
      { k: "welcome_gradients", label: "Premium gradients + accents", tier: "supporter" },
      { k: "xp_boost_30", label: "Chat XP boost: +30%", tier: "supporter" },
      { k: "credits_boost_15", label: "Chat credits boost: +15%", tier: "supporter" },
      { k: "uploads", label: "Upload your own background", tier: "supporter_plus", locked: true },
      { k: "overlays", label: "Animated overlays (later)", tier: "supporter_plus_plus", locked: true },
    ],
    highlights: ["Premium BG Pack I", "Badge unlock", "+30% XP"],
  },
  {
    key: "supporter_plus",
    title: "Relic Holder",
    priceLabel: "£10.99 / mo",
    flavor:
      "You carry artifacts that bend aesthetics and unlock advanced cosmetics across clans. Your server starts to feel… branded.",
    crest: "💎",
    accent: "from-fuchsia-500/20 to-violet-500/10",
    perks: [
      { k: "badge_plus", label: "Supporter+ badge", tier: "supporter_plus" },
      { k: "welcome_bg_pack12", label: "Premium welcome backgrounds: Pack I + II", tier: "supporter_plus" },
      { k: "welcome_uploads", label: "Upload your own welcome background (local)", tier: "supporter_plus" },
      { k: "embed_styles", label: "Premium embed styles (soon)", tier: "supporter_plus" },
      { k: "xp_boost_50", label: "Chat XP boost: +50%", tier: "supporter_plus" },
      { k: "credits_boost_30", label: "Chat credits boost: +30%", tier: "supporter_plus" },
      { k: "daily_boost_50", label: "Daily credits boost: +50%", tier: "supporter_plus" },
    ],
    highlights: ["Uploads enabled", "Premium BG Pack II", "+50% XP"],
  },
  {
    key: "supporter_plus_plus",
    title: "Realm Patron",
    priceLabel: "£39.99 / mo",
    flavor:
      "You don’t just join clans. You fund realms. Your cosmetics are legendary, your access early, your options ridiculous.",
    crest: "👑",
    accent: "from-amber-500/20 to-orange-500/10",
    perks: [
      { k: "badge_plus_plus", label: "Supporter++ badge", tier: "supporter_plus_plus" },
      { k: "welcome_bg_all", label: "All premium welcome background packs", tier: "supporter_plus_plus" },
      { k: "branding", label: "Per-guild branding overrides (soon)", tier: "supporter_plus_plus" },
      { k: "animated_overlays", label: "Animated overlays (later)", tier: "supporter_plus_plus" },
      { k: "xp_boost_100", label: "Chat XP boost: +100%", tier: "supporter_plus_plus" },
      { k: "credits_boost_50", label: "Chat credits boost: +50%", tier: "supporter_plus_plus" },
      { k: "priority_flags", label: "Early access feature flags", tier: "supporter_plus_plus" },
    ],
    highlights: ["All packs", "Early access", "+100% XP"],
  },
];

/** ---------- Data ---------- **/

// You can wire this to Stripe later. For now we treat this as “info only”.
const PREMIUM_STATUS_ENDPOINT = "/api/premium/status";

/** ---------- UI helpers ---------- **/
function Pill({ tone = "default", children }) {
  const tones = {
    default:
      "border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] text-[var(--text-main)]",
    ok: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    warn: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    bad: "border-rose-400/40 bg-rose-500/10 text-rose-100",
  };
  return (
    <span className={cx("text-[0.72rem] px-2 py-1 rounded-full border", tones[tone] || tones.default)}>
      {children}
    </span>
  );
}

function safeErrorMessage(input) {
  const msg = String(input || "").trim();
  if (!msg) return "";
  const looksLikeHtml =
    msg.includes("<!DOCTYPE") || msg.includes("<html") || msg.includes("<body") || msg.includes("<head");
  if (looksLikeHtml) return "Non-JSON/HTML response received (route missing or misrouted).";
  return msg.length > 280 ? msg.slice(0, 280) + "…" : msg;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    const e = new Error(safeErrorMessage(txt || `Non-JSON response (${res.status})`));
    e.status = res.status;
    e.body = txt;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(safeErrorMessage(data?.error || data?.warning || `Request failed (${res.status})`));
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

/** ---------- Page ---------- **/
export default function PremiumPage() {
  let woc = null;
  try {
    woc = useWocTheme();
  } catch {
    woc = null;
  }

  const { data: session, status } = useSession();
  const loading = status === "loading";
  const authed = status === "authenticated";

  const [premium, setPremium] = useState({
    loading: false,
    tier: "free",
    premium: false,
    expiresAt: null,
    warning: "",
  });

  const [tab, setTab] = useState("tiers"); // tiers | perks | faqs
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  function showToast(msg, mood = "playful") {
    setToast(msg);
    if (woc?.setMood) woc.setMood(mood);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Fetch premium status after auth
  useEffect(() => {
    if (!authed) {
      setPremium((p) => ({ ...p, tier: "free", premium: false, expiresAt: null, warning: "" }));
      return;
    }

    let alive = true;
    const ac = new AbortController();

    (async () => {
      try {
        setPremium((p) => ({ ...p, loading: true, warning: "" }));
        const data = await fetchJson(PREMIUM_STATUS_ENDPOINT, {
          cache: "no-store",
          signal: ac.signal,
        });

        // Expected: { ok:true, tier, premium, expiresAt }
        const tier = String(data?.tier || "free");
        const isPrem = !!data?.premium || tier !== "free";
        const expiresAt = data?.expiresAt || null;

        if (!alive) return;
        setPremium({ loading: false, tier, premium: isPrem, expiresAt, warning: safeErrorMessage(data?.warning || "") });
      } catch (e) {
        if (e?.name === "AbortError") return;
        if (!alive) return;
        // If the route isn't ready yet, default to Free but show a soft warning.
        setPremium({
          loading: false,
          tier: "free",
          premium: false,
          expiresAt: null,
          warning: safeErrorMessage(e?.message || "Premium status unavailable (defaulting to Free)."),
        });
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [authed]);

  const currentTierKey = premium?.tier && TIER_ORDER.includes(premium.tier) ? premium.tier : "free";

  const currentTier = useMemo(
    () => TIERS.find((t) => t.key === currentTierKey) || TIERS[0],
    [currentTierKey]
  );

  const perkRows = useMemo(() => {
    // Build a comparison table of unique perks across tiers (by k)
    const all = new Map();
    for (const tier of TIERS) {
      for (const p of tier.perks) all.set(p.k, p.label);
    }
    // Keep order roughly “core -> premium -> advanced”
    const ordered = Array.from(all.entries()).map(([k, label]) => ({ k, label }));
    return ordered;
  }, []);

  const clanLore = useMemo(
    () => [
      { clan: "Mythralight", emoji: "🌸", line: "Cosmetics glow softer. Interfaces feel gentler. Your realm looks… curated." },
      { clan: "Umbrarealm", emoji: "🌙", line: "Shadow themes, deep gradients, and the kind of polish that scares bugs away." },
      { clan: "Aurora", emoji: "🌌", line: "Premium backgrounds with nebula energy. Clean, bright, dramatic." },
      { clan: "Chronoscale", emoji: "⏳", line: "Early access flags. Feature previews. You time-travel into updates." },
    ],
    []
  );

  const mood = woc?.mood || "story";
  const moodWhisper =
    mood === "battle"
      ? "Pick your tier and sharpen your perks."
      : mood === "omen"
      ? "A locked crest. A closed gate. Upgrade if you want it open."
      : mood === "playful"
      ? "Cosmetics are power in disguise."
      : "Premium is the clan’s patronage system. Clean perks, clean gating.";

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="woc-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">WoC Premium</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)] max-w-3xl">
              Patronage for realms. Cosmetics for clans. Early access for the brave. No pay-to-win nonsense,
              just better presentation and optional boosts.
            </p>
            <p className="mt-2 text-[0.78rem] text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-main)]">WOC whisper:</span>{" "}
              {moodWhisper}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="woc-btn-ghost text-xs sm:text-sm">
              Back to Dashboard ↩️
            </Link>
          </div>
        </div>

        {toast ? (
          <div className="mt-5 woc-card p-3 animate-fadeIn">
            <div className="text-sm">{toast}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 text-sm text-[var(--text-muted)]">Loading your crest…</div>
        ) : !authed ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="woc-card p-5">
              <div className="font-semibold">Sign in to view your tier</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">
                Premium is tied to your WoC account, which lives behind your Discord sign-in.
              </div>
              <button
                onClick={() => signIn("discord")}
                className="mt-4 inline-flex w-full justify-center items-center gap-2 woc-btn-ghost"
              >
                Sign in with Discord <span>🔐</span>
              </button>
            </div>

            <div className="woc-card p-5">
              <div className="font-semibold">What Premium does</div>
              <div className="text-xs text-[var(--text-muted)] mt-2">
                It unlocks premium dashboard cosmetics and some optional boosts. First target:{" "}
                <span className="font-semibold text-[var(--text-main)]">Welcome card background packs</span>.
              </div>
              <div className="mt-3 text-[0.72rem] text-[var(--text-muted)]">
                You’ll be able to see premium packs even on Free, but they’ll be locked with a clear tier tag.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Status bar */}
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="woc-card p-5 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">Your crest</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      Linked to:{" "}
                      <span className="font-semibold text-[var(--text-main)]">
                        {session?.user?.name || session?.user?.email || "Discord Account"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {premium.loading ? <Pill>Checking…</Pill> : null}
                    <Pill tone={currentTierKey === "free" ? "default" : "ok"}>
                      {currentTier.crest} {currentTier.title}
                    </Pill>
                    {premium.expiresAt ? (
                      <Pill tone="warn">Expires: {new Date(premium.expiresAt).toLocaleDateString()}</Pill>
                    ) : null}
                  </div>
                </div>

                {premium.warning ? (
                  <div className="mt-4 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    <div className="font-semibold">Premium notice</div>
                    <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">{premium.warning}</div>
                    <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                      If you haven’t built the status route yet, this is normal. The page defaults to Free.
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    ["tiers", "Tiers"],
                    ["perks", "Perks map"],
                    ["faqs", "FAQ"],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setTab(k);
                        woc?.setMood?.(k === "tiers" ? "story" : k === "perks" ? "playful" : "neutral");
                      }}
                      className={cx(
                        "text-xs sm:text-sm px-3 py-2 rounded-full border transition",
                        "border-[var(--border-subtle)]/70",
                        tab === k
                          ? "bg-[color-mix(in_oklab,var(--accent-soft)_55%,transparent)]"
                          : "bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="woc-card p-5">
                <div className="font-semibold">Clan resonance</div>
                <div className="text-xs text-[var(--text-muted)] mt-2">
                  Premium perks are themed as “patronage”. You’re funding features, assets, and the realm’s polish.
                </div>

                <div className="mt-4 space-y-2">
                  {clanLore.map((c) => (
                    <div
                      key={c.clan}
                      className="px-3 py-2 rounded-2xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]"
                    >
                      <div className="text-[0.78rem] font-semibold">
                        {c.emoji} {c.clan}
                      </div>
                      <div className="text-[0.72rem] text-[var(--text-muted)] mt-1">{c.line}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            {tab === "tiers" ? (
              <div className="mt-6">
                <div className="grid gap-4 lg:grid-cols-4">
                  {TIERS.map((tier) => {
                    const isCurrent = tier.key === currentTierKey;
                    const unlocked = hasTier(currentTierKey, tier.key);
                    return (
                      <div
                        key={tier.key}
                        className={cx(
                          "woc-card p-5 border border-[var(--border-subtle)]/70",
                          "transform-gpu transition duration-300 hover:-translate-y-1 hover:shadow-2xl",
                          isCurrent ? "ring-1 ring-[color-mix(in_oklab,var(--accent)_55%,transparent)]" : ""
                        )}
                      >
                        <div
                          className={cx(
                            "rounded-2xl p-4 border border-[var(--border-subtle)]/50",
                            "bg-gradient-to-br",
                            tier.accent
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[0.78rem] text-[var(--text-muted)]">Tier</div>
                              <div className="text-xl font-bold mt-1">
                                {tier.crest} {tier.title}
                              </div>
                              <div className="text-sm mt-1 text-[var(--text-muted)]">{tier.priceLabel}</div>
                            </div>

                            {isCurrent ? (
                              <Pill tone="ok">Current</Pill>
                            ) : unlocked ? (
                              <Pill tone="ok">Unlocked</Pill>
                            ) : (
                              <Pill tone="warn">Locked</Pill>
                            )}
                          </div>

                          <div className="mt-3 text-[0.75rem] text-[var(--text-muted)] leading-relaxed">
                            {tier.flavor}
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          {tier.highlights.map((h) => (
                            <div
                              key={h}
                              className="text-[0.78rem] px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]"
                            >
                              {h}
                            </div>
                          ))}
                        </div>

                        <div className="mt-4">
                          <button
                            type="button"
                            className={cx(
                              "w-full woc-btn-primary",
                              tier.key === "free" ? "opacity-70 cursor-default" : ""
                            )}
                            onClick={() => {
                              if (tier.key === "free") return;
                              showToast("Checkout not wired yet. We’ll hook Stripe later. 🧾", "omen");
                            }}
                            disabled={tier.key === "free"}
                            title={tier.key === "free" ? "Free tier" : "Connect to Stripe later"}
                          >
                            {tier.key === "free"
                              ? "Included"
                              : isCurrent
                              ? "Manage subscription"
                              : "Choose this tier"}
                          </button>

                          <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                            {tier.key === "free"
                              ? "No payment. No friction."
                              : "Button is a placeholder for Stripe checkout."}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 woc-card p-5">
                  <div className="font-semibold">What unlocks first?</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    The first premium gating target is the Welcome Card background packs in your dashboard.
                    Free gets the base pack; Supporter unlocks Pack I; Supporter+ unlocks Pack II + uploads; Supporter++ unlocks all + early flags.
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Pill>🎴 Welcome backgrounds</Pill>
                    <Pill>🎨 Premium gradients</Pill>
                    <Pill tone="warn">✨ Uploads (Supporter+)</Pill>
                    <Pill tone="warn">🌀 Overlays (Supporter++)</Pill>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "perks" ? (
              <div className="mt-6 woc-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">Perks map</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      A readable “who gets what” grid. Built for clan gating logic, not for marketing fluff.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={currentTierKey === "free" ? "default" : "ok"}>
                      Viewing as: {currentTier.crest} {currentTier.title}
                    </Pill>
                  </div>
                </div>

                <div className="mt-4 overflow-auto rounded-2xl border border-[var(--border-subtle)]/70">
                  <table className="min-w-[760px] w-full text-left text-sm">
                    <thead className="bg-[color-mix(in_oklab,var(--bg-card)_80%,transparent)]">
                      <tr className="border-b border-[var(--border-subtle)]/60">
                        <th className="px-4 py-3 text-xs text-[var(--text-muted)]">Perk</th>
                        {TIERS.map((t) => (
                          <th key={t.key} className="px-4 py-3 text-xs text-[var(--text-muted)]">
                            {t.crest} {t.title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {perkRows.map((row) => (
                        <tr key={row.k} className="border-b border-[var(--border-subtle)]/40">
                          <td className="px-4 py-3 text-[0.85rem]">{row.label}</td>
                          {TIERS.map((t) => {
                            // Find which tier requires it by scanning TIERS perks arrays
                            let required = "free";
                            for (const tier of TIERS) {
                              const found = tier.perks.find((p) => p.k === row.k);
                              if (found?.tier) required = found.tier;
                            }
                            const ok = hasTier(t.key, required);
                            const youHaveIt = hasTier(currentTierKey, required);
                            return (
                              <td key={t.key} className="px-4 py-3">
                                <span
                                  className={cx(
                                    "inline-flex items-center gap-2 text-[0.78rem] px-2 py-1 rounded-full border",
                                    ok
                                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                                      : "border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_60%,transparent)] text-[var(--text-muted)]"
                                  )}
                                  title={ok ? "Included" : `Requires ${required}`}
                                >
                                  {ok ? "✓" : "—"}
                                  {t.key === currentTierKey ? (
                                    <span className={cx(youHaveIt ? "" : "")}>You</span>
                                  ) : null}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-[0.72rem] text-[var(--text-muted)]">
                  Note: This page is purely display + gating guidance. Actual enforcement must happen in your API routes
                  (saving settings, serving premium assets, uploads).
                </div>
              </div>
            ) : null}

            {tab === "faqs" ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <div className="woc-card p-5 lg:col-span-2">
                  <div className="font-semibold">FAQ</div>

                  <div className="mt-4 space-y-3">
                    {[
                      {
                        q: "Is this pay-to-win?",
                        a: "No. Premium is cosmetics + optional rate boosts. Core gameplay stays intact. The main dashboard unlock is better visuals and extra customization.",
                      },
                      {
                        q: "What’s the first premium feature you’re shipping?",
                        a: "Welcome Card background packs inside the dashboard (curated, stable). No hotlinking. No random broken URLs.",
                      },
                      {
                        q: "How does the dashboard know my tier?",
                        a: "One entitlement check after sign-in (via /api/premium/status). The UI gates options, and the API enforces them on save.",
                      },
                      {
                        q: "Will premium apply per-user or per-server?",
                        a: "Start with per-user (Dyno-style). Later you can add server licenses (e.g. “this guild is premium”) if you want team billing.",
                      },
                      {
                        q: "Can I cancel anytime?",
                        a: "Once Stripe is wired, yes. For now the checkout buttons are placeholders.",
                      },
                    ].map((item) => (
                      <div
                        key={item.q}
                        className="rounded-2xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] p-4"
                      >
                        <div className="font-semibold text-sm">{item.q}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-2">{item.a}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="woc-card p-5">
                  <div className="font-semibold">Next steps checklist</div>
                  <div className="text-xs text-[var(--text-muted)] mt-2">
                    If you want this page to actually reflect reality:
                  </div>

                  <ul className="mt-4 space-y-2 text-[0.78rem] text-[var(--text-muted)]">
                    <li>• Add <code className="bg-black/20 px-1 py-0.5 rounded">/api/premium/status</code></li>
                    <li>• Store tier in Mongo per user</li>
                    <li>• Gate welcome background packs in the Welcome editor</li>
                    <li>• Enforce tier in your settings save route</li>
                    <li>• Wire Stripe checkout later without refactoring</li>
                  </ul>

                  <button
                    className="mt-4 woc-btn-ghost text-xs w-full"
                    type="button"
                    onClick={() => showToast("We’re building realms one gate at a time. 🗝️", "story")}
                  >
                    Inspire me
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
