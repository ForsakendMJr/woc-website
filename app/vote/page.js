// app/vote/page.js

import Link from "next/link";

const VOTE_SITES = [
  {
    id: "topgg",
    name: "top.gg",
    description: "The main hub for Discord bots. Vote every 12 hours.",
    url: "https://top.gg/bot/YOUR_BOT_ID/vote",
    reward: "+250 WoC Coins per vote",
  },
  {
    id: "dbl",
    name: "Discord Bot List",
    description: "Another big directory. Stack it with top.gg for double rewards.",
    url: "https://discordbotlist.com/bots/YOUR_BOT_SLUG/upvote",
    reward: "+250 WoC Coins per vote",
  },
];

export default function VotePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-8 py-16 lg:py-20 space-y-12">
      {/* Header */}
      <section className="space-y-3">
        <p className="woc-pill text-xs inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Support the bot • Earn rewards</span>
        </p>

        <h1 className="text-3xl sm:text-4xl font-bold">
          Vote for <span className="woc-hero-gradient bg-clip-text text-transparent">WoC</span>
        </h1>

        <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-2xl">
          Voting keeps <strong>Web of Communities</strong> trending on bot
          lists and unlocks bonus rewards for you. Hit the vote buttons below,
          then let the dashboard sync your <em>exam passes, duel wins, and coins</em>
          with your Discord account.
        </p>
      </section>

      {/* Vote cards */}
      <section className="grid md:grid-cols-2 gap-6">
        {VOTE_SITES.map((site) => (
          <article
            key={site.id}
            className="woc-card p-5 space-y-3 hover:-translate-y-1 hover:shadow-2xl transition transform-gpu"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-base">{site.name}</h2>
                <p className="text-xs text-[var(--text-muted)]">{site.description}</p>
              </div>
              <span className="text-[0.7rem] px-2 py-1 rounded-full bg-[color-mix(in_oklab,var(--pill-bg)_75%,transparent)] text-[var(--text-muted)]">
                {site.reward}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
              <p className="flex-1">
                Click <strong>Vote on {site.name}</strong>, confirm the captcha,
                and our webhook will credit your account within a few seconds.
              </p>

              <a
                href={site.url}
                target="_blank"
                rel="noreferrer"
                className="woc-btn-primary whitespace-nowrap text-xs sm:text-sm"
              >
                Vote on {site.name}
              </a>
            </div>
          </article>
        ))}
      </section>

      {/* Dashboard & account section (future-auth-aware) */}
      <section className="woc-card p-5 sm:p-6 space-y-4">
        <h2 className="text-sm sm:text-base font-semibold flex items-center gap-2">
          Track your rewards
          <span className="text-[0.65rem] uppercase tracking-[0.16em] px-2 py-0.5 rounded-full bg-[color-mix(in_oklab,var(--pill-bg)_80%,transparent)] text-[var(--text-muted)]">
            Dashboard alpha
          </span>
        </h2>

        <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-xl">
          Soon you’ll be able to <strong>sign in with Discord</strong>, see your
          vote history, streaks, and total WoC Coins earned from voting. This
          panel will show:
        </p>

        <ul className="text-xs sm:text-sm text-[var(--text-muted)] list-disc list-inside space-y-1">
          <li>Last vote time per site</li>
          <li>Daily / 12-hour vote streak and streak bonuses</li>
          <li>Total coins earned from votes</li>
          <li>Direct link to open the dashboard in one click</li>
        </ul>

        {/* Placeholder “Sign in” CTA – replace with real auth later */}
        <div className="pt-3 flex flex-wrap gap-3 items-center">
          <button
            type="button"
            className="woc-btn-primary text-xs sm:text-sm"
          >
            Sign in with Discord (coming soon)
          </button>
          <p className="text-[0.7rem] text-[var(--text-muted)]">
            We’ll never store your password. Authentication runs via the official
            Discord OAuth flow.
          </p>
        </div>
      </section>

      {/* FAQ-ish footer */}
      <section className="text-xs sm:text-sm text-[var(--text-muted)] space-y-2">
        <h3 className="font-semibold text-[var(--text-main)]">How do rewards work?</h3>
        <p>
          Every valid vote triggers a webhook from the vote site to WoC’s backend.
          The vote is tied to your Discord ID, recorded in the database, and
          your in-bot balance is updated. If your Discord is linked to this
          website account, your dashboard will mirror the same numbers.
        </p>
      </section>
    </div>
  );
}
