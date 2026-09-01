/**
 * Server-side bridge between the website builder and the dedicated static
 * routes (about/, teachers/, gallery/, …).
 *
 * The App Router gives static route folders precedence over the [pageSlug]
 * catch-all, so a page designed in the builder (e.g. About Us with a Hero
 * banner) rendered the old classic layout on the live URL while the builder
 * preview showed the new design. These helpers let every static page render
 * its builder sections when the school designed that page, and keep the
 * classic hardcoded layout as the fallback.
 *
 * Server-only: uses the Docker-internal API_URL. Do not import from client
 * components.
 */
import { SectionRenderer } from "@/components/website/SectionRenderer";
import { sanitizeHtml } from "@/lib/sanitize";
import type { LiveData } from "@/components/website/SectionRenderer";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

export interface BuilderPagePayload {
  page?: { title?: string; slug?: string };
  school?: Record<string, unknown>;
  sections?: Array<{
    id: string;
    type: string;
    title?: string;
    content?: Record<string, unknown>;
    sort_order?: number;
  }>;
  notices?: LiveData["notices"];
  teachers?: LiveData["teachers"];
  gallery?: LiveData["gallery"];
}

/** Fetch a stored builder page (sections + live data) by slug. null if absent. */
export async function getBuilderPage(
  slug: string,
  pageSlug: string,
): Promise<BuilderPagePayload | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/website/public/${slug}/pages/${encodeURIComponent(pageSlug)}`,
      { next: { revalidate: 300, tags: [`school-${slug}`] } },
    );
    const json = (await res.json().catch(() => null)) as { data?: BuilderPagePayload } | null;
    if (res.ok && json?.data) return json.data;
    return null;
  } catch {
    return null;
  }
}

/** True when the builder page has renderable sections. */
export function hasBuilderSections(data: BuilderPagePayload | null): boolean {
  return !!data && Array.isArray(data.sections) && data.sections.length > 0;
}

/** Render a (already fetched) builder page's sections, sorted by sort_order. */
export function BuilderPageSections({
  slug,
  data,
}: {
  slug: string;
  data: BuilderPagePayload;
}) {
  const school = (data.school || {}) as LiveData["school"] & Record<string, unknown>;
  const liveData: LiveData = {
    school: {
      ...school,
      slug,
      // Sanitize rich-text SERVER-SIDE — the renderer is a client component
      // without DOMPurify (same rule as the homepage).
      about_us: sanitizeHtml((school.about_us as string) || ""),
    } as LiveData["school"],
    notices: data.notices || [],
    teachers: data.teachers,
    gallery: data.gallery,
  };

  const sorted = [...(data.sections || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
  );

  return (
    <div>
      {sorted.map((section) => (
        <SectionRenderer
          key={section.id}
          section={
            { ...section, content: section.content ?? {} } as Parameters<
              typeof SectionRenderer
            >[0]["section"]
          }
          liveData={liveData}
        />
      ))}
    </div>
  );
}
