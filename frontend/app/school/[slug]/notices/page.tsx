import { displayBS } from "@/lib/nepali_date";
/** Public Notices Page — auto-synced from school management system */
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return (await res.json()).data;
}

export default async function NoticesPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  const { school, notices } = data;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1
        className="text-3xl font-bold mb-8"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
      >
        📢 Notices & Announcements
      </h1>

      {(!notices || notices.length === 0) ? (
        <p className="text-gray-500 text-center py-12">No notices published yet.</p>
      ) : (
        <div className="space-y-6">
          {notices.map((notice: { id: string; title: string; content: string; created_at: string }) => (
            <article
              key={notice.id}
              className="border rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-semibold" style={{ color: "var(--color-primary)" }}>
                  {notice.title}
                </h2>
                {notice.created_at && (
                  <time className="text-sm text-gray-400 whitespace-nowrap ml-4">
                    {displayBS(notice.created_at)}
                  </time>
                )}
              </div>
              <div
                className="text-gray-700 mt-3 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: notice.content || "" }}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
