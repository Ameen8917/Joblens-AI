import { useCallback, useEffect, useState } from 'react';
import { ResultTab } from '../types';

export type ThemeChoice = 'light' | 'dark' | 'system';

export interface Settings {
  displayName: string;
  theme: ThemeChoice;
  defaultTab: ResultTab;
  coverLetterTone: 'professional' | 'friendly' | 'confident';
  interviewDifficulty: 'easy' | 'standard' | 'hard';
}

const KEY = 'joblens_settings';
const DEFAULTS: Settings = {
  displayName: '', theme: 'light', defaultTab: 'fit',
  coverLetterTone: 'professional', interviewDifficulty: 'standard',
};

const load = (): Settings => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; }
};

const QUERY = '(prefers-color-scheme: dark)';

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(load);
  const [osDark, setOsDark] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = () => setOsDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const dark = settings.theme === 'dark' || (settings.theme === 'system' && osDark);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  return { settings, update, dark };
};
