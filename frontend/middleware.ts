import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SCHOOL_SITE_DOMAIN } from "@/lib/site-domain";

const PUBLIC_PATHS = ["/", "/login", "/register", "/verify-otp", "/_next", "/favicon.ico", "/api"];

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

/**
 * Main domains — requests on these go through normal dashboard routing.
 * Anything else is treated as a school subdomain (or a custom domain that
 * gets resolved via the backend public-domain lookup below).
 */
const MAIN_HOSTS = new Set([
  SCHOOL_SITE_DOMAIN,
  `www.${SCHOOL_SITE_DOMAIN}`,
  `app.${SCHOOL_SITE_DOMAIN}`,
  "localhost:3000",
  "localhost:3001",
  "localhost:3003",
  "localhost",
  "127.0.0.1:3000",
  "127.0.0.1:3001",
  "127.0.0.1:3003",
  "127.0.0.1",
]);

const SCHOOL_BASE_DOMAINS = [SCHOOL_SITE_DOMAIN];

function normalizeHost(host: string) {
  return host.split(":")[0].toLowerCase();
}

function checkIsMainHost(rawHost: string, hostname: string): boolean {
  if (
    MAIN_HOSTS.has(rawHost) ||
    MAIN_HOSTS.has(hostname) ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.")
  ) {
    return true;
  }
  return false;
}

async function resolveCustomDomainSlug(hostname: string) {
  const host = hostname.replace(/^www\./, "");
  if (!API_URL || !host) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/website/public-domain?host=${encodeURIComponent(host)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.slug || null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawHost = request.headers.get("host") || "";
  const hostname = normalizeHost(rawHost);

  // ─── Subdomain routing ───────────────────────────────
  // If the request is on a subdomain (e.g. greenvalley.brighternepal.com),
  // rewrite to /school/[slug]/... internally.
  const isMain = checkIsMainHost(rawHost, hostname);
  const baseDomain = SCHOOL_BASE_DOMAINS.find((domain) => hostname.endsWith(`.${domain}`));

  if (!isMain && !pathname.startsWith("/school/") && !pathname.startsWith("/_next") && !pathname.startsWith("/api")) {
    if (baseDomain) {
      const slug = hostname.replace(`.${baseDomain}`, "");
      if (slug && slug !== "www") {
        const url = request.nextUrl.clone();
        url.pathname = `/school/${slug}${pathname}`;
        return NextResponse.rewrite(url);
      }
    }

    const customSlug = await resolveCustomDomainSlug(hostname);
    if (!customSlug) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/school/${customSlug}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // ─── Skip static / public paths ────────────────────
  if (pathname === "/" || PUBLIC_PATHS.some((p) => p !== "/" && pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ─── Public school pages (direct path access) ──────
  if (pathname.startsWith("/school/")) {
    return NextResponse.next();
  }

  // ─── Dashboard auth guard ──────────────────────────
  // E215: the access JWT expires hourly, but the refresh cookie lasts 30 days.
  // An expired/absent access cookie no longer bounces the user to /login when
  // a refresh cookie exists — the navigation is allowed through and the client
  // recovers (lib/api.ts single-flight POST /auth/refresh on the first 401 and
  // redirects only if that fails). The refresh cookie's PRESENCE is used only
  // as "maybe authenticated" for ROUTING; every API route is still verified
  // server-side (JWT signature + blocklist), so this weakens nothing.
  const token = request.cookies.get("access_token")?.value;
  const hasRefreshCookie = !!request.cookies.get("refresh_token")?.value;

  function isTokenExpired(jwt: string): boolean {
    try {
      const payload = JSON.parse(
        Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")
      );
      return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  // Reads the `role` claim the backend puts in every JWT payload
  // (app/services/auth_service.py create_tokens). Unverified here, but the
  // super-admin layout re-verifies against /auth/me and every super-admin
  // API route is protected by @superadmin_required server-side.
  function getTokenRole(jwt: string): string | null {
    try {
      const payload = JSON.parse(
        Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")
      );
      return typeof payload.role === "string" ? payload.role : null;
    } catch {
      return null;
    }
  }

  // "No session at all" = no usable access token AND no refresh cookie.
  // With a refresh cookie present the client-side refresh flow gets its chance.
  const hasNoSession = (!token || isTokenExpired(token)) && !hasRefreshCookie;

  if (hasNoSession && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (hasNoSession && pathname.startsWith("/website-builder")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ─── Super admin guard (auth + role) ───────────────
  if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) {
    const isSuperadmin =
      !!token && !isTokenExpired(token) && getTokenRole(token) === "superadmin";
    if (!isSuperadmin) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
