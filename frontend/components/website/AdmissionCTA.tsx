"use client";

export function AdmissionCTA({ title = "Admissions Open for 2026/2027", subtitle = "Join our family of learners. Apply now for the upcoming academic year.", ctaText = "Apply Now", ctaHref = "/admission", bgColor = "#7c3aed" }: { title?: string; subtitle?: string; ctaText?: string; ctaHref?: string; bgColor?: string }) {
  return (
    <section className="py-20 text-white text-center" style={{ background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)` }}>
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
        <p className="text-lg opacity-90 mb-8">{subtitle}</p>
        <a href={ctaHref} className="inline-flex items-center px-8 py-4 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-colors text-lg shadow-lg">
          {ctaText} →
        </a>
      </div>
    </section>
  );
}
