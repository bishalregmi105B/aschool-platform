/** Public school website layout — applies theme CSS variables */
import { Metadata } from "next";
import { sanitizeCss, sanitizeColorOverrides } from "@/lib/sanitize";
import { getPublicSite, getPublicSiteStatus } from "@/lib/public-site";
import { SCHOOL_SITE_DOMAIN } from "@/lib/site-domain";
import { generateThemeCSS, getThemeById, THEMES, DEFAULT_THEME_ID } from "@/themes/registry";
import { SchoolNavbar } from "@/components/website/SchoolNavbar";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || process.env.BASE_DOMAIN || SCHOOL_SITE_DOMAIN;
const BASE = process.env.NEXT_PUBLIC_SITE_URL || `https://${BASE_DOMAIN}`;
const FONT_NAMES = Array.from(
  new Set(THEMES.flatMap((theme) => [theme.fonts.heading, theme.fonts.body])),
);
const FONT_QUERY = FONT_NAMES.map((font) => `family=${font.replace(/ /g, "+")}:wght@400;500;600;700`).join("&");

async function getSchoolData(slug: string) {
  const site = await getPublicSite(slug);
  return site.ok ? site.data : null;
}

/** Honest titles for the two 404 cases (unpublished site vs unknown school). */
async function unavailableSiteMetadata(slug: string): Promise<Metadata> {
  // E201: decide on the no-store guard, not the ISR-cached payload — a
  // just-unpublished site must show coming-soon metadata immediately.
  const status = await getPublicSiteStatus(slug);
  if (status.published) return {};
  if (status.exists) {
    return {
      title: status.schoolName ? `${status.schoolName} — Website Coming Soon` : "Website Coming Soon",
      description: "This school's website has not been published yet. Please check back soon.",
    };
  }
  return { title: "School Not Found" };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  // E201: the no-store guard decides FIRST — a just-unpublished site must
  // not keep advertising the full site's metadata from the ISR cache.
  const status = await getPublicSiteStatus(params.slug);
  if (!status.published) return unavailableSiteMetadata(params.slug);

  const data = await getSchoolData(params.slug);
  if (!data) return { title: "School Not Found" };

  const school = data.school;
  const website = data.website;

  const canonical = `${BASE}/school/${params.slug}`;
  const ogImage = website?.og_image_url || school.banner_url;
  return {
    title: website?.meta_title || school.name,
    description: website?.meta_description || `${school.name} — ${school.district}, Nepal`,
    // W-03: canonical — four URL variants previously competed with each other
    alternates: { canonical },
    openGraph: {
      title: school.name,
      description: website?.meta_description || `${school.name} official website`,
      images: ogImage ? [ogImage] : [],
      url: canonical,
      type: "website",
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: school.name,
      description: website?.meta_description || undefined,
      images: ogImage ? [ogImage] : undefined,
    },
    // W-03: GA / FB pixel ids surface as env-consumable globals; the scripts
    // render in the body below (Next metadata `other` cannot inject scripts).
  };
}

