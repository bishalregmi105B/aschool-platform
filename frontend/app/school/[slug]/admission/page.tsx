/** Public Admission Page — builder sections first, apply-online + tracker fallback. */
import { AdmissionForm } from "./AdmissionForm";
import { ApplyOnlineForm, TrackApplication } from "./ApplyForm";
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

export default async function AdmissionPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  // ── Builder-designed Admission page → same rendering as builder preview ──
  const builder = await getBuilderPage(params.slug, "admission");
  if (hasBuilderSections(builder)) {
    return <BuilderPageSections slug={params.slug} data={builder!} />;
  }

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
        Join {school.name} — apply online and track your application.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mb-12">
        {[
          { step: "1", title: "Apply Online", desc: "Fill the application form below" },
          { step: "2", title: "Review", desc: "The office reviews your application" },
          { step: "3", title: "Enrollment", desc: "Approved applicants are enrolled" },
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

      {/* S-A5: full online application (custom fields aware) + status tracker */}
      <div className="space-y-8">
        <ApplyOnlineForm slug={params.slug} />
        <TrackApplication slug={params.slug} />

        {/* Legacy quick inquiry — still lands in the admission CRM inbox */}
        <details className="border rounded-lg">
          <summary
            className="cursor-pointer px-6 py-4 text-sm font-medium"
            style={{ color: "var(--color-primary)" }}
          >
            Just have a question? Send a quick inquiry instead
          </summary>
          <div className="px-6 pb-6">
            <AdmissionForm slug={params.slug} />
          </div>
        </details>
      </div>
    </div>
  );
}
