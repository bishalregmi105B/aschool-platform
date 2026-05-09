/** Public school website layout — applies theme CSS variables */
import { Metadata } from "next";
import { generateThemeCSS, getThemeById, THEMES } from "@/themes/registry";

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

  return (
    <html lang="en">
      <head>
        <link
          href={`https://fonts.googleapis.com/css2?${FONT_QUERY}&display=swap`}
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `${themeCss}\n${customCss}`,
          }}
        />
      </head>
      <body
        className="min-h-screen"
        style={{ fontFamily: "var(--font-body)", backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
        data-theme={themeSlug}
      >
        {/* School Header */}
        <header
          className="border-b"
          style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {school.logo_url && (
                <img src={school.logo_url} alt={school.name} className="h-12 w-12 rounded-full object-cover" />
              )}
              <div className="text-white">
                <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                  {school.name}
                </h1>
                {school.name_nepali && <p className="text-sm opacity-80">{school.name_nepali}</p>}
              </div>
            </div>
            <nav className="hidden md:flex gap-6 text-white text-sm">
              <a href={`/school/${params.slug}`} className="hover:opacity-80">Home</a>
              <a href={`/school/${params.slug}/about`} className="hover:opacity-80">About</a>
              <a href={`/school/${params.slug}/academics`} className="hover:opacity-80">Academics</a>
              <a href={`/school/${params.slug}/teachers`} className="hover:opacity-80">Teachers</a>
              <a href={`/school/${params.slug}/notices`} className="hover:opacity-80">Notices</a>
              <a href={`/school/${params.slug}/gallery`} className="hover:opacity-80">Gallery</a>
              <a href={`/school/${params.slug}/results`} className="hover:opacity-80">Results</a>
              <a href={`/school/${params.slug}/contact`} className="hover:opacity-80">Contact</a>
              <a href={`/school/${params.slug}/admission`} className="hover:opacity-80 font-semibold">Admission</a>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        {/* Footer */}
        <footer style={{ backgroundColor: "var(--color-primary)" }} className="text-white mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-2">{school.name}</h3>
              <p className="text-sm opacity-80">
                {school.municipality}, {school.district}
              </p>
              {school.phone && <p className="text-sm opacity-80 mt-1">📞 {school.phone}</p>}
              {school.email && <p className="text-sm opacity-80">📧 {school.email}</p>}
            </div>
            <div>
              <h3 className="font-bold mb-2">Quick Links</h3>
              <ul className="text-sm opacity-80 space-y-1">
                <li><a href={`/school/${params.slug}/about`}>About Us</a></li>
                <li><a href={`/school/${params.slug}/academics`}>Academics</a></li>
                <li><a href={`/school/${params.slug}/admission`}>Admission</a></li>
                <li><a href={`/school/${params.slug}/contact`}>Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2">Information</h3>
              <p className="text-sm opacity-80">
                Est. {school.established_year_bs || "N/A"} BS
              </p>
              <p className="text-sm opacity-80">Type: {school.type}</p>
              <p className="text-sm opacity-80">Level: {school.level}</p>
            </div>
          </div>
          <div className="border-t border-white/20 text-center py-4 text-sm opacity-60">
            © {new Date().getFullYear()} {school.name}. Powered by ASchool
          </div>
        </footer>
      </body>
    </html>
  );
}
