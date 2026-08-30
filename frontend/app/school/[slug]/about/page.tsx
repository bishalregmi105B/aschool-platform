/** Public About Page — School information, mission, vision */
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
    next: { revalidate: 300, tags: [`school-${slug}`] },
  });
  if (!res.ok) return null;
  return (await res.json()).data;
}

export default async function AboutPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  const { school } = data;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1
        className="text-3xl font-bold mb-8"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
      >
        About {school.name}
      </h1>

      <div className="prose prose-lg max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold" style={{ color: "var(--color-primary)" }}>
            🏫 Our School
          </h2>
          <p className="text-gray-700">
            {school.name} ({school.name_nepali}) is a {school.type} school located in{" "}
            {school.municipality}, {school.district}. Established in {school.established_year_bs || "N/A"} BS,
            we have been providing quality education to students across the region.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-6" style={{ borderColor: "var(--color-primary)" }}>
            <h3 className="font-bold text-lg mb-2" style={{ color: "var(--color-primary)" }}>
              📋 Quick Facts
            </h3>
            <ul className="space-y-2 text-sm">
              <li><strong>Type:</strong> {school.type}</li>
              <li><strong>Level:</strong> {school.level}</li>
              <li><strong>Established:</strong> {school.established_year_bs} BS</li>
              <li><strong>Total Students:</strong> {school.total_students || "N/A"}</li>
              <li><strong>Total Staff:</strong> {school.total_staff || "N/A"}</li>
              <li><strong>Location:</strong> {school.municipality}, {school.district}</li>
            </ul>
          </div>

          <div className="border rounded-lg p-6" style={{ borderColor: "var(--color-accent)" }}>
            <h3 className="font-bold text-lg mb-2" style={{ color: "var(--color-primary)" }}>
              📞 Contact Information
            </h3>
            <ul className="space-y-2 text-sm">
              {school.phone && <li><strong>Phone:</strong> {school.phone}</li>}
              {school.email && <li><strong>Email:</strong> {school.email}</li>}
              <li><strong>Address:</strong> {school.municipality}, {school.district}</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold" style={{ color: "var(--color-primary)" }}>
            🎯 Our Mission
          </h2>
          <p className="text-gray-700">
            To provide accessible, quality education that empowers students to become responsible
            citizens and contribute to the development of Nepal and the world.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold" style={{ color: "var(--color-primary)" }}>
            🌟 Our Vision
          </h2>
          <p className="text-gray-700">
            To be a leading educational institution recognized for academic excellence,
            holistic development, and community engagement.
          </p>
        </section>
      </div>
    </div>
  );
}
