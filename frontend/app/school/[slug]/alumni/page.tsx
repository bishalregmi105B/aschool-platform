/** Public Alumni Page — alumni network showcase */
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, { next: { revalidate: 300, tags: [`school-${slug}`] } });
  if (!res.ok) return null;
  return (await res.json()).data;
}

async function getAlumni(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/website/public/${slug}/alumni`, { next: { revalidate: 300, tags: [`school-${slug}`] } });
    if (!res.ok) return [];
    return (await res.json()).data?.alumni || [];
  } catch { return []; }
}

interface Alumni { id: number; name: string; batch_year: number; current_occupation: string; organization: string; photo_url: string; testimonial: string; }

export default async function AlumniPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  const alumni: Alumni[] = await getAlumni(params.slug);

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>
        🎓 Alumni Network
      </h1>
      <p className="text-gray-600 mb-8">Our proud alumni who continue to make a difference.</p>

      {alumni.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">🎓</div>
          <p className="text-gray-500 text-lg">Alumni profiles will be added soon.</p>
          <p className="text-gray-400 text-sm mt-2">Are you an alumnus? Contact us to be featured.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {alumni.map(a => (
            <div key={a.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow text-center">
              <div className="h-40 flex items-center justify-center text-5xl" style={{ backgroundColor: "var(--color-secondary)" }}>
                {a.photo_url ? (
                  <img src={a.photo_url} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{a.name?.charAt(0) || "A"}</span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold" style={{ color: "var(--color-primary)" }}>{a.name}</h3>
                <p className="text-sm text-gray-500">Batch {a.batch_year}</p>
                {a.current_occupation && <p className="text-sm text-gray-600 mt-1">{a.current_occupation}{a.organization ? ` at ${a.organization}` : ""}</p>}
                {a.testimonial && <p className="text-xs text-gray-500 mt-3 italic">&quot;{a.testimonial}&quot;</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
