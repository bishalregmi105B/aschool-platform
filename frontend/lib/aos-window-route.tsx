"use client";

import React, { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * In-process navigation for the AOS desktop.
 *
 * Windows never navigate the browser: the shell keeps the URL pinned at
 * /dashboard and routes are virtual. This context gives window content the
 * route it is displaying (so pages can read query params/tabs from it) and
 * gives any component a navigate() that opens/focuses the right window.
 */

export interface AOSWindowRouteInfo {
  /** Full virtual route of this window, e.g. "/dashboard/library?tab=issues". */
  route: string;
  /** Route path only (no query). */
  pathname: string;
  /** Parsed query params of the virtual route. */
  params: Record<string, string>;
}

const WindowRouteContext = createContext<AOSWindowRouteInfo | null>(null);

export function AOSWindowRouteProvider({
  route,
  children,
}: {
  route: string;
  children: React.ReactNode;
}) {
  const [pathname, query] = route.split("?");
  const params: Record<string, string> = {};
  if (query) {
    for (const part of query.split("&")) {
      const [k, v = ""] = part.split("=");
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  return (
    <WindowRouteContext.Provider value={{ route, pathname, params }}>
      {children}
    </WindowRouteContext.Provider>
  );
}

/**
 * The virtual route of the enclosing AOS window (null outside a window).
 * Pages that need query params (e.g. `?tab=issues`) should read them here —
 * useSearchParams() reflects the pinned shell URL, not the window's route.
 */
export function useAOSWindowRoute(): AOSWindowRouteInfo | null {
  return useContext(WindowRouteContext);
}

/** navigate(route) — opens/focuses the target window (provided by the shell). */
export type AOSNavigateFn = (route: string) => void;
const NavigateContext = createContext<AOSNavigateFn | null>(null);

export function AOSNavigateProvider({
  navigate,
  children,
}: {
  navigate: AOSNavigateFn;
  children: React.ReactNode;
}) {
  return <NavigateContext.Provider value={navigate}>{children}</NavigateContext.Provider>;
}

/** In-process navigation anywhere in the shell (windows, widgets, flyouts). */
export function useAOSNavigate(): AOSNavigateFn | null {
  return useContext(NavigateContext);
}

/**
 * Router-compatible navigation that prefers the in-process AOS navigate
 * (no URL change) and falls back to the Next router (e.g. inside aos_embed
 * iframes, where no AOS shell provides the navigate context).
 *
 * Drop-in replacement for `const router = useRouter(); router.push(x)` in
 * dashboard pages: `const navigate = useAOSRouterNavigate(); navigate(x)`.
 */
export function useAOSRouterNavigate(): (route: string) => void {
  const aosNavigate = useContext(NavigateContext);
  const router = useRouter();
  return useCallback(
    (route: string) => {
      if (aosNavigate) {
        aosNavigate(route);
      } else {
        router.push(route);
      }
    },
    [aosNavigate, router]
  );
}
