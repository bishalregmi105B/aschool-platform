"use client";

export function PrincipalMessage({ name, image, message }: { name?: string; image?: string; message?: string }) {
  if (!name && !image && !message) return null;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">From the Principal&apos;s Desk</h2>
        <div className="w-32 h-32 rounded-full bg-gray-100 mx-auto mb-6 overflow-hidden">
          {image ? <img src={image} alt={name || "Principal"} className="w-full h-full object-cover" /> : <div className="h-full bg-gray-100" />}
        </div>
        {message && <blockquote className="text-lg text-gray-600 italic leading-relaxed max-w-2xl mx-auto">&ldquo;{message}&rdquo;</blockquote>}
        {name && <p className="mt-4 font-semibold text-gray-900">{name}</p>}
      </div>
    </section>
  );
}
