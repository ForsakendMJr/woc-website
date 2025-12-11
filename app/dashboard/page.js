import PageHeader from '../components/PageHeader';

const PANELS = [
  {
    title: 'Live server stats',
    lines: [
      'Online clans, active players, duel heatmaps and exam clears.',
      'Quickly see which systems are thriving and which need events.',
    ],
  },
  {
    title: 'Season tools',
    lines: [
      'Rotate featured clans, tweak rewards, and schedule WoC-wide events.',
      'Think “battle pass tuning”, but for your Discord arc.',
    ],
  },
  {
    title: 'Economy inspector',
    lines: [
      'Track inflation, crate drops and item rarity distribution.',
      'Helps you keep your server’s meta spicy, not broken.',
    ],
  },
];

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-8 py-16 lg:py-20">
      <PageHeader
        eyebrow="Owner tools • Coming soon"
        title="Dashboard"
        kicker="A web dashboard for owners to see what their server’s story looks like at a glance – and gently steer it."
        badges={['Coming soon', 'Season tools']}
      >
        <p>
          The dashboard isn’t live yet, but the plan is simple: give you just
          enough control to shape arcs and events without drowning you in
          toggles. Until then, everything still works 100% inside Discord.
        </p>
      </PageHeader>

      <div className="grid md:grid-cols-3 gap-4">
        {PANELS.map((panel) => (
          <article
            key={panel.title}
            className="woc-card p-4 text-sm text-[var(--text-muted)]"
          >
            <h2 className="font-semibold text-[var(--text-main)] mb-2">
              {panel.title}
            </h2>
            <ul className="space-y-1">
              {panel.lines.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-8 woc-card p-4 text-xs sm:text-sm text-[var(--text-muted)]">
        Want to influence dashboard features? Host WoC in your server and share
        feedback in our support server once that goes live – early adopters will
        basically help design the control room.
      </div>
    </div>
  );
}
