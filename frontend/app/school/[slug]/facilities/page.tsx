/** Public Facilities Page — school infrastructure and amenities */
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, { next: { revalidate: 300, tags: [`school-${slug}`] } });
  if (!res.ok) return null;
  return (await res.json()).data;
}

async function getFacilities(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/website/public/${slug}/facilities`, { next: { revalidate: 300, tags: [`school-${slug}`] } });
    if (!res.ok) return [];
    return (await res.json()).data?.facilities || [];
  } catch { return []; }
}

interface Facility { id: number; name: string; description: string; icon?: string; image_url?: string; }

export default async function FacilitiesPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  const facilities = await getFacilities(params.slug);

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>
        🏫 Facilities
      </h1>
      <p className="text-gray-600 mb-8">Our campus is equipped with modern facilities to support holistic education.</p>

      {facilities.length > 0 ? (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {facilities.map((f: any, i: number) => (
          <div key={f.id || i} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            {f.image_url ? (
              <img src={f.image_url} alt={f.name} className="w-full h-40 object-cover" loading="lazy" />
            ) : (
              <div className="h-40 flex items-center justify-center text-5xl" style={{ backgroundColor: "var(--color-secondary)" }}>
                {f.icon || "🏫"}
              </div>
            )}
            <div className="p-4">
              <h3 className="font-semibold text-lg" style={{ color: "var(--color-primary)" }}>{f.name}</h3>
              <p className="text-gray-600 text-sm mt-2">{f.description}</p>
            </div>
          </div>
        ))}
      </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-gray-500">
          Facilities have not been published for this school yet.
        </div>
      )}
    </div>
  );
}
