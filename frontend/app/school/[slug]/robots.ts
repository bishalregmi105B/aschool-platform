import type { MetadataRoute } from "next";

// W-03: robots for the school-site segment — dashboard/admin paths excluded.
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://aschool.com.np";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/school/",
        disallow: ["/dashboard", "/school/*/api"],
      },
    ],
    sitemap: `${BASE}/school/sitemap.xml`,
  };
}
