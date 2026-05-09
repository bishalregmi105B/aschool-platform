/** Public School Homepage — SSR with ISR (revalidate every 5 minutes) */
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

export default async function SchoolHomePage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  const { school, notices } = data;

  return (
    <div>
      {/* Hero Section */}
      <section
        className="relative py-20 px-4 text-center text-white"
        style={{
          background: school.banner_url
            ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${school.banner_url}) center/cover`
            : "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
        }}
      >
        <div className="max-w-3xl mx-auto">
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {school.name}
          </h1>
          {school.name_nepali && (
            <p className="text-xl opacity-90 mb-6">{school.name_nepali}</p>
          )}
          <p className="text-lg opacity-80 mb-8">
            {school.municipality}, {school.district} • Est. {school.established_year_bs || "N/A"} BS
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href={`/school/${params.slug}/admission`}
              className="px-6 py-3 rounded-lg font-semibold text-white"
              style={{ backgroundColor: "var(--color-accent)" }}
            >
              Apply for Admission
            </a>
            <a
              href={`/school/${params.slug}/about`}
              className="px-6 py-3 rounded-lg font-semibold border border-white/60 hover:bg-white/10"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section
        className="py-6 border-b"
        style={{ backgroundColor: "var(--color-secondary)", color: "var(--color-primary)" }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold">{school.total_students || "500+"}</p>
            <p className="text-sm opacity-70">Students</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{school.total_staff || "50+"}</p>
            <p className="text-sm opacity-70">Staff</p>
          </div>
          <div>
            <p className="text-3xl font-bold">A+</p>
            <p className="text-sm opacity-70">Grade Ranking</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{school.established_year_bs || "2050"}</p>
            <p className="text-sm opacity-70">Established (BS)</p>
          </div>
        </div>
      </section>

      {/* Latest Notices */}
      {notices && notices.length > 0 && (
        <section className="max-w-5xl mx-auto py-12 px-4">
          <h2
            className="text-2xl font-bold mb-6"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
          >
            📢 Latest Notices
          </h2>
          <div className="grid gap-4">
            {notices.slice(0, 5).map((notice: { id: string; title: string; content: string; created_at: string }) => (
              <div
                key={notice.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-lg">{notice.title}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {notice.content?.replace(/<[^>]*>/g, "").slice(0, 200)}
                </p>
                {notice.created_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(notice.created_at).toLocaleDateString("en-NP", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section
        className="py-16 px-4 text-center text-white"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-3xl font-bold mb-4"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Join Our School Community
          </h2>
          <p className="opacity-80 mb-8">
            Admission is open for the upcoming academic year. Apply now to secure your spot.
          </p>
          <a
            href={`/school/${params.slug}/admission`}
            className="inline-block px-8 py-3 rounded-lg font-semibold text-lg"
            style={{ backgroundColor: "var(--color-accent)", color: "var(--color-text)" }}
          >
            Start Application
          </a>
        </div>
      </section>
    </div>
  );
}
