/** Public Academics Page — curriculum overview */
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return (await res.json()).data;
}

export default async function AcademicsPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  const { school } = data;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1
        className="text-3xl font-bold mb-8"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
      >
        📚 Academics
      </h1>

      <section className="space-y-8">
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--color-primary)" }}>
            Curriculum
          </h2>
          <p className="text-gray-700">
            {school.name} follows the curriculum prescribed by the Curriculum Development Centre (CDC),
            Government of Nepal. Our academic programs are designed to nurture critical thinking,
            creativity, and holistic development.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3" style={{ color: "var(--color-primary)" }}>
              🏫 School Level
            </h3>
            <p className="text-gray-600 text-sm">Type: {school.type}</p>
            <p className="text-gray-600 text-sm">Level: {school.level}</p>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3" style={{ color: "var(--color-primary)" }}>
              📅 Academic Calendar
            </h3>
            <p className="text-gray-600 text-sm">
              Academic year follows the Bikram Sambat (BS) calendar.
              Classes run Sunday through Friday.
            </p>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3" style={{ color: "var(--color-primary)" }}>
              📝 Examination System
            </h3>
            <p className="text-gray-600 text-sm">
              Regular terminal exams, unit tests, and continuous assessment.
              Grade-based evaluation system as per NEB guidelines.
            </p>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3" style={{ color: "var(--color-primary)" }}>
              🌟 Co-curricular Activities
            </h3>
            <p className="text-gray-600 text-sm">
              Sports, arts, debate, science fairs, cultural programs, and
              community service activities throughout the year.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
