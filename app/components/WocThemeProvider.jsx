'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const WocThemeContext = createContext(null);

const THEME_KEY = 'woc-theme';
const MOOD_KEY = 'woc-mood';

// theme: 'cosmic' | 'promo'
// mood:  'neutral' | 'battle' | 'playful' | 'story' | 'omen' | 'flustered'
export function WocThemeProvider({ children }) {
  const [theme, setTheme] = useState('cosmic');
  const [mood, setMood] = useState('neutral');

  // hydrate from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedTheme = window.localStorage.getItem(THEME_KEY);
    const storedMood = window.localStorage.getItem(MOOD_KEY);

    if (storedTheme === 'cosmic' || storedTheme === 'promo') {
      setTheme(storedTheme);
    }
    if (storedMood) {
      setMood(storedMood);
    }
  }, []);

  // keep <html> classes in sync with theme
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    html.classList.remove('theme-cosmic', 'theme-promo');
    html.classList.add(theme === 'promo' ? 'theme-promo' : 'theme-cosmic');

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme]);

  // keep <body data-woc-mood="…"> in sync with mood
  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.body?.setAttribute('data-woc-mood', mood);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MOOD_KEY, mood);
    }
  }, [mood]);

  const value = {
    theme,
    setTheme,
    mood,
    setMood,
    // helpers you can call from components / bot states:
    setBattleMood: () => setMood('battle'),
    setPlayfulMood: () => setMood('playful'),
    setStoryMood: () => setMood('story'),
    setOmenMood: () => setMood('omen'),
    setFlusteredMood: () => setMood('flustered'),
    resetMood: () => setMood('neutral'),
  };

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
