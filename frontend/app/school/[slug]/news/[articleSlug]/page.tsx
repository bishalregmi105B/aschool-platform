/** Public News Article Detail Page */
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

async function getArticle(schoolSlug: string, articleSlug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/website/public/${schoolSlug}/news/${articleSlug}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()).data;
  } catch { return null; }
}

export default async function NewsDetailPage({ params }: { params: { slug: string; articleSlug: string } }) {
  const article = await getArticle(params.slug, params.articleSlug);
  if (!article) return (
    <div className="max-w-3xl mx-auto py-12 px-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
      <a href={`/school/${params.slug}/news`} className="text-blue-600 hover:underline">← Back to News</a>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <a href={`/school/${params.slug}/news`} className="text-sm text-gray-500 hover:underline">← Back to News</a>

      <article className="mt-6">
        {article.image_url && <img src={article.image_url} alt={article.title} className="w-full rounded-lg mb-6" loading="lazy" />}

        <div className="flex items-center gap-3 text-sm text-gray-400 mb-4">
          {article.category && <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "var(--color-secondary)", color: "var(--color-primary)" }}>{article.category}</span>}
          {article.created_at && <time>{new Date(article.created_at).toLocaleDateString("en-NP", { year: "numeric", month: "long", day: "numeric" })}</time>}
          {article.author && <span>By {article.author}</span>}
        </div>

        <h1 className="text-3xl font-bold mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>
          {article.title}
        </h1>

        <div className="prose prose-lg max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: article.content || "" }} />
      </article>
    </div>
  );
}