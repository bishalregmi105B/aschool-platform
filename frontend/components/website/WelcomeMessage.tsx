"use client";

interface WelcomeMessageProps {
  title?: string;
  message?: string;
  principalName?: string;
  principalTitle?: string;
  principalImage?: string;
}

export function WelcomeMessage({
  title,
  message,
  principalName,
  principalTitle = "Principal",
  principalImage,
}: WelcomeMessageProps) {
  if (!title && !message && !principalName && !principalImage) return null;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid md:grid-cols-5 gap-10 items-center">
          <div className="md:col-span-3">
            {title && <h2 className="text-3xl font-bold text-gray-900 mb-6">{title}</h2>}
            {message && <p className="text-gray-600 leading-relaxed text-lg">{message}</p>}
            {principalName && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="font-semibold text-gray-900">{principalName}</p>
                <p className="text-sm text-gray-500">{principalTitle}</p>
              </div>
            )}
          </div>
          <div className="md:col-span-2 flex justify-center">
            <div className="w-64 h-72 rounded-2xl bg-gray-100 overflow-hidden shadow-lg">
              {principalImage ? (
                <img src={principalImage} alt={principalName || "Principal"} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-100" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
