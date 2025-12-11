'use client';

import { useState, useEffect } from 'react';
import { useWocTheme } from '../WocThemeProvider';

/* ---------------------------------------------
   Dialogue Templates
   Each scenario has mood-based variants.
   Add as many as you want.
---------------------------------------------- */
const WOC_LINES = {
  duel_win: {
    neutral: [
      "Clan chat is screaming. **You** just hard-carried that duel.",
      "Another victory logged. **You** walk away glowing.",
      "WOC quietly nods — a clean execution.",
    ],
    hype: [
      "BROOO THAT WAS INSANE. **YOU COOKED SO HARD.** 🔥🔥",
      "**YOU JUST ERASED THEM FROM HISTORY.**",
    ],
    tired: [
      "Victory… but maybe take a breather? WOC is sipping tea slowly.",
      "You win… WOC yawns. ‘Good job. I guess.’ 😪",
    ],
    angry: [
      "Finally. Justice. That duel was personal.",
      "**You crushed them.** WOC's aura crackles.",
    ],
  },

  duel_loss: {
    neutral: [
      "Tough loss. Reset, refocus, re-enter the arena.",
      "Defeat is data — and WOC logs everything.",
    ],
    hype: [
      "YOU ALMOST HAD THAT. RUN IT BACK. 🗣️",
      "Not bad — now go terrorize the ladder.",
    ],
    tired: [
      "Loss received… WOC blinks slowly. ‘Oof.’",
      "Defeat… WOC curls up under a blanket.",
    ],
    angry: [
      "UNACCEPTABLE. WOC DEMANDS A REMATCH.",
      "You lost… WOC is fuming.",
    ],
  },

  exam_fail: {
    neutral: [
      "Exam failed — but progress is progress.",
      "WOC logs the failure. Retry recommended.",
    ],
    hype: [
      "YOU WERE *RIGHT THERE*. LOCK IN AND SEND IT AGAIN.",
      "This is your villain arc. Power up.",
    ],
    tired: [
      "Another fail… WOC sighs sympathetically.",
      "It’s okay… WOC pats your head tiredly.",
    ],
    angry: [
      "The exam humiliated us. We retaliate tomorrow.",
      "Failure detected. Rage increasing.",
    ],
  },
};

/* ---------------------------------------------
   Component
---------------------------------------------- */
export default function WocTalks() {
  const { mood } = useWocTheme(); // hype, tired, angry, neutral
  const [scenario, setScenario] = useState('duel_win');
  const [line, setLine] = useState(''); // first SSR-safe render

  // Pick a random line SAFELY (client only)
  function pickLine(currentScenario, currentMood) {
    const set =
      WOC_LINES[currentScenario]?.[currentMood] ||
      WOC_LINES[currentScenario]?.neutral ||
      ["WOC has no words… suspicious."];

    return set[Math.floor(Math.random() * set.length)];
  }

  // Only runs on the client → avoids hydration mismatch
  useEffect(() => {
    setLine(pickLine(scenario, mood));
  }, [scenario, mood]);

  return (
    <div className="woc-card p-6 mt-10 border border-[var(--border-subtle)]/50">
      <h2 className="text-lg font-semibold mb-3">WOC Talks</h2>

      {/* Scenario selector */}
      <label className="text-xs font-medium text-[var(--text-muted)]">
        Choose scenario:
      </label>

      <select
        className="mt-2 p-2 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-sm"
        value={scenario}
        onChange={(e) => setScenario(e.target.value)}
      >
        <option value="duel_win">Duel win</option>
        <option value="duel_loss">Duel loss</option>
        <option value="exam_fail">Exam fail</option>
      </select>

      {/* Preview line */}
      <div className="mt-4">
        <p className="text-[13px] leading-relaxed text-[var(--text-main)]">
          {line || "WOC is thinking…"}
        </p>
      </div>

      {/* Info footer */}
      <p className="mt-4 text-[11px] text-[var(--text-muted)]">
        These templates can be copied directly into your bot’s Discord commands.
      </p>
    </div>
  );
}
