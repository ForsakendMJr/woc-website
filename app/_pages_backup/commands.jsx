// /pages/commands.jsx
import React from "react";
import Head from "next/head";

const COMMAND_SECTIONS = [
  {
    category: "Clan System",
    emoji: "🏰",
    tag: "/clanlist /claninfo /joinclan",
    description:
      "Pick a clan, learn its skills & quests, and pledge yourself to its ethos.",
    commands: [
      { name: "/clanlist", description: "List all clans available on the bot." },
      { name: "/claninfo", description: "View lore, skills, quests & exam info for a clan." },
      { name: "/joinclan", description: "Join a clan on this server." },
      { name: "/leaveclan", description: "Leave your current clan." },
      { name: "/clanmembers", description: "View members of a specific clan on this server." },
      { name: "/profile", description: "View your per-server WoC profile." }
    ]
  },
  {
    category: "Combat & Duels",
    emoji: "⚔️",
    tag: "/duel /duelstats",
    description:
      "Cross-clan duels, power scaling, quest progress and exam prep.",
    commands: [
      { name: "/duel", description: "Challenge a user from another clan to a duel." },
      { name: "/duelstats", description: "View duel record, power, equipment and quest progress." },
      { name: "/exam", description: "Attempt your clan’s combat exam if ready." },
      { name: "/examstats", description: "View your exam history & fastest clear times." },
      { name: "/examleaderboard", description: "See top exam clear counts for this server." },
      { name: "/examclanrank", description: "Which clan dominates exams on this server?" },
      { name: "/prestige", description: "View exam prestige stages and unlocked buffs." }
    ]
  },
  {
    category: "Economy & Items",
    emoji: "💰",
    tag: "/work /daily /shop /inventory",
    description:
      "WoC Coins, community coins, crafting and equipment that affects your power.",
    commands: [
      { name: "/balance", description: "Check your WoC Coins and Community Coins." },
      { name: "/work", description: "Earn Community Coins and XP over time." },
      { name: "/daily", description: "Claim your daily WoC Coin reward." },
      { name: "/shop", description: "View items available for purchase." },
      { name: "/buy", description: "Buy an item from the shop by ID." },
      { name: "/inventory", description: "View the items you own." },
      { name: "/equipitem", description: "Equip a weapon/armor/accessory/boots." },
      { name: "/craft", description: "Craft items from materials (advanced)." }
    ]
  },
  {
    category: "Marriage & Family",
    emoji: "💞",
    tag: "/marry /tree",
    description:
      "Global marriages, family trees, and long-term relationship chaos.",
    commands: [
      { name: "/marry", description: "Propose to another user globally." },
      { name: "/divorce", description: "End your marriage (ouch)." },
      { name: "/adopt", description: "Adopt a child into your family tree." },
      { name: "/disown", description: "Remove a child from your tree." },
      { name: "/tree", description: "View your full family structure." },
      { name: "/partner", description: "See your current partner." },
      { name: "/parent", description: "See your parents in the tree." }
    ]
  },
  {
    category: "Housing & Realms",
    emoji: "🏡",
    tag: "/house",
    description:
      "Your personal realm, decorations, aura & comfort buffs that affect combat.",
    commands: [
      { name: "/house", description: "View your current realm and stats." },
      { name: "/house decor", description: "Place or remove decorations in your house." },
      { name: "/house inspect", description: "Visit another player’s house." },
      { name: "/house prestige", description: "View housing prestige cosmetics & buffs." }
    ]
  },
  {
    category: "Quests & Achievements",
    emoji: "📜",
    tag: "/achievements",
    description:
      "Daily quests, long-form storylines and permanent achievement badges.",
    commands: [
      { name: "/quest", description: "Manage quests (accept, track, complete)." },
      { name: "/achievements", description: "View your achievements & progress." }
    ]
  },
  {
    category: "Fun & Utility",
    emoji: "🎭",
    tag: "/tutorial /wochelp",
    description:
      "Onboarding, guidance, GIF commands and utility features.",
    commands: [
      { name: "/tutorial", description: "Interactive multi-tab tutorial for the bot." },
      { name: "/wochelp", description: "Dropdown help for all command categories." },
      { name: "/intro", description: "Trigger WOC’s VTuber-style intro in chat." }
    ]
  }
];

export default function CommandsPage() {
  return (
    <>
      <Head>
        <title>Commands • World of Communities</title>
      </Head>

      <main className="woc-shell min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-10 lg:py-14">
          <header className="mb-8">
            <p className="woc-tag mb-3">/commands</p>
            <h1 className="text-3xl lg:text-4xl font-semibold mb-2">
              Every command your{" "}
              <span className="woc-hero-gradient bg-clip-text text-transparent">
                world
              </span>{" "}
              needs
            </h1>
            <p className="text-[var(--text-muted)] max-w-2xl text-sm">
              WOC is built for long-term progression. Mix clans, duels, exams,
              housing, marriages and more to turn your Discord server into a
              tiny MMO.
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            {COMMAND_SECTIONS.map(section => (
              <section key={section.category} className="woc-card p-5 lg:p-6 space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <span className="text-xl">{section.emoji}</span>
                      {section.category}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {section.description}
                    </p>
                  </div>
                  <span className="hidden md:inline-block text-[10px] uppercase tracking-wide bg-[var(--accent-soft)] px-2 py-1 rounded-full">
                    {section.tag}
                  </span>
                </div>

                <ul className="space-y-2 text-sm">
                  {section.commands.map(cmd => (
                    <li key={cmd.name} className="flex gap-2">
                      <code className="px-2 py-0.5 rounded bg-[rgba(15,23,42,0.6)] text-[var(--accent)] text-xs">
                        {cmd.name}
                      </code>
                      <span className="text-[var(--text-muted)]">{cmd.description}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
