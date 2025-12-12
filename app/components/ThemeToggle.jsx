// app/components/ThemeToggle.jsx
'use client';

import { useWocTheme } from '../WocThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme, mood, cycleMood } = useWocTheme();
  const isPromo = theme === 'promo';

  const themeLabel = isPromo ? 'Cosmic dark' : 'Promo light';
  const themeDotColor = isPromo ? '#4f46e5' : '#38bdf8';

  // Small mood label for fun (matches moods in WocThemeProvider)
  const moodLabelMap = {
    neutral: 'Neutral',
    battle: 'Battle',
    playful: 'Playful',
    story: 'Story',
    omen: 'Omen',
    flustered: 'Flustered',
  };

  const moodLabel = moodLabelMap[mood] || 'Story';

  return (
    <div className="flex items-center gap-2">
      {/* Theme toggle: Cosmic / Promo */}
      <button
        type="button"
        onClick={toggleTheme}
        className="woc-btn-ghost text-xs sm:text-sm flex items-center gap-2"
      >
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: themeDotColor }}
        />
        {themeLabel}
      </button>

      {/* Mood cycler: rotates through battle / playful / story / omen / flustered */}
      <button
        type="button"
        onClick={cycleMood}
        className="woc-btn-ghost text-[0.7rem] sm:text-xs px-3 py-1 flex items-center gap-1"
        title="Change WoC's mood"
      >
        <span className="text-xs" aria-hidden="true">
          🎭
        </span>
        <span>{moodLabel}</span>
      </button>
    </div>
  );
}
