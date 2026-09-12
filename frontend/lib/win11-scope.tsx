"use client";

import React, { useEffect, useState } from "react";

/**
 * Scoped 11.css only applies inside an element carrying the `win11` class
 * (plus a `dark` class / `data-theme` marker for dark tokens). Two escape
 * hatches break that containment:
 *
 *  1. Radix portals mount at document.body — outside the AOS shell root.
 *  2. `aos_embed=1` iframes render dashboard pages without the OS shell.
 *
 * `useWin11Scope` mirrors the shell root's theme markers so portaled/embedded
 * surfaces can re-establish the scope with `<Win11Scope>`.
 */

const FALLBACK_THEME = "dark";

function readShellTheme(): { theme: string; extraClass: string } {
  if (typeof document === "undefined") return { theme: FALLBACK_THEME, extraClass: "" };
  const shell = document.querySelector(".aos-desktop");
  const theme = shell?.getAttribute("data-theme") || FALLBACK_THEME;
  const dark = theme === "dark" || shell?.classList.contains("dark");
  return { theme, extraClass: dark ? "dark" : "" };
}

export function useWin11Scope(): { theme: string; className: string } {
  const [scope, setScope] = useState(readShellTheme);

  useEffect(() => {
    const update = () => setScope(readShellTheme());
    update();

    const shell = document.querySelector(".aos-desktop");
    if (shell) {
      const observer = new MutationObserver(update);
      observer.observe(shell, { attributes: true, attributeFilter: ["class", "data-theme"] });
      return () => observer.disconnect();
    }

    // Embedded (iframe) context: no shell root in this document. The parent
    // persists theme changes to localStorage, which fires `storage` here.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "aschool_aos_theme") update();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { theme: scope.theme, className: `win11 ${scope.extraClass}`.trim() };
}

/** Re-establishes the scoped 11.css design system around arbitrary content. */
export function Win11Scope({ children }: { children: React.ReactNode }) {
  const { theme, className } = useWin11Scope();
  return (
    <div className={className} data-theme={theme}>
      {children}
    </div>
  );
}
