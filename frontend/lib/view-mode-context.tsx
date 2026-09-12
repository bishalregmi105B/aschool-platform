"use client";

/**
 * ViewModeContext — governs whether the user sees the General Web Portal or
 * the AOS Desktop Operating System shell.
 *
 * Persistence: localStorage key "aschool_view_mode" (UI preference only,
 * not security-sensitive — localStorage is correct here; HttpOnly cookies
 * are reserved for auth tokens).
 *
 * Mobile adaptation:
 *  - General view → responsive SaaS web portal (unchanged)
 *  - AOS view → iOS Mobile Experience (Springboard + Control Center)
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ViewMode = "general" | "aos";

const STORAGE_KEY = "aschool_view_mode";

interface ViewModeContextType {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  toggleMode: () => void;
  /** True when the viewport is mobile-width (< 768px) */
  isMobile: boolean;
  /** True when AOS is active and the viewport is desktop */
  isAOSDesktop: boolean;
  /** True when AOS is active and the viewport is mobile (→ iOS experience) */
  isAOSMobile: boolean;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>("general");
  const [isMobile, setIsMobile] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ViewMode | null;
      if (stored === "aos" || stored === "general") {
        setModeState(stored);
      }
    } catch {
      // localStorage unavailable (e.g. private mode restrictions) — stay general
    }
  }, []);

  // Responsive breakpoint tracking
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const setMode = useCallback((next: ViewMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore write failures
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "general" ? "aos" : "general");
  }, [mode, setMode]);

  return (
    <ViewModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isMobile,
        isAOSDesktop: mode === "aos" && !isMobile,
        isAOSMobile: mode === "aos" && isMobile,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode(): ViewModeContextType {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}
