/** Public Gallery Page — builder sections first, photo grid as fallback. */
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

async function getGallery(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/website/public/${slug}/gallery`, {
      next: { revalidate: 300, tags: [`school-${slug}`] },
    });
    if (!res.ok) return [];
    return (await res.json()).data?.images || [];
  } catch {
    return [];
  }
}

interface GalleryImage {
  id: number;
  url: string;
  caption: string;
  category: string;
  uploaded_at: string;
}

export default async function GalleryPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  // ── Builder-designed Gallery page → same rendering as builder preview ────
  const builder = await getBuilderPage(params.slug, "gallery");
  if (hasBuilderSections(builder)) {
    return <BuilderPageSections slug={params.slug} data={builder!} />;
  }

  const images: GalleryImage[] = await getGallery(params.slug);

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
      >
        📸 Gallery
      </h1>
      <p className="text-gray-600 mb-8">
        A glimpse into our school life, events, and activities.
      </p>

      {images.length > 0 ? (
        <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
          {images.map((img) => (
            <div key={img.id} className="break-inside-avoid border rounded-lg overflow-hidden">
              <img
                src={img.url}
                alt={img.caption || "School gallery"}
                className="w-full"
                loading="lazy"
              />
              {img.caption && (
                <p className="p-3 text-sm text-gray-600">{img.caption}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">🏫</div>
          <p className="text-gray-500 text-lg">Gallery photos will be added soon.</p>
          <p className="text-gray-400 text-sm mt-2">
            Check back later for photos of our school events and activities.
          </p>
        </div>
      )}
    </div>
  );
}
