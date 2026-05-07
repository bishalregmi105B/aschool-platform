"use client";

export function MissionVision() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-8">
        {[
          { icon: "🎯", title: "Our Mission", text: "To provide quality education that develops intellectual, moral, and physical capabilities of every student." },
          { icon: "👁️", title: "Our Vision", text: "To be a center of excellence in education, producing competent, ethical, and responsible citizens for the nation." },
          { icon: "💎", title: "Our Values", text: "Integrity, Excellence, Innovation, Respect, Community, and Lifelong Learning." },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">{item.icon}</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
            <p className="text-gray-600 leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
