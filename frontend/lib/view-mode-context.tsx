"use client";

/**
 * ViewModeContext — AOS-only runtime selector.
 *
 * Architecture decision:
 *  - General web portal mode is retired.
 *  - Desktop renders AOS Desktop shell.
 *  - Mobile renders AOS Mobile experience.
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ViewMode = "aos";

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
  const mode: ViewMode = "aos";
  const [isMobile, setIsMobile] = useState(false);

  // Responsive breakpoint tracking
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const setMode = useCallback((_next: ViewMode) => {
    // AOS-only mode: setter kept for backward compatibility with existing callers.
  }, []);

  const toggleMode = useCallback(() => {
    // AOS-only mode: toggle intentionally disabled.
  }, []);

  return (
    <ViewModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isMobile,
        isAOSDesktop: !isMobile,
        isAOSMobile: isMobile,
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
