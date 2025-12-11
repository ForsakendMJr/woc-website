import PageHeader from '../components/PageHeader';

const COMMAND_SECTIONS = [
  {
    category: 'Clans & Exams',
    summary:
      'Pick a clan, work through quests, then take brutal multi-round exams for titles and prestige.',
    tags: ['Clan quests', 'Exams', 'Power scaling'],
    commands: [
      {
        name: '/clanlist',
        desc: 'Browse every clan and their fantasy blurbs.',
        tip: 'Use this first to figure out what vibe your server likes.',
      },
      {
        name: '/claninfo',
        desc: 'Deep dive into a specific clan: powers, quests, exam.',
        tip: 'Great link to share when recruiting new members.',
      },
      {
        name: '/joinclan',
        desc: 'Pledge yourself to a clan.',
        tip: 'Owners can restrict some clans with server rules or roles.',
      },
      {
        name: '/examstatus',
        desc: 'Shows how close you are to your clan exam.',
        tip: 'Players should check this after every duel burst.',
      },
      {
        name: '/exam',
        desc: 'Run the multi-round clan exam once you’re ready.',
        tip: 'On success, grants server titles and pushes global prestige.',
      },
    ],
  },
  {
    category: 'Duels & Combat',
    summary:
      'Cross-clan duels that feed clan banks, quest tiers and exam unlocks.',
    tags: ['Duels', 'Clan banks', 'Quest hooks'],
    commands: [
      {
        name: '/duel',
        desc: 'Challenge another player from a different clan.',
        tip: 'Wins increase power, coins and quest progress.',
      },
      {
        name: '/duelstats',
        desc: 'See your winrate, clan progress and housing buffs.',
        tip: 'Perfect “showoff” link for sweaty duelists.',
      },
      {
        name: '/profile',
        desc: 'View your WoC profile for this server.',
        tip: 'Owners can pin this in a #start-here channel.',
      },
      {
        name: '/prestige',
        desc: 'Shows exam prestige tiers, buffs and progress.',
        tip: 'Long-term ladder for people who grind 50+ exams.',
      },
    ],
  },
  {
    category: 'Economy & Items',
    summary:
      'Dual currencies, weapons, artifacts, fruits and future alchemy hooks.',
    tags: ['WoC Coins', 'Items', 'Crates'],
    commands: [
      {
        name: '/balance',
        desc: 'View your global and server coins.',
        tip: 'Great sanity check before a shopping spree.',
      },
      {
        name: '/work',
        desc: 'Low-stress way to earn coins over time.',
        tip: 'Combine with daily quests for steady progression.',
      },
      {
        name: '/shop',
        desc: 'Browse server-available items and cosmetics.',
        tip: 'Server owners can rotate items to create “seasons”.',
      },
      {
        name: '/crates open',
        desc: 'Open Command / Event crates for loot.',
        tip: 'Command crates drop randomly when using the bot.',
      },
    ],
  },
  {
    category: 'Marriage & Family',
    summary:
      'Full social web: marriages, family trees and generational storylines.',
    tags: ['Global marriage', 'Family trees', 'Drama'],
    commands: [
      {
        name: '/marry',
        desc: 'Send a proposal to another player.',
        tip: 'Global – the relationship follows you between servers.',
      },
      {
        name: '/partner',
        desc: 'Show info about your current partner.',
        tip: 'Includes basic stats & marriage date.',
      },
      {
        name: '/tree',
        desc: 'Visualise your family tree.',
        tip: 'Owners can host “Family Wars” events off of this.',
      },
    ],
  },
  {
    category: 'Housing & Realms (Early)',
    summary:
      'Experimental system for player housing and small passive combat buffs.',
    tags: ['Housing', 'Decor', 'Buffs'],
    commands: [
      {
        name: '/house',
        desc: 'Claim or visit your personal space.',
        tip: 'Long-term hub for decor, trophies and prestige.',
      },
      {
        name: '/house place',
        desc: 'Place decorations earned from items / shop.',
        tip: 'Different decor themes can unlock different buff mixes.',
      },
    ],
  },
];

export default function CommandsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-16 lg:py-20">
      <PageHeader
        eyebrow="Command reference"
        title="Commands"
        kicker="Everything your players can type, grouped by system. Think of this page as the “cheat sheet” you drop in your server’s #info channel."
        badges={['Slash commands', 'Tutorial-ready']}
      >
        <p>
          Commands are discoverable via Discord’s slash UI, but this page gives
          you the **story** around each system: why it exists, when to use it,
          and how it connects to the rest of World of Communities.
        </p>
      </PageHeader>

      <div className="space-y-8">
        {COMMAND_SECTIONS.map((section) => (
          <section
            key={section.category}
            className="woc-card p-5 sm:p-6 hover:-translate-y-[2px] transition-transform"
          >
            <div className="flex flex-wrap items-start gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  {section.category}
                </h2>
                <p className="text-sm text-[var(--text-muted)] max-w-xl">
                  {section.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs ml-auto">
                {section.tags.map((t) => (
                  <span key={t} className="woc-tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {section.commands.map((cmd) => (
                <div
                  key={cmd.name}
                  className="rounded-xl border border-[var(--border-subtle)]/60 bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)] p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-[0.8rem] font-semibold px-2 py-1 rounded-full bg-black/20">
                      {cmd.name}
                    </code>
                  </div>
                  <p className="text-xs text-[var(--text-main)]">
                    {cmd.desc}
                  </p>
                  <p className="text-[0.75rem] text-[var(--text-muted)]">
                    <span className="font-medium text-emerald-400">Tip:</span>{' '}
                    {cmd.tip}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
