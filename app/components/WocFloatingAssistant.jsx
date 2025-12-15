"use client";

import Link from "next/link";
import { useWocTheme } from "../WocThemeProvider";

export default function WocFloatingAssistant() {
  const { mood } = useWocTheme();

  const moodText =
    mood === "battle"
      ? "Queue duels. I want clean executions."
      : mood === "playful"
      ? "Try /exam or /duel. I’m feeling theatrical."
      : mood === "omen"
      ? "Check your logs. Shadows love unmoderated servers."
      : mood === "flustered"
      ? "I’m totally fine. Let’s… do something impressive."
      : mood === "neutral"
      ? "System ready. Choose a command."
      : "Try /exam or /duel and see what happens.";

  const emoji =
    mood === "battle"
      ? "⚔️"
      : mood === "playful"
      ? "✨"
      : mood === "omen"
      ? "🕯️"
      : mood === "flustered"
      ? "😳"
      : mood === "neutral"
      ? "🌌"
      : "🌌";

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-xs">
      <div className="woc-card px-3 py-2 flex items-start gap-2 text-[11px] shadow-xl">
        <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-xs font-bold">
          {emoji}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[12px]">WOC is watching.</p>
          <p className="text-[var(--text-muted)] leading-snug">{moodText}</p>
          <div className="mt-1 flex gap-2">
            <Link
              href="/commands"
              className="text-[10px] underline underline-offset-2 text-[var(--accent)]"
            >
              View commands
            </Link>
            <Link
              href="/docs"
              className="text-[10px] underline underline-offset-2 text-[var(--text-muted)]"
            >
              Learn more
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
