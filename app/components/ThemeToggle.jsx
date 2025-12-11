'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('cosmic');

  // Load saved theme
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('woc-theme');

    const initial = saved === 'promo' || saved === 'cosmic' ? saved : 'cosmic';
    setTheme(initial);

    document.documentElement.classList.remove('theme-cosmic', 'theme-promo');
    document.documentElement.classList.add(
      initial === 'promo' ? 'theme-promo' : 'theme-cosmic'
    );
  }, []);

  // Apply theme on change
  useEffect(() => {
    document.documentElement.classList.remove('theme-cosmic', 'theme-promo');
    document.documentElement.classList.add(
      theme === 'promo' ? 'theme-promo' : 'theme-cosmic'
    );
    window.localStorage.setItem('woc-theme', theme);
  }, [theme]);

  const isPromo = theme === 'promo';

  return (
    <button
      type="button"
      onClick={() => setTheme(isPromo ? 'cosmic' : 'promo')}
      className="woc-btn-ghost text-xs sm:text-sm flex items-center gap-2"
    >
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ background: isPromo ? '#4f46e5' : '#38bdf8' }}
      />
      {isPromo ? 'Cosmic dark' : 'Promo light'}
    </button>
  );
}
