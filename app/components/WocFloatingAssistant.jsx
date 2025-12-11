'use client';

import Link from 'next/link';
import { useWocTheme } from '../WocThemeProvider';

export default function WocFloatingAssistant() {
  const { mood } = useWocTheme();

  const moodText =
    mood === 'hype'
      ? 'Queue duels. I want fireworks.'
      : mood === 'tired'
      ? 'Maybe run /tutorial and chill.'
      : mood === 'angry'
      ? 'Find someone to 1v1. Immediately.'
      : 'Try /exam or /duel and see what happens.';

  const emoji =
    mood === 'hype' ? '🔥' : mood === 'tired' ? '😴' : mood === 'angry' ? '💢' : '🌌';

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
