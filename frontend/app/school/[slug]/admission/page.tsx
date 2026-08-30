/** Public Admission Page — live application form + status checker */
import { AdmissionForm } from "./AdmissionForm";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
    next: { revalidate: 300, tags: [`school-${slug}`] },
  });
  if (!res.ok) return null;
  return (await res.json()).data;
}

export default async function AdmissionPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  const { school } = data;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
      >
        🎓 Admission
      </h1>
      <p className="text-gray-600 mb-8">
        Join {school.name} — apply for admission today.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mb-12">
        {[
          { step: "1", title: "Submit Inquiry", desc: "Fill in the form below" },
          { step: "2", title: "Document Review", desc: "We review your application" },
          { step: "3", title: "Interview & Enrollment", desc: "Complete the process" },
        ].map((item) => (
          <div key={item.step} className="border rounded-lg p-4 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {item.step}
            </div>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-sm text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Admission Inquiry Form */}
      <AdmissionForm slug={params.slug} />
    </div>
  );
}
