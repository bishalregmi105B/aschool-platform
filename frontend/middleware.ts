import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/_next", "/favicon.ico", "/api"];

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

/**
 * Main domains — requests on these go through normal dashboard routing.
 * Anything else is treated as a school subdomain.
 */
const MAIN_HOSTS = new Set([
  "aschool.com.np",
  "www.aschool.com.np",
  "app.aschool.com.np",
  "localhost:3000",
  "localhost:3001",
  "localhost",
]);

const SCHOOL_BASE_DOMAINS = ["aschool.com.np"];

function normalizeHost(host: string) {
  return host.split(":")[0].toLowerCase();
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
  // If the request is on a subdomain (e.g. greenvalley.aschool.com.np),
  // rewrite to /school/[slug]/... internally.
  const isMainHost = MAIN_HOSTS.has(rawHost) || MAIN_HOSTS.has(hostname);
  const baseDomain = SCHOOL_BASE_DOMAINS.find((domain) => hostname.endsWith(`.${domain}`));

  if (!isMainHost && !pathname.startsWith("/school/") && !pathname.startsWith("/_next") && !pathname.startsWith("/api")) {
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
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ─── Public school pages (direct path access) ──────
  if (pathname.startsWith("/school/")) {
    return NextResponse.next();
  }

  // ─── Dashboard auth guard ──────────────────────────
  const token = request.cookies.get("access_token")?.value;

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

  if ((!token || isTokenExpired(token)) && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if ((!token || isTokenExpired(token)) && pathname.startsWith("/website-builder")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
