import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STRINGS, type Lang } from './strings';

export type { Lang } from './strings';

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'zrm.lang' },
  ),
);

/** Apply text direction + lang attribute to <html>. Arabic → RTL. */
export function applyDirection(lang: Lang): void {
  const root = document.documentElement;
  root.setAttribute('lang', lang);
  root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
}

export function translate(lang: Lang, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

/** Reactive translator hook — components re-render when the language changes. */
export function useT(): (key: string) => string {
  const lang = useLangStore((s) => s.lang);
  return (key: string) => translate(lang, key);
}
