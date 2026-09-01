/** Public Teachers Page — builder sections first, auto-synced staff as fallback. */
import { getBuilderPage, hasBuilderSections, BuilderPageSections } from "@/lib/builder-page";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

async function getSchoolData(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
      next: { revalidate: 300, tags: [`school-${slug}`] },
    });
    if (!res.ok) return null;
    return (await res.json()).data;
  } catch {
    return null;
  }
}

async function getTeachers(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/website/public/${slug}/teachers`, {
      next: { revalidate: 300, tags: [`school-${slug}`] },
    });
    if (!res.ok) return [];
    return (await res.json()).data?.teachers || [];
  } catch {
    return [];
  }
}

interface Teacher {
  id: number;
  name: string;
  designation: string;
  department: string;
  qualification: string;
  photo_url: string | null;
}

export default async function TeachersPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  // ── Builder-designed Teachers page → same rendering as builder preview ───
  const builder = await getBuilderPage(params.slug, "teachers");
  if (hasBuilderSections(builder)) {
    return <BuilderPageSections slug={params.slug} data={builder!} />;
  }

  const teachers: Teacher[] = await getTeachers(params.slug);

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
      >
        👩‍🏫 Our Teachers
      </h1>
      <p className="text-gray-600 mb-8">
        Meet the dedicated team behind our students&apos; success.
      </p>

      {teachers.length > 0 ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {teachers.map((t) => (
            <div key={t.id} className="border rounded-lg overflow-hidden text-center hover:shadow-md transition-shadow">
              <div
                className="h-40 flex items-center justify-center text-white text-5xl"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {t.photo_url ? (
                  <img
                    src={t.photo_url}
                    alt={t.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{t.name.charAt(0)}</span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{t.name}</h3>
                <p className="text-sm text-gray-500">{t.designation}</p>
                {t.department && (
                  <p className="text-xs text-gray-400 mt-1">{t.department}</p>
                )}
                {t.qualification && (
                  <p className="text-xs text-gray-400">{t.qualification}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">Teacher information will be updated soon.</p>
        </div>
      )}
    </div>
  );
}
