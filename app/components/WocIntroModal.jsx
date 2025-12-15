"use client";

import { useEffect, useState } from "react";
import { useWocTheme } from "../WocThemeProvider";

const INTRO_KEY = "woc-intro-dismissed-v1";

export default function WocIntroModal() {
  const [open, setOpen] = useState(false);
  const { mood } = useWocTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const dismissed = window.localStorage.getItem(INTRO_KEY);
      if (!dismissed) {
        const id = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(id);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  function close() {
    setOpen(false);
    try {
      window.localStorage.setItem(INTRO_KEY, "1");
    } catch {}
  }

  if (!open) return null;

  const moodLine =
    mood === "battle"
      ? "I’m not here to vibe. I’m here to win."
      : mood === "playful"
      ? "I may be dramatic. It’s a feature."
      : mood === "omen"
      ? "Keep your logs clean. The void reads receipts."
      : mood === "flustered"
      ? "Don’t look at me like that. I’m calibrating."
      : mood === "neutral"
      ? "Systems stable. For now."
      : "Calm for now. That never lasts.";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="woc-card max-w-md w-full mx-4 p-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-sky-400" />

        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-400 via-sky-500 to-violet-500 shadow-lg flex items-center justify-center text-xl font-bold">
              W
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">WOC boot sequence complete.</h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Discord adventure engine, reporting in. I track every clan exam, duel and drama spike.
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 text-[12px]">
              <p className="mb-1">
                Current mood: <span className="font-semibold capitalize">{mood}</span>.
              </p>
              <p className="text-[var(--text-muted)]">{moodLine}</p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button type="button" className="woc-btn-primary text-xs" onClick={close}>
                Got it, let&apos;s play
              </button>
              <button
                type="button"
                onClick={close}
                className="text-[11px] text-[var(--text-muted)] underline-offset-2 hover:underline"
              >
                Close &amp; don&apos;t show again
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
