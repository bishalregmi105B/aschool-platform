/**
 * Custom page catch-all — renders ANY website-builder page that has no
 * dedicated static route (about/teachers/gallery/... live in sibling dirs and
 * take precedence in the App Router; this page handles everything else).
 *
 * Backed by GET /website/public/<slug>/pages/<pageSlug> which resolves any
 * stored builder page dynamically with the same publish guard as the homepage.
 */
import { notFound } from "next/navigation";
import { SectionRenderer } from "@/components/website/SectionRenderer";
import { sanitizeHtml } from "@/lib/sanitize";
import type { LiveData } from "@/components/website/SectionRenderer";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

type PagePayload = {
  page?: { title?: string; slug?: string };
  school?: Record<string, unknown>;
  sections?: Array<{ id: string; type: string; title?: string; content?: Record<string, unknown>; sort_order?: number }>;
  notices?: Array<{ id: string; title: string; content?: string; created_at: string }>;
  teachers?: Array<{ id: string; name: string; subject?: string; photo?: string; designation?: string }>;
  gallery?: Array<{ id: string; url: string; caption?: string }>;
};

async function getPublicPage(slug: string, pageSlug: string): Promise<PagePayload | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/website/public/${slug}/pages/${encodeURIComponent(pageSlug)}`,
      { next: { revalidate: 300, tags: [`school-${slug}`] } },
    );
    const json = (await res.json().catch(() => null)) as { data?: PagePayload } | null;
    if (res.ok && json?.data) return json.data;
    return null;
  } catch {
    return null;
  }
}

export default async function CustomSchoolPage({
  params,
}: {
  params: { slug: string; pageSlug: string };
}) {
  const data = await getPublicPage(params.slug, params.pageSlug);
  if (!data) notFound();

  const school = (data.school || {}) as LiveData["school"] & Record<string, unknown>;
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const notices = Array.isArray(data.notices) ? data.notices : [];

  const liveData: LiveData = {
    school: {
      ...school,
      slug: params.slug,
      // Sanitize rich-text SERVER-SIDE — the renderer is a client component
      // without DOMPurify (same rule as the homepage).
      about_us: sanitizeHtml((school.about_us as string) || ""),
    } as LiveData["school"],
    notices,
    teachers: Array.isArray(data.teachers) ? data.teachers : undefined,
    gallery: Array.isArray(data.gallery) ? data.gallery : undefined,
  };

  const sorted = [...sections].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  if (sorted.length === 0) {
    return (
      <div className="min-h-[50vh] max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "var(--color-primary)" }}>
          {data.page?.title || params.pageSlug.replace(/-/g, " ")}
        </h1>
        <p className="text-gray-500 text-sm">This page is being prepared. Please check back soon.</p>
      </div>
    );
  }

  return (
    <div>
      {sorted.map((section) => (
        <SectionRenderer
          key={section.id}
          section={{ ...section, content: section.content ?? {} } as Parameters<typeof SectionRenderer>[0]["section"]}
          liveData={liveData}
        />
      ))}
    </div>
  );
}
