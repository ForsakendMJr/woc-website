// app/WocThemeProvider.jsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const DEFAULT_THEME = 'cosmic'; // 'cosmic' or 'promo'

// Include the moods you wired into globals.css
// plus a neutral baseline
const MOODS = ['neutral', 'battle', 'playful', 'story', 'omen', 'flustered'];
const DEFAULT_MOOD = 'story';

const WocThemeContext = createContext(null);

export function WocThemeProvider({ children }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [mood, setMood] = useState(DEFAULT_MOOD);

  // Load from localStorage on first mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedTheme = window.localStorage.getItem('woc-theme');
      const storedMood = window.localStorage.getItem('woc-mood');

      if (storedTheme === 'cosmic' || storedTheme === 'promo') {
        setTheme(storedTheme);
      }
      if (storedMood && MOODS.includes(storedMood)) {
        setMood(storedMood);
      }
    } catch {
      // ignore
    }
  }, []);

  // Sync theme + mood to DOM & persist
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;

    // theme classes on <html>
    html.classList.remove('theme-cosmic', 'theme-promo');
    html.classList.add(theme === 'promo' ? 'theme-promo' : 'theme-cosmic');

    // mood on <body> to match your CSS (body[data-woc-mood="…"])
    if (body) {
      body.setAttribute('data-woc-mood', mood);
    }

    try {
      window.localStorage.setItem('woc-theme', theme);
      window.localStorage.setItem('woc-mood', mood);
    } catch {
      // ignore
    }
  }, [theme, mood]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'cosmic' ? 'promo' : 'cosmic'));
  };

  const cycleMood = () => {
    setMood(prev => {
      const idx = MOODS.indexOf(prev);
      if (idx === -1) return DEFAULT_MOOD;
      return MOODS[(idx + 1) % MOODS.length];
    });
  };

  const value = { theme, mood, setTheme, setMood, toggleTheme, cycleMood };

  return (
    <WocThemeContext.Provider value={value}>
      {children}
    </WocThemeContext.Provider>
  );
}

export function useWocTheme() {
  const ctx = useContext(WocThemeContext);
  if (!ctx) {
    throw new Error('useWocTheme must be used inside WocThemeProvider');
  }
  return ctx;
}
