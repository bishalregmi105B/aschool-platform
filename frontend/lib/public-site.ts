/**
 * Server-side loader for public school websites (SSR + ISR).
 *
 * The backend guard (`_public_site_guard`) returns 404 for two distinct
 * cases, and the JSON body tells them apart:
 *   - {"error": "School not found"}        → slug unknown / inactive school
 *   - {"error": "Website not published"}   → school exists but its site is
 *     offline (website-builder "Unpublish"); the body's `data.school_name`
 *     carries the school name so the UI can render an honest coming-soon state.
 *
 * Server-only: uses the Docker-internal API_URL. Never import from a
 * "use client" module.
 */

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

// The success payload intentionally stays loosely typed (Record<string, any>)
// to mirror the previous untyped `json.data` usage in the layout/pages — the
// renderer consumes dozens of optional school fields.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type PublicSiteData = Record<string, any>;

export type PublicSiteResult =
  | { ok: true; data: PublicSiteData }
  | { ok: false; reason: "unpublished"; schoolName?: string }
  | { ok: false; reason: "not_found" };

export async function getPublicSite(
  slug: string,
  opts?: { noStore?: boolean },
): Promise<PublicSiteResult> {
  try {
    const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
      // E201: opts.noStore bypasses the ISR data cache — used as a one-shot
      // fallback when the guard says "published" but the cached entry still
      // holds a pre-publish 404 (cache pollution from an unpublish window).
      ...(opts?.noStore
        ? { cache: "no-store" as const }
        : { next: { revalidate: 300, tags: [`school-${slug}`] } }),
    });
    const json = (await res.json().catch(() => null)) as {
      data?: PublicSiteData & { school_name?: string };
      error?: string;
    } | null;
    if (res.ok && json?.data) return { ok: true, data: json.data };

    if (typeof json?.error === "string" && json.error.toLowerCase().includes("not published")) {
      return {
        ok: false,
        reason: "unpublished",
        schoolName:
          typeof json?.data?.school_name === "string" ? json.data.school_name : undefined,
      };
    }
    return { ok: false, reason: "not_found" };
  } catch {
    return { ok: false, reason: "not_found" };
  }
}

/**
 * E201: publish-status GUARD checked at REQUEST time (no cache).
 *
 * The ISR-cached `getPublicSite` can serve a publish flip up to 5 minutes
 * stale (and builder UI revalidation only fires from the dashboard, not for
 * API-only callers), so an UNPUBLISHED site kept rendering fully for
 * minutes. This guard hits the same public endpoint with `cache: "no-store"`
 * and is ONLY used to decide coming-soon vs real site — the heavy content of
 * PUBLISHED sites stays on the ISR fetch. Next dedupes identical no-store
 * fetches across layout/page/metadata within a single render pass, so this
 * adds exactly one uncacheable request per public page view.
 */
export type PublicSiteStatus =
  | { published: true }
  | { published: false; exists: true; schoolName?: string }
  | { published: false; exists: false };

export async function getPublicSiteStatus(slug: string): Promise<PublicSiteStatus> {
  try {
    const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
      cache: "no-store",
    });
    if (res.ok) return { published: true };
    const json = (await res.json().catch(() => null)) as {
      data?: { school_name?: string };
      error?: string;
    } | null;
    if (typeof json?.error === "string" && json.error.toLowerCase().includes("not published")) {
      return {
        published: false,
        exists: true,
        schoolName:
          typeof json?.data?.school_name === "string" ? json.data.school_name : undefined,
      };
    }
    return { published: false, exists: false };
  } catch {
    // Backend unreachable: fail closed — do NOT serve a cached "published"
    // site we cannot verify, but also don't claim the school doesn't exist.
    return { published: false, exists: true };
  }
}
