"use client";
/**
 * Lightweight bilingual (English ⇄ नेपाली) i18n for the dashboard.
 *
 * L-01 root cause: the sidebar read `preferred_language` from localStorage
 * but nothing else did — and there was no UI to change it — so the shell
 * rendered Nepali while every page stayed English. This module is the single
 * source of truth: one React context, one localStorage key, one `t()` that
 * falls back English→Nepali so partial dictionaries degrade gracefully.
 *
 * Usage: `const { t, lang, setLang } = useI18n()` → `t("Save", "सुरक्षित")`.
 * Passing both strings inline keeps translations next to the element they
 * label (the same convention the plugin manifests use with label_nepali).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Lang = "en" | "ne";

const STORAGE_KEY = "preferred_language";

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "ne" || v === "en" ? v : "en";
}

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** t(english, nepali) → string for the active language. */
  t: (en: string, ne: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start from the stored preference on first client render (SSR-safe: the
  // server default "en" matches what pickLabel used pre-hydration because we
  // moved the stored-preference read into an effect below).
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(readStoredLang());
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {}
    document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((en: string, ne: string) => (lang === "ne" ? ne : en), [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === "en" ? "ne" : "en"),
      t,
    }),
    [lang, setLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
