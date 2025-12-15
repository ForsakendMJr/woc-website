"use client";

import { useEffect, useState } from "react";
import { useWocTheme } from "../WocThemeProvider";

/**
 * Uses your actual moods:
 * neutral | battle | playful | story | omen | flustered
 */
const WOC_LINES = {
  duel_win: {
    story: [
      "Clan chat is screaming. **You** just hard-carried that duel.",
      "Another victory logged. **You** walk away glowing.",
      "WOC quietly nods. A clean execution.",
    ],
    playful: [
      "ABSURD DAMAGE. **YOU COOKED.** 🔥",
      "**You just erased them from the timeline.**",
      "WOC is grinning. This is going in the highlight reel.",
    ],
    battle: [
      "Victory confirmed. No mercy. No notes.",
      "Target down. Arena integrity maintained.",
    ],
    omen: [
      "You won… but the air feels *wrong*. Something’s coming.",
      "Victory registered. WOC’s sensors whisper: ‘Not over.’",
    ],
    flustered: [
      "YOU… you did that?? I mean… obviously you did. 😳",
      "Win detected. WOC is pretending this was expected.",
    ],
    neutral: [
      "Win logged. Good work.",
      "Victory secured. Next.",
    ],
  },

  duel_loss: {
    story: [
      "Tough loss. Reset, refocus, re-enter the arena.",
      "Defeat is data. WOC logs everything.",
    ],
    playful: [
      "YOU ALMOST HAD THAT. RUN IT BACK. 🗣️",
      "Not bad. Now go terrorize the ladder again.",
    ],
    battle: [
      "Loss acknowledged. Adapt and strike again.",
      "Training mode recommended. Immediately.",
    ],
    omen: [
      "Defeat… and the shadows seem pleased.",
      "The arena remembers. WOC does too.",
    ],
    flustered: [
      "OKAY but like… that was *close*. We don’t talk about it. 😤",
      "Loss received. WOC is… not panicking. Definitely not.",
    ],
    neutral: [
      "Loss logged. Try again.",
      "Defeat recorded.",
    ],
  },

  exam_fail: {
    story: [
      "Exam failed, but progress is progress.",
      "WOC logs the failure. Retry recommended.",
    ],
    playful: [
      "YOU WERE *RIGHT THERE*. LOCK IN AND SEND IT AGAIN.",
      "This is your villain arc. Power up.",
    ],
    battle: [
      "Failure detected. Recalibrate and reattempt.",
      "We do not lose to paperwork. Again.",
    ],
    omen: [
      "The exam humiliated us. The rubric will answer for this.",
      "Failure… and the system feels… amused.",
    ],
    flustered: [
      "It’s fine. Totally fine. We’re… fine. 😅",
      "Okay, okay. One more try. No one saw that.",
    ],
    neutral: [
      "Exam failed. Try again.",
      "Attempt logged. Incomplete.",
    ],
  },
};

export default function WocTalks() {
  const { mood } = useWocTheme(); // neutral | battle | playful | story | omen | flustered
  const [scenario, setScenario] = useState("duel_win");
  const [line, setLine] = useState("");

  function pickLine(currentScenario, currentMood) {
    const set =
      WOC_LINES[currentScenario]?.[currentMood] ||
      WOC_LINES[currentScenario]?.story ||
      WOC_LINES[currentScenario]?.neutral ||
      ["WOC has no words… suspicious."];

    return set[Math.floor(Math.random() * set.length)];
  }

  useEffect(() => {
    setLine(pickLine(scenario, mood));
  }, [scenario, mood]);

  return (
    <div className="woc-card p-6 mt-10 border border-[var(--border-subtle)]/50">
      <h2 className="text-lg font-semibold mb-3">WOC Talks</h2>

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

      <div className="mt-4">
        <p className="text-[13px] leading-relaxed text-[var(--text-main)]">
          {line || "WOC is thinking…"}
        </p>
      </div>

      <p className="mt-4 text-[11px] text-[var(--text-muted)]">
        These templates can be copied directly into your bot’s Discord commands.
      </p>
    </div>
  );
}
