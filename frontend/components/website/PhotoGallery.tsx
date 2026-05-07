"use client";

export function PhotoGallery({ images = [], title = "Photo Gallery" }: { images?: string[]; title?: string }) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">{title}</h2>
        {images.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-600">
            No gallery photos published yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {images.map((img, i) => (
              <a
                key={`${img}-${i}`}
                href={img}
                className="aspect-square rounded-lg overflow-hidden bg-gray-200 hover:shadow-lg transition-shadow group"
              >
                <img
                  src={img}
                  alt={`${title} photo ${i + 1}`}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
        <div className="text-center mt-8">
          <a href="/gallery" className="text-blue-600 font-medium hover:underline">View Full Gallery →</a>
        </div>
      </div>
    </section>
  );
}
