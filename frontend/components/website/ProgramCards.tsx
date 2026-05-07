"use client";

interface Program {
  title: string;
  description: string;
  icon: string;
  href: string;
}

interface ProgramCardsProps {
  title?: string;
  programs?: Program[];
  columns?: number;
}

const defaultPrograms: Program[] = [
  { title: "Pre-Primary", description: "Nursery to UKG — play-based learning for ages 3-5", icon: "🎨", href: "/academics#pre-primary" },
  { title: "Primary Level", description: "Grades 1-5 — building strong foundations", icon: "📚", href: "/academics#primary" },
  { title: "Lower Secondary", description: "Grades 6-8 — exploring subject depth", icon: "🔬", href: "/academics#lower-secondary" },
  { title: "Secondary Level", description: "Grades 9-10 — NEB curriculum preparation", icon: "🎯", href: "/academics#secondary" },
  { title: "Higher Secondary", description: "Grades 11-12 — Science, Management, Humanities", icon: "🎓", href: "/academics#higher-secondary" },
  { title: "Extra-Curricular", description: "Sports, arts, clubs, and leadership programs", icon: "⚽", href: "/academics#eca" },
];

export function ProgramCards({
  title = "Our Programs",
  programs = defaultPrograms,
  columns = 3,
}: ProgramCardsProps) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{title}</h2>
        <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-6`}>
          {programs.map((program, i) => (
            <a
              key={i}
              href={program.href}
              className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-100"
            >
              <div className="text-4xl mb-4">{program.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {program.title}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">{program.description}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
