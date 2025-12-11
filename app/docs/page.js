import PageHeader from '../components/PageHeader';

const STEPS = [
  {
    id: 'getting-started',
    title: '1. Getting started in a new server',
    summary:
      'A quick path for server owners to get WoC online, visible and safe.',
    bullets: [
      'Invite WoC using the button at the top of this site and pick your server.',
      'Create a visible channel like #woc-lobby or #adventure to keep bot messages together.',
      'Run /tutorial in Discord – the bot walks players through the basics in-chat.',
      'Optionally lock dangerous commands (like admin tools) behind roles.',
    ],
    callout:
      'If you only do one thing: pin /tutorial and /clantutorial in your start channel.',
  },
  {
    id: 'clans',
    title: '2. Clans, quests & exams',
    summary:
      'The core “RPG spine” of WoC. Clans give identity, exams give long-term goals.',
    bullets: [
      'Players browse clans with /clanlist and /claninfo to find a fantasy that fits.',
      'They join with /joinclan and start appearing on clan leaderboards.',
      'Winning /duel fights feeds clan quest progress (tier I → II → III).',
      'Finishing the required tier and duel counts unlocks the clan exam.',
      'The /exam command runs a multi-round fight. Passing grants titles, coins and prestige.',
    ],
    callout:
      'Every server can spin its own lore off these clans. Think of them as “factions”, not rigid classes.',
  },
  {
    id: 'duels',
    title: '3. Duels, stats & prestige',
    summary:
      'Fast cross-clan PvP that secretly levels players and prepares them for exams.',
    bullets: [
      'Use /duel @user to start a fight. Only cross-clan duels are allowed.',
      'Each result updates power, coins, XP and clan bank contributions.',
      'Clans can race to hit certain bank totals for custom events or rewards.',
      'Players track their performance via /duelstats and /profile.',
      'Long-term grinders unlock exam prestige buffs that boost win rates and rewards.',
    ],
    callout:
      'Want a weekly event? Host “Exam Eve” nights where people chain duels to get exam-ready.',
  },
  {
    id: 'economy',
    title: '4. Economy, items & crates',
    summary:
      'Two layers of currency (global + server) plus loot that nudges people back into combat.',
    bullets: [
      'Global coins are earned from big milestones and live across all servers.',
      'Server coins (Community Coins) are earned from work-style commands and duels.',
      'Players spend coins in /shop on weapons, artifacts, fruits and cosmetics.',
      'Command Crates randomly drop when people use commands; open them with /crates open.',
      'Owners can theme their economy: “low magic”, “fruit meta”, “artifact apocalypse” etc.',
    ],
    callout:
      'If your server feels quiet, run a weekend event where all duels give +20% coins.',
  },
  {
    id: 'marriage',
    title: '5. Marriage, families & drama',
    summary:
      'Optional, but incredibly sticky. Marriages and family trees turn servers into soap operas.',
    bullets: [
      'Anyone can propose with /marry @user – the other person must accept.',
      'Marriages are global, so couples remain linked even across multiple servers.',
      'Use /partner and /tree to see relationships and family branches.',
      'Server events can reward the “largest family”, “oldest couple” or “most chaotic tree”.',
    ],
    callout:
      'This system is deliberately playful: lean into the memes, but keep clear server rules.',
  },
  {
    id: 'housing',
    title: '6. Housing & realms (early access)',
    summary:
      'Decor-driven player housing that grants small buffs in duels and exams.',
    bullets: [
      'Players unlock décor items through shops, crates and special events.',
      'Using /house and /house place, they build out a personal realm.',
      'The more curated and complete their home, the nicer their passive buffs.',
      'Future updates will let servers create neighbourhoods and clan HQs.',
    ],
    callout:
      'Think of housing as a long-term, low-pressure project: something to tinker with between fights.',
  },
  {
    id: 'owners',
    title: '7. Server owner quick tips',
    summary:
      'A few knobs you can turn to make WoC feel custom to *your* community.',
    bullets: [
      'Pick 1–2 “spotlight” systems first (e.g. Clans + Marriage) instead of dropping everything at once.',
      'Create a #woc-announcements channel for patch notes, clan wars and event teasers.',
      'Encourage people to share their exam passes and family trees – social proof matters.',
      'Rotate themes each month: “Exam Season”, “Clan War Arc”, “Housing Week” etc.',
    ],
    callout:
      'You don’t need to micro-manage the bot. Think in story arcs, not config panels.',
  },
];

export default function DocsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-8 py-16 lg:py-20">
      <PageHeader
        eyebrow="Tutorial hub"
        title="How WoC actually works"
        kicker="This is the human-readable version of the bot: what each system is for, how they connect, and how to teach them to your players."
        badges={['Server owners', 'New players', 'Onboarding']}
      >
        <p>
          You can skim this page like documentation, or treat it as a **story
          bible** for your server. Every section below matches one of the
          systems highlighted on the homepage and in the Discord tutorial.
        </p>
      </PageHeader>

      <div className="space-y-8">
        {STEPS.map((step) => (
          <section
            key={step.id}
            id={step.id}
            className="woc-card p-5 sm:p-6 hover:-translate-y-[2px] transition-transform"
          >
            <h2 className="text-lg font-semibold mb-1">{step.title}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              {step.summary}
            </p>

            <ul className="space-y-2 text-sm text-[var(--text-main)]">
              {step.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 text-xs sm:text-sm text-[var(--text-muted)] border-t border-[var(--border-subtle)]/60 pt-3">
              <span className="font-semibold text-emerald-400">Pro tip:</span>{' '}
              {step.callout}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
