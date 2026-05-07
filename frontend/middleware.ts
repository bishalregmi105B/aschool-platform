import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/_next", "/favicon.ico", "/api"];

/**
 * Main domains — requests on these go through normal dashboard routing.
 * Anything else is treated as a school subdomain.
 */
const MAIN_HOSTS = [
  "aschool.com.np",
  "www.aschool.com.np",
  "app.aschool.com.np",
  "localhost:3000",
  "localhost:3001",
  "localhost",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // ─── Subdomain routing ───────────────────────────────
  // If the request is on a subdomain (e.g. greenvalley.aschool.com.np),
  // rewrite to /school/[slug]/... internally.
  const isMainHost = MAIN_HOSTS.some(
    (h) => hostname === h || hostname.endsWith(`.${h}`)
  );

  if (!isMainHost && !pathname.startsWith("/school/") && !pathname.startsWith("/_next") && !pathname.startsWith("/api")) {
    // Extract slug from subdomain: "greenvalley.aschool.com.np" → "greenvalley"
    const slug = hostname.split(".")[0];

    if (slug && slug !== "www") {
      const url = request.nextUrl.clone();
      url.pathname = `/school/${slug}${pathname}`;
      return NextResponse.rewrite(url);
    }
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

  if (!token && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!token && pathname.startsWith("/website-builder")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
