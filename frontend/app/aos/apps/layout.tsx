"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AOS_THEME_STORAGE_KEY } from "@/lib/aos-navigation";

export const dynamic = "force-dynamic";

export default function AOSAppsLayout({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const syncTheme = () => {
      try {
        const storedTheme = localStorage.getItem(AOS_THEME_STORAGE_KEY);
        if (storedTheme === "light" || storedTheme === "dark") {
          setThemeMode(storedTheme);
        }
      } catch {
        // Ignore storage access issues
      }
    };

    syncTheme();
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", themeMode === "dark");
    root.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  return (
    <div className={`aos-app-page ${themeMode === "dark" ? "dark" : ""}`} data-theme={themeMode}>
      {children}
    </div>
  );
}
