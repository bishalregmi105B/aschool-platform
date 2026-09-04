import type { MetadataRoute } from "next";

// W-03: per-school sitemap — was a dead Celery task that wrote nothing.
// Next.js generates /school/<slug>/sitemap.xml at request time.

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://aschool.com.np";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The school site segment is a single dynamic root; the crawler follows
  // internal nav links from here. Static section routes are enumerated
  // because they exist for every school.
  const base = `${BASE}/school`;
  const now = new Date();
  const sections = [
    "", "/about", "/academics", "/teachers", "/notices",
    "/gallery", "/results", "/contact",
  ];
  return sections.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/notices" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
