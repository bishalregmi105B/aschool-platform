"use client";

/**
 * DB-backed AOS desktop state.
 *
 * The AOSDesktopShell keeps its useState shape (props flow unchanged), but
 * hydration and persistence now go through /auth/aos-settings so a user's
 * desktop follows them across devices. A localStorage cache gives instant
 * first paint; the server value wins once loaded.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export interface AOSUserSettings {
  theme_mode: "light" | "dark";
  accent_color: string;
  wallpaper: string;
  brightness: number;
  dock_style: "mac" | "win11";
  dock_size: "small" | "medium" | "large";
  show_top_bar: boolean;
  top_bar_height: "compact" | "standard" | "large";
  blur_intensity: number;
  taskbar_align: "center" | "left";
  system_mode: "" | "desktop" | "mobile";
  pinned_apps: string[];
  desktop_folders: unknown[];
  home_widgets: string[];
  /**
   * Which quick items the AOS menu bar shows on its left side (desktop view).
   * Known ids: "sections", "vault", "store", "widgets". Absent (undefined)
   * means the user never customized it — DEFAULT_TOPBAR_ITEMS applies.
   */
  topbar_items?: string[];
  /** Free-form desktop arrangement: icon/folder positions + widget layout. */
  desktop_layout: Record<string, unknown>;
}

/** Default left-side menu bar items (used when topbar_items is absent). */
export const DEFAULT_TOPBAR_ITEMS: readonly string[] = [
  "sections",
  "vault",
  "store",
  "widgets",
];

export const AOS_SETTINGS_DEFAULTS: AOSUserSettings = {
  theme_mode: "dark",
  accent_color: "#0078d4",
  wallpaper: "bloom-dark",
  brightness: 100,
  dock_style: "mac",
  dock_size: "medium",
  show_top_bar: true,
  top_bar_height: "standard",
  blur_intensity: 30,
  taskbar_align: "center",
  system_mode: "",
  pinned_apps: [],
  desktop_folders: [],
  home_widgets: [],
  desktop_layout: {},
};

const CACHE_KEY = "aschool_aos_settings_cache";

interface APIResponse<T> {
  success: boolean;
  data: T;
}

// Raw server shape (everything is stored as strings + JSONB lists).
type RawAOS = Record<string, unknown>;

function coerce(raw: RawAOS | null | undefined): AOSUserSettings {
  if (!raw) return { ...AOS_SETTINGS_DEFAULTS };
  const num = (v: unknown, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const bool = (v: unknown, d: boolean) => (v === "true" ? true : v === "false" ? false : d);
  const str = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
    allowed.includes(v as T) ? (v as T) : d;
  return {
    theme_mode: str(raw.theme_mode, ["light", "dark"] as const, "dark"),
    accent_color: typeof raw.accent_color === "string" ? raw.accent_color : "#0078d4",
    wallpaper: typeof raw.wallpaper === "string" ? raw.wallpaper : "bloom-dark",
    brightness: num(raw.brightness, 100),
    dock_style: str(raw.dock_style, ["mac", "win11"] as const, "mac"),
    dock_size: str(raw.dock_size, ["small", "medium", "large"] as const, "medium"),
    show_top_bar: bool(raw.show_top_bar, true),
    top_bar_height: str(raw.top_bar_height, ["compact", "standard", "large"] as const, "standard"),
    blur_intensity: num(raw.blur_intensity, 30),
    taskbar_align: str(raw.taskbar_align, ["center", "left"] as const, "center"),
    system_mode: str(raw.system_mode, ["", "desktop", "mobile"] as const, ""),
    pinned_apps: Array.isArray(raw.pinned_apps) ? (raw.pinned_apps as string[]) : [],
    desktop_folders: Array.isArray(raw.desktop_folders) ? raw.desktop_folders : [],
    home_widgets: Array.isArray(raw.home_widgets) ? (raw.home_widgets as string[]) : [],
    topbar_items: Array.isArray(raw.topbar_items)
      ? (raw.topbar_items as unknown[]).filter((v): v is string => typeof v === "string")
      : undefined,
    desktop_layout:
      raw.desktop_layout && typeof raw.desktop_layout === "object" && !Array.isArray(raw.desktop_layout)
        ? (raw.desktop_layout as Record<string, unknown>)
        : {},
  };
}

export function useAOSUserSettings() {
  const [settings, setSettings] = useState<AOSUserSettings>(() => {
    if (typeof window === "undefined") return { ...AOS_SETTINGS_DEFAULTS };
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? coerce(JSON.parse(cached)) : { ...AOS_SETTINGS_DEFAULTS };
    } catch {
      return { ...AOS_SETTINGS_DEFAULTS };
    }
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Hydrate from the server once; server wins over cache.
  useEffect(() => {
    let cancelled = false;
    api
      .get<APIResponse<RawAOS>>("/auth/aos-settings")
      .then((res) => {
        if (cancelled) return;
        const next = coerce(res.data?.data);
        setSettings(next);
        setIsLoaded(true);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Offline / unauthenticated — keep cache/defaults.
        setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced persistence: any settings change after hydration is pushed to
  // the server (and mirrored to the instant-paint cache).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRef = useRef<string>("");

  const updateSettings = useCallback((patch: Partial<AOSUserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const payload = JSON.stringify(next);
        if (payload === lastPushedRef.current) return;
        lastPushedRef.current = payload;
        api
          .put<APIResponse<RawAOS>>("/auth/aos-settings", next)
          .catch(() => {
            // Failed pushes are retried implicitly on next change; the
            // cache keeps the intent for the next session.
            lastPushedRef.current = "";
          });
      }, 800);

      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { settings, updateSettings, isLoaded };
}
