// app/page.js
import WocIntroModal from './components/WocIntroModal';
import WocTalks from './components/WocTalks';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-16 lg:py-20">
      {/* Intro popup */}
      <WocIntroModal />

      {/* Hero row */}
      <section className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)] gap-10 items-start">
        {/* ---------------- LEFT SIDE ---------------- */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 woc-pill text-xs mb-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400 woc-pulse-dot" />
            <span className="font-medium tracking-wide">
              Online • Discord RPG bot
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
            Forge your{' '}
            <span className="woc-hero-gradient bg-clip-text text-transparent">
              World
            </span>
            <br />
            of Communities.
          </h1>

          <p className="text-[var(--text-muted)] max-w-xl text-sm sm:text-base">
            A cinematic Discord bot built for long-form progression: clans,
            duels, family trees, exams, housing and an ever-evolving world
            story. Your server becomes its own saga.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button className="woc-btn-primary flex items-center gap-2 text-sm shadow-lg hover:-translate-y-[1px] transition">
              <span>Invite the bot</span>
              <span className="text-lg">✨</span>
            </button>

            <button className="woc-btn-ghost text-sm">
              View commands
            </button>

            <button className="woc-btn-ghost text-sm hidden sm:inline-flex">
              Quickstart for owners
            </button>
          </div>

          {/* Tags row */}
          <div className="flex flex-wrap gap-4 pt-6 text-xs text-[var(--text-muted)]">
            <div>
              <div className="font-semibold mb-1 tracking-wide text-[0.7rem] uppercase">
                Systems online
              </div>
              <div className="flex flex-wrap gap-2">
                {['Clans', 'Duels', 'Exams', 'Marriage', 'Economy'].map(t => (
                  <span key={t} className="woc-tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="font-semibold mb-1 tracking-wide text-[0.7rem] uppercase">
                Built for
              </div>
              <p className="max-w-xs text-[0.78rem] text-[var(--text-muted)]">
                RPG servers, anime hubs &amp; friend groups that never log off.
              </p>
            </div>
          </div>
        </div>

        {/* ---------------- RIGHT: LIVE PREVIEW CARD ---------------- */}
        <div
          className="woc-card woc-hero-card p-4 sm:p-5 border border-[var(--border-subtle)]/50 
                     transform-gpu transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]" />
              <span className="font-medium tracking-wide">Live preview</span>
            </div>

            <div className="flex gap-1 text-[0.7rem] text-[var(--text-muted)]">
              {['/duel', '/marry', '/exam', '/tutorial'].map(cmd => (
                <span
                  key={cmd}
                  className="px-2 py-1 rounded-full bg-[color-mix(in_oklab,var(--pill-bg)_70%,transparent)]"
                >
                  {cmd}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3 text-xs sm:text-[0.78rem]">
            {/* Avatar + line */}
            <div className="flex items-center gap-2">
              <div
                className="
                  relative h-7 w-7 rounded-full overflow-hidden
                  shadow-md border border-[var(--border-subtle)]
                  bg-[var(--bg-card)]
                "
              >
                <Image
                  src="/woc-avatar.png"
                  alt="WoC avatar"
                  fill
                  sizes="28px"
                  className="
                    object-cover
                    scale-[1.8]
                    object-[18%_38%]   /* same face framing vibes as navbar */
                    pointer-events-none
                  "
                />
              </div>

              <div className="text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text-main)]">
                  @Mythralight
                </span>{' '}
                defeats <span className="font-semibold">@Umbrarealm</span> in a
                cross-clan duel. Power, coins and exam progress updated.
              </div>
            </div>

            <ul className="space-y-2 border-l border-[var(--border-subtle)]/40 pl-3 ml-2">
              <li className="text-[var(--text-muted)]">
                <span className="text-emerald-400 mr-1">•</span>
                <span>
                  <code className="text-[0.74rem] bg-black/20 px-1 py-0.5 rounded">
                    /exam
                  </code>{' '}
                  simulates a multi-round boss check to see if you’re worthy of
                  your clan title.
                </span>
              </li>

              <li className="text-[var(--text-muted)]">
                <span className="text-emerald-400 mr-1">•</span>
                <span>
                  <code className="text-[0.74rem] bg-black/20 px-1 py-0.5 rounded">
                    /tutorial
                  </code>{' '}
                  walks new players through clans, economy, marriage and more
                  with interactive steps.
                </span>
              </li>
            </ul>

            <p className="text-[0.74rem] text-[var(--text-muted)] pt-1 italic">
              “WoC turns our Discord into a full-on anime MMO. People argue
              over exams, propose in chat, and min-max fruits at 3am.”
            </p>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mt-16 space-y-6">
        <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-[var(--text-muted)]">
          What the bot actually does
        </h2>

        <div className="grid lg:grid-cols-2 gap-6">
          <article className="woc-card p-5 sm:p-6 hover:-translate-y-1 hover:shadow-2xl transition transform-gpu">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">
              Living Clan System
            </h3>
            <p className="text-[var(--text-muted)] mb-4 text-[0.85rem]">
              Nine lore-heavy clans with exams, duels, and cross-server
              prestige. Every fight nudges the story.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {['Clan exams', 'Power scaling', 'Cross-clan duels'].map(t => (
                <span key={t} className="woc-tag">
                  {t}
                </span>
              ))}
            </div>
          </article>

          <article className="woc-card p-5 sm:p-6 hover:-translate-y-1 hover:shadow-2xl transition transform-gpu">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">
              Economy, Crafting & Items
            </h3>
            <p className="text-[var(--text-muted)] mb-4 text-[0.85rem]">
              WoC Coins, community coins, weapons, artifacts and fruits—plus
              advanced crafting and future alchemy hooks.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {['Dual currency', 'Item rarity', 'Future dashboard'].map(t => (
                <span key={t} className="woc-tag">
                  {t}
                </span>
              ))}
            </div>
          </article>

          <article className="woc-card p-5 sm:p-6 hover:-translate-y-1 hover:shadow-2xl transition transform-gpu">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">
              Marriage, Family & Social Webs
            </h3>
            <p className="text-[var(--text-muted)] mb-4 text-[0.85rem]">
              Adopt players, build bloodlines, generate family trees and
              gossip-fuelled drama that never ends.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {['Global marriage', 'Family trees', 'Social stats'].map(t => (
                <span key={t} className="woc-tag">
                  {t}
                </span>
              ))}
            </div>
          </article>

          <article className="woc-card p-5 sm:p-6 hover:-translate-y-1 hover:shadow-2xl transition transform-gpu">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">
              Housing & Realms
            </h3>
            <p className="text-[var(--text-muted)] mb-4 text-[0.85rem]">
              Player housing, future clan HQs and visual prestige tied directly
              into combat buffs and duels.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {['Realm buffs', 'Decor items', 'Clan HQs (soon)'].map(t => (
                <span key={t} className="woc-tag">
                  {t}
                </span>
              ))}
            </div>
          </article>
        </div>
      </section>

      {/* Personality corner */}
      <WocTalks />
    </div>
  );
}
