/**
 * Single source of truth for the school-site base domain.
 *
 * Production runs on brighternepal.com (NEXT_PUBLIC_BASE_DOMAIN in prod .env
 * baked at build time). No component should hardcode a domain; import
 * SCHOOL_SITE_DOMAIN / schoolSiteHost / schoolSiteUrl instead.
 */
export const SCHOOL_SITE_DOMAIN: string =
  process.env.NEXT_PUBLIC_BASE_DOMAIN || process.env.BASE_DOMAIN || "brighternepal.com";

/** Hostname for a school site, e.g. "bright-star-public-school.brighternepal.com". */
export function schoolSiteHost(slug?: string | null): string {
  return `${slug || "your-school"}.${SCHOOL_SITE_DOMAIN}`;
}

/** Full public URL for a school site, e.g. "https://bright-star-public-school.brighternepal.com". */
export function schoolSiteUrl(slug?: string | null, path = ""): string {
  const base = `https://${slug || "your-school"}.${SCHOOL_SITE_DOMAIN}`;
  if (!path) return base;
  return base + (path.startsWith("/") ? path : `/${path}`);
}
