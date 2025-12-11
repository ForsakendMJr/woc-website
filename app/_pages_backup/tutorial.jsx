import React, { useState } from "react";
import Head from "next/head";
import WocTalks from "../components/WocTalks";

const TABS = [
  "Clans",
  "Combat & Duels",
  "Exams & Prestige",
  "Economy & Items",
  "Marriage & Family",
  "Housing & Realms",
  "Achievements"
];

export default function TutorialPage() {
  const [tab, setTab] = useState("Clans");

  return (
    <>
      <Head>
        <title>WoC Tutorial • World of Communities</title>
      </Head>

      <main className="woc-shell min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-10 lg:py-14 flex flex-col lg:flex-row gap-10">
          
          {/* LEFT SIDE */}
          <section className="flex-1">
            <header className="mb-8">
              <p className="woc-tag mb-3">/tutorial</p>

              <h1 className="text-3xl lg:text-4xl font-semibold mb-2">
                Learn the{" "}
                <span className="woc-hero-gradient bg-clip-text text-transparent">
                  World of Communities
                </span>
              </h1>

              <p className="text-[var(--text-muted)] max-w-2xl">
                WOC here. I’ll walk you through clans, duels, exams, economy, marriage,
                housing and all the chaos in between.
              </p>
            </header>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {TABS.map((label) => (
                <button
                  key={label}
                  onClick={() => setTab(label)}
                  className={
                    tab === label
                      ? "px-3 py-1.5 rounded-full bg-[var(--accent)] text-white shadow-lg text-sm"
                      : "px-3 py-1.5 rounded-full bg-[rgba(15,23,42,0.7)] text-[var(--text-muted)] border border-[var(--border-subtle)] text-sm"
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <TutorialPanel tab={tab} />
          </section>

          {/* RIGHT SIDE */}
          <aside className="w-full lg:w-[320px]">
            <WocTalks context={tab} />
          </aside>
        </div>
      </main>
    </>
  );
}

/* -------------------------------------------------------------- */
/* Panels (converted to JSX only) */
/* -------------------------------------------------------------- */

function TutorialPanel({ tab }) {
  switch (tab) {
    case "Clans":
      return <ClansPanel />;
    case "Combat & Duels":
      return <CombatPanel />;
    case "Exams & Prestige":
      return <ExamPanel />;
    case "Economy & Items":
      return <EconomyPanel />;
    case "Marriage & Family":
      return <MarriagePanel />;
    case "Housing & Realms":
      return <HousingPanel />;
    case "Achievements":
      return <AchievementsPanel />;
    default:
      return null;
  }
}

function Section({ title, children, commandHint }) {
  return (
    <div className="woc-card p-5 lg:p-6 space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {commandHint && (
          <span className="text-xs px-2 py-1 rounded-full bg-[var(--accent-soft)]">
            {commandHint}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

function Bullet({ children }) {
  return (
    <li className="flex gap-2 text-sm text-[var(--text-muted)]">
      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      <span>{children}</span>
    </li>
  );
}

/* -------------------- Panels -------------------- */

function ClansPanel() {
  return (
    <Section title="Clans: your long-term home" commandHint="/clanlist /claninfo /joinclan">
      <p className="text-sm text-[var(--text-muted)]">
        Clans are lore-heavy factions with quests & exams that unlock your real power.
      </p>

      <ol className="space-y-3 text-sm">
        <li><strong>1. Browse clans:</strong> /clanlist and /claninfo</li>
        <li><strong>2. Join a clan:</strong> /joinclan</li>
        <li><strong>3. Progress quests:</strong> Duels fuel Tier 1–3 clan quests</li>
      </ol>

      <ul className="space-y-2">
        <Bullet>Clans are per-server.</Bullet>
        <Bullet>/duelstats shows clan quest & exam readiness.</Bullet>
      </ul>
    </Section>
  );
}

function CombatPanel() {
  return (
    <Section title="Combat & duels" commandHint="/duel /duelstats /profile">
      <p className="text-sm text-[var(--text-muted)]">
        Duels determine power scaling and unlock your clan exam.
      </p>

      <ul className="space-y-2">
        <Bullet>Start a duel: /duel @opponent</Bullet>
        <Bullet>Power increases on wins, decreases on losses.</Bullet>
        <Bullet>Duels contribute to clan quests and exam requirements.</Bullet>
      </ul>
    </Section>
  );
}

function ExamPanel() {
  return (
    <Section title="Exams & prestige" commandHint="/exam /examstats /prestige">
      <p className="text-sm text-[var(--text-muted)]">
        Exams are 5-round boss checks using duel stats + clan quests + buffs.
      </p>

      <ul className="space-y-2">
        <Bullet>/duelstats shows exam requirements</Bullet>
        <Bullet>/exam begins the trial</Bullet>
        <Bullet>/prestige unlocks global titles & buffs</Bullet>
      </ul>
    </Section>
  );
}

function EconomyPanel() {
  return (
    <Section title="Economy & items" commandHint="/shop /inventory /work /daily">
      <p className="text-sm text-[var(--text-muted)]">
        WoC Coins (global) and server coins fuel items, crafting, gear & decorations.
      </p>
      <ul className="space-y-2">
        <Bullet>Earn coins with /work & /daily</Bullet>
        <Bullet>Buy items with /shop</Bullet>
        <Bullet>Equipment affects duels & exams</Bullet>
      </ul>
    </Section>
  );
}

function MarriagePanel() {
  return (
    <Section title="Marriage & family" commandHint="/marry /tree /family">
      <p className="text-sm text-[var(--text-muted)]">
        A global relationship system with family trees and drama.
      </p>

      <ul className="space-y-2">
        <Bullet>Propose: /marry @user</Bullet>
        <Bullet>Accept / decline in chat</Bullet>
        <Bullet>/tree shows parent/partner relationships</Bullet>
      </ul>
    </Section>
  );
}

function HousingPanel() {
  return (
    <Section title="Housing & realms" commandHint="/house /house decor">
      <p className="text-sm text-[var(--text-muted)]">
        Player homes provide buffs, decor placement, aura & comfort levels.
      </p>
      <ul className="space-y-2">
        <Bullet>/house shows your realm</Bullet>
        <Bullet>Decor raises aura & comfort</Bullet>
        <Bullet>Buffs apply in duels and exams</Bullet>
      </ul>
    </Section>
  );
}

function AchievementsPanel() {
  return (
    <Section title="Achievements" commandHint="/achievements">
      <p className="text-sm text-[var(--text-muted)]">
        Unlock milestones, flex badges, rare feats, and cosmetic achievements.
      </p>

      <ul className="space-y-2">
        <Bullet>/achievements shows your unlocked feats</Bullet>
        <Bullet>Some are global, some per-server</Bullet>
      </ul>
    </Section>
  );
}
