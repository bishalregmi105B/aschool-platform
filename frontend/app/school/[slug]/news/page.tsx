/** Public News Page — school news and updates */
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return (await res.json()).data;
}

async function getNews(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/website/public/${slug}/news`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return (await res.json()).data?.articles || [];
  } catch { return []; }
}

interface Article { id: number; title: string; content: string; excerpt: string; slug: string; image_url: string; author: string; category: string; created_at: string; }

export default async function NewsPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  const articles: Article[] = await getNews(params.slug);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>
        📰 News & Updates
      </h1>
      <p className="text-gray-600 mb-8">Latest news and updates from our school.</p>

      {articles.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">📰</div>
          <p className="text-gray-500 text-lg">News articles will be posted here soon.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {articles.map(a => (
            <article key={a.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              <div className="md:flex">
                {a.image_url && (
                  <div className="md:w-48 md:flex-shrink-0">
                    <img src={a.image_url} alt={a.title} className="w-full h-48 md:h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="p-6 flex-1">
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    {a.category && <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "var(--color-secondary)", color: "var(--color-primary)" }}>{a.category}</span>}
                    {a.created_at && <time>{new Date(a.created_at).toLocaleDateString("en-NP", { year: "numeric", month: "short", day: "numeric" })}</time>}
                  </div>
                  <a href={`/school/${params.slug}/news/${a.slug || a.id}`}>
                    <h2 className="text-xl font-semibold hover:underline" style={{ color: "var(--color-primary)" }}>{a.title}</h2>
                  </a>
                  <p className="text-gray-700 mt-2 text-sm line-clamp-3">{a.excerpt || a.content?.slice(0, 200)}</p>
                  {a.author && <p className="text-xs text-gray-400 mt-3">By {a.author}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
