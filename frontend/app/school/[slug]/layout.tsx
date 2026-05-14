/** Public school website layout — applies theme CSS variables */
import { Metadata } from "next";
import { generateThemeCSS, getThemeById, THEMES } from "@/themes/registry";
import { SchoolNavbar } from "@/components/website/SchoolNavbar";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || process.env.BASE_DOMAIN || "aschool.com.np";
const FONT_NAMES = Array.from(
  new Set(THEMES.flatMap((theme) => [theme.fonts.heading, theme.fonts.body])),
);
const FONT_QUERY = FONT_NAMES.map((font) => `family=${font.replace(/ /g, "+")}:wght@400;500;600;700`).join("&");

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
    next: { revalidate: 300 }, // ISR: 5 minutes
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getSchoolData(params.slug);
  if (!data) return { title: "School Not Found" };

  const school = data.school;
  const website = data.website;

  return {
    title: website?.meta_title || school.name,
    description: website?.meta_description || `${school.name} — ${school.district}, Nepal`,
    openGraph: {
      title: school.name,
      description: website?.meta_description || `${school.name} official website`,
      images: school.banner_url ? [school.banner_url] : [],
      type: "website",
    },
    other: {
      "application/ld+json": JSON.stringify({
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        name: school.name,
        alternateName: school.name_nepali,
        url: `https://${params.slug}.${BASE_DOMAIN}`,
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
    },
  };
}

export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const data = await getSchoolData(params.slug);

  if (!data) {
    return (
      <html lang="en">
        <body className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">School Not Found</h1>
            <p className="text-gray-600">The school website you&apos;re looking for doesn&apos;t exist.</p>
          </div>
        </body>
      </html>
    );
  }

  const school = data.school;
  const website = data.website;
  const themeSlug = website?.theme_slug || "modern-minimal";
  const activeTheme = getThemeById(themeSlug) || getThemeById("modern-minimal");
  const themeCss = activeTheme ? generateThemeCSS(activeTheme) : "";
  const customCss = website?.customizations?.custom_css || "";

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
    <html lang="en">
      <head>
        <link
          href={`https://fonts.googleapis.com/css2?${FONT_QUERY}&display=swap`}
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              ${themeCss}
              ${customCss}
              * { box-sizing: border-box; }
              html { scroll-behavior: smooth; }
            `,
          }}
        />
      </head>
      <body
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
      </body>
    </html>
  );
}