export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  // E201: publish-status GUARD at request time (no-store). The ISR-cached
  // data fetch can be up to 5 minutes stale and builder-UI revalidation only
  // fires from the dashboard — an API-driven unpublish used to keep serving
  // the full site for minutes. The guard is the source of truth for whether
  // ANY page under /school/<slug> renders; published sites keep ISR for the
  // heavy content below.
  const status = await getPublicSiteStatus(params.slug);

  if (!status.published) {
    // Nested layouts must NOT render <html>/<body> — only the root layout
    // owns them (app/layout.tsx). Rendering them here put <html> inside the
    // root <body> (React: "In HTML, <html> cannot be a child of <body>") and
    // crashed SSR with "Element type is invalid: got: undefined".
    if (status.exists) {
      // The school exists but its website is offline (builder "Unpublish").
      // Render an honest coming-soon state instead of pretending bad URL.
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4">🚧</div>
            <h1 className="text-3xl font-bold mb-3">
              {status.schoolName ? `${status.schoolName} — Website Coming Soon` : "Website Coming Soon"}
            </h1>
            <p className="text-gray-600 mb-2">
              {status.schoolName
                ? `${status.schoolName}'s website hasn't been published yet. Please check back soon.`
                : "This school's website hasn't been published yet. Please check back soon."}
            </p>
            <p className="text-gray-400 text-xs">Website not published</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">School Not Found</h1>
          <p className="text-gray-600">The school website you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  // Guard says published — fetch the heavy content via ISR. If the data cache
  // still holds a pre-publish 404 (pollution from an unpublish window), retry
  // once without the cache so the site returns immediately.
  let site = await getPublicSite(params.slug);
  if (!site.ok) site = await getPublicSite(params.slug, { noStore: true });

  if (!site.ok) {
    // Should not happen (guard + backend disagree) — fail honest.
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">School Not Found</h1>
          <p className="text-gray-600">The school website you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  const data = site.data;
  const school = data.school;
  const website = data.website;
  const themeSlug = website?.theme_slug || DEFAULT_THEME_ID;
  const activeTheme = getThemeById(themeSlug) || getThemeById(DEFAULT_THEME_ID);

  // Apply stored customization colors as overrides on top of the base theme.
  // Values are hex/color-word validated before reaching the <style> block
  // (S-11 defense in depth; the API enforces the same allowlist on write).
  const colorOverrides = sanitizeColorOverrides(
    (website?.customizations?.colors as Record<string, string>) || {}
  );
  const themeCss = activeTheme ? generateThemeCSS(activeTheme, colorOverrides) : "";

  // Surface color override (not in ThemeColors but used by SectionRenderer)
  const surfaceOverride = colorOverrides.surface
    ? `:root { --color-surface: ${colorOverrides.surface}; }`
    : "";
  const customCss = sanitizeCss(website?.customizations?.custom_css || "");

  const navLinks = [
    { label: "Home", path: "" },
    { label: "About", path: "/about" },
    { label: "Academics", path: "/academics" },
    { label: "Teachers", path: "/teachers" },
    { label: "Notices", path: "/notices" },
    { label: "Gallery", path: "/gallery" },
    { label: "Results", path: "/results" },
    { label: "Contact", path: "/contact" },
  ];

  return (
    <>
      {/* Theme fonts + CSS variables. Rendered as a nested <style> — the root
          layout owns <html>/<head>/<body> (E51: nested html/body crashed SSR). */}
      <link
        href={`https://fonts.googleapis.com/css2?${FONT_QUERY}&display=swap`}
        rel="stylesheet"
      />
      {/* W-03: JSON-LD as a REAL script tag (the metadata-`other` approach
          emits a meta tag Google cannot parse as structured data). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            name: school.name,
            alternateName: school.name_nepali,
            url: `${BASE}/school/${params.slug}`,
            logo: school.logo_url,
            address: {
              "@type": "PostalAddress",
              addressLocality: school.municipality,
              addressRegion: school.district,
              addressCountry: "NP",
            },
            telephone: school.phone,
            email: school.email,
            foundingDate: school.established_year_bs,
          }),
        }}
      />
      {/* W-03: stored-but-never-rendered analytics ids */}
      {website?.google_analytics_id && (
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${website.google_analytics_id}`}
        />
      )}
      {website?.google_analytics_id && (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${website.google_analytics_id}');`,
          }}
        />
      )}
      {website?.facebook_pixel_id && (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${website.facebook_pixel_id}');fbq('track','PageView');`,
          }}
        />
      )}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            ${themeCss}
            ${surfaceOverride}
            ${customCss}
            * { box-sizing: border-box; }
            html { scroll-behavior: smooth; }
          `,
        }}
      />
      <div
        className="min-h-screen flex flex-col"
        style={{ fontFamily: "var(--font-body)", backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
        data-theme={themeSlug}
      >
        <SchoolNavbar
          slug={params.slug}
          schoolName={school.name}
          schoolNameNepali={school.name_nepali}
          logo={school.logo_url}
          phone={school.phone}
          email={school.email}
          address={school.address || `${school.municipality}, ${school.district}`}
          primaryColor="var(--color-primary)"
          accentColor="var(--color-accent)"
          livePages={(data.pages as Array<{ slug: string; title: string; page_type?: string }>) || []}
        />

        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer style={{ backgroundColor: "var(--color-primary)" }} className="text-white">
          <div className="max-w-7xl mx-auto px-4 pt-12 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* School Info */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                {school.logo_url ? (
                  <img src={school.logo_url} alt={school.name} className="h-12 w-12 rounded-full object-cover border-2 border-white/30" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-xl">
                    {school.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-base leading-tight">{school.name}</h3>
                  {school.name_nepali && <p className="text-xs opacity-70">{school.name_nepali}</p>}
                </div>
              </div>
              <p className="text-sm opacity-70 leading-relaxed">
                {school.municipality}, {school.district}, Nepal
              </p>
              {school.established_year_bs && (
                <p className="text-xs opacity-60 mt-1">Est. {school.established_year_bs} BS</p>
              )}
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-bold text-base mb-4 pb-2 border-b border-white/20">Quick Links</h3>
              <ul className="space-y-2 text-sm opacity-80">
                {navLinks.map((link) => (
                  <li key={link.path}>
                    <a href={`/school/${params.slug}${link.path}`} className="hover:opacity-100 hover:underline">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Programs */}
            <div>
              <h3 className="font-bold text-base mb-4 pb-2 border-b border-white/20">Programs</h3>
              <ul className="space-y-2 text-sm opacity-80">
                <li><a href={`/school/${params.slug}/academics`} className="hover:underline">Academics</a></li>
                <li><a href={`/school/${params.slug}/results`} className="hover:underline">Results</a></li>
                <li><a href={`/school/${params.slug}/admission`} className="hover:underline">Admission</a></li>
                <li><a href={`/school/${params.slug}/notices`} className="hover:underline">Notice Board</a></li>
                <li><a href={`/school/${params.slug}/events`} className="hover:underline">Events</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="font-bold text-base mb-4 pb-2 border-b border-white/20">Contact Us</h3>
              <ul className="space-y-3 text-sm opacity-80">
                <li className="flex gap-2 items-start">
                  <span className="mt-0.5 flex-shrink-0">📍</span>
                  <span>{school.municipality}, {school.district}, Nepal</span>
                </li>
                {school.phone && (
                  <li>
                    <a href={`tel:${school.phone}`} className="flex gap-2 hover:opacity-100">
                      <span>📞</span><span>{school.phone}</span>
                    </a>
                  </li>
                )}
                {school.email && (
                  <li>
                    <a href={`mailto:${school.email}`} className="flex gap-2 hover:opacity-100 break-all">
                      <span className="flex-shrink-0">✉️</span><span>{school.email}</span>
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/20 text-center py-4 text-xs opacity-50">
            © {new Date().getFullYear()} {school.name}. Powered by{" "}
            <a href="/" className="underline hover:opacity-100">ASchool</a>
          </div>
        </footer>
      </div>
    </>
  );
}
