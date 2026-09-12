export const AOS_ROUTE_WINDOW_PREFIX = "route:";
export const AOS_THEME_STORAGE_KEY = "aschool_aos_theme";

function normalizePath(pathname: string): string {
  const cleaned = pathname.replace(/\/+$/g, "");
  return cleaned || "/";
}

function splitRoute(route: string): { path: string; search: string } {
  const idx = route.indexOf("?");
  if (idx === -1) {
    return { path: route, search: "" };
  }
  return {
    path: route.slice(0, idx),
    search: route.slice(idx),
  };
}

function parseRouteUrl(rawRoute: string): URL | null {
  if (!rawRoute) return null;

  const trimmed = String(rawRoute).trim();
  if (!trimmed) return null;

  try {
    const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = hasScheme ? new URL(trimmed) : new URL(trimmed, base);

    if (hasScheme && typeof window !== "undefined" && url.origin !== window.location.origin) {
      return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function normalizeAOSRoute(rawRoute: string): string | null {
  const url = parseRouteUrl(rawRoute);
  if (!url) return null;

  const pathname = normalizePath(url.pathname);
  let canonicalPath = "";

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    canonicalPath = pathname;
  } else if (pathname === "/aos/apps" || pathname === "/aos/apps/") {
    canonicalPath = "/dashboard";
  } else if (pathname.startsWith("/aos/apps/")) {
    const suffix = pathname.slice("/aos/apps/".length);
    canonicalPath = suffix ? `/dashboard/${suffix}` : "/dashboard";
  } else {
    return null;
  }

  return `${canonicalPath}${url.search || ""}`;
}

export function routeToAOSAppPath(rawRoute: string): string | null {
  const normalized = normalizeAOSRoute(rawRoute);
  if (!normalized) return null;

  const { path, search } = splitRoute(normalized);
  if (path === "/dashboard") {
    return `/aos/apps${search}`;
  }

  const suffix = path.replace(/^\/dashboard\//, "");
  return `/aos/apps/${suffix}${search}`;
}

export function extractAOSModuleSlug(rawRoute: string): string | null {
  const normalized = normalizeAOSRoute(rawRoute);
  if (!normalized) return null;

  const { path } = splitRoute(normalized);
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "dashboard") return null;
  return segments[1] || null;
}

export function isAOSRootModuleRoute(rawRoute: string): boolean {
  const normalized = normalizeAOSRoute(rawRoute);
  if (!normalized) return false;

  const { path, search } = splitRoute(normalized);
  if (search) return false;

  const segments = path.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "dashboard";
}

export function formatAOSRouteTitle(rawRoute: string): string {
  const normalized = normalizeAOSRoute(rawRoute);
  if (!normalized) return "AOS Module";

  const { path } = splitRoute(normalized);
  const parts = path
    .split("/")
    .filter(Boolean)
    .slice(1)
    .map((segment) =>
      segment
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase())
    );

  if (!parts.length) return "AOS Module";
  return parts.join(" / ");
}

export function buildAOSRouteWindowId(rawRoute: string): string | null {
  const normalized = normalizeAOSRoute(rawRoute);
  if (!normalized) return null;
  return `${AOS_ROUTE_WINDOW_PREFIX}${normalized}`;
}

export function parseAOSRouteWindowId(windowId: string): string | null {
  if (!windowId?.startsWith(AOS_ROUTE_WINDOW_PREFIX)) return null;
  const route = windowId.slice(AOS_ROUTE_WINDOW_PREFIX.length);
  return normalizeAOSRoute(route);
}
