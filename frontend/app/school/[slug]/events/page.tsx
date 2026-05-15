import { displayBS } from "@/lib/nepali_date";
/** Public Events Page — auto-synced from school management system */
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return (await res.json()).data;
}

async function getEvents(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/website/public/${slug}/events`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return (await res.json()).data?.events || [];
  } catch { return []; }
}

interface Event { id: number; title: string; description: string; date: string; end_date: string; location: string; type: string; }

export default async function EventsPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  const events: Event[] = await getEvents(params.slug);
  const now = new Date();
  const upcoming = events.filter(e => new Date(e.date) >= now);
  const past = events.filter(e => new Date(e.date) < now);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>
        📅 Events
      </h1>
      <p className="text-gray-600 mb-8">Stay updated with our school events and activities.</p>

      {events.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">📅</div>
          <p className="text-gray-500 text-lg">Events will be posted here soon.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--color-primary)" }}>🔜 Upcoming Events</h2>
              <div className="grid gap-4">
                {upcoming.map(e => (
                  <div key={e.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow" style={{ borderLeftWidth: 4, borderLeftColor: "var(--color-accent)" }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold">{e.title}</h3>
                        {e.type && <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-1" style={{ backgroundColor: "var(--color-secondary)", color: "var(--color-primary)" }}>{e.type}</span>}
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>{displayBS(e.date)}</p>
                        {e.location && <p className="text-xs">📍 {e.location}</p>}
                      </div>
                    </div>
                    {e.description && <p className="text-gray-700 mt-3 text-sm">{e.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--color-primary)" }}>📋 Past Events</h2>
              <div className="grid gap-3">
                {past.slice(0, 10).map(e => (
                  <div key={e.id} className="border rounded-lg p-4 opacity-80">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">{e.title}</h3>
                      <span className="text-sm text-gray-400">{displayBS(e.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
