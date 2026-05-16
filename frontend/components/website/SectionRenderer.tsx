"use client";

/**
 * SectionRenderer — renders a SchoolSection exactly as it appears on the public site.
 * Used by both the website builder editor preview and optionally the public site.
 */

import { HeroSlideshow } from "@/components/website/HeroSlideshow";
import { SchoolStats } from "@/components/website/SchoolStats";
import { ProgramCards } from "@/components/website/ProgramCards";
import { PrincipalMessage } from "@/components/website/PrincipalMessage";
import { AdmissionCTA } from "@/components/website/AdmissionCTA";
import { Testimonials } from "@/components/website/Testimonials";
import type { SchoolSection } from "@/lib/school-website/types";

type C = Record<string, any>;
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const bool = (v: unknown, fallback = true) => (typeof v === "boolean" ? v : fallback);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export interface LiveData {
  school?: {
    name?: string;
    name_nepali?: string;
    phone?: string;
    email?: string;
    municipality?: string;
    district?: string;
    logo_url?: string;
    established_year_bs?: string | number;
    total_students?: number | string;
    total_staff?: number | string;
    about_us?: string;
    vision?: string;
  };
  notices?: Array<{ id: string; title: string; content?: string; created_at: string }>;
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ c }: { c: C }) {
  const bg = str(c.bg_color, "");
  const textColor = str(c.text_color, "#ffffff");
  const style = bg
    ? { background: bg }
    : { background: "linear-gradient(135deg, var(--color-primary, #1e3a5f) 0%, var(--color-secondary, #2e6da4) 100%)" };

  return (
    <section
      className="relative min-h-[400px] flex items-center justify-center text-center overflow-hidden"
      style={{ ...style, color: textColor }}
    >
      <div className="absolute top-8 left-8 w-32 h-32 rounded-full bg-white/5 blur-xl pointer-events-none" />
      <div className="absolute bottom-8 right-8 w-48 h-48 rounded-full bg-white/5 blur-xl pointer-events-none" />
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        {bool(c.show_logo) && (
          <div className="w-20 h-20 rounded-full bg-white/20 mx-auto mb-4 flex items-center justify-center text-3xl">🏫</div>
        )}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
          {str(c.heading, "School Name")}
        </h1>
        {c.subheading && (
          <p className="text-lg sm:text-xl opacity-85 mb-6 max-w-xl mx-auto">{str(c.subheading)}</p>
        )}
        {bool(c.show_location) && (
          <p className="text-sm opacity-60 mb-6">📍 Location, District</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {c.cta_primary && (
            <span
              className="px-7 py-3 rounded-lg font-semibold shadow-lg"
              style={{ backgroundColor: "var(--color-accent, #f59e0b)", color: "#fff" }}
            >
              {str(c.cta_primary)}
            </span>
          )}
          {c.cta_secondary && (
            <span className="px-7 py-3 rounded-lg font-semibold border-2 border-white/70">
              {str(c.cta_secondary)}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsSection({ c }: { c: C }) {
  const items = arr<{ value: string; label: string }>(c.items);
  const bg = str(c.bg_color, "var(--color-secondary, #1e3a5f)");
  const textColor = str(c.text_color, "#ffffff");

  const display = items.length > 0
    ? items
    : [
        { value: "1200+", label: "Students" },
        { value: "85+", label: "Teachers" },
        { value: "A+", label: "Grade Ranking" },
        { value: "2050", label: "Established (BS)" },
      ];

  return (
    <section style={{ backgroundColor: bg }}>
      <div className="grid grid-cols-2 md:grid-cols-4" style={{ color: textColor }}>
        {display.map((stat, i) => (
          <div
            key={i}
            className="text-center py-6 px-4"
            style={{ borderRight: i < display.length - 1 ? "1px solid rgba(255,255,255,0.1)" : undefined }}
          >
            <p className="text-2xl md:text-3xl font-bold">{stat.value}</p>
            <p className="text-xs sm:text-sm opacity-60 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────

function AboutSection({ c, liveData }: { c: C; liveData?: LiveData }) {
  const school = liveData?.school;
  const location = school ? `${school.municipality || ""}, ${school.district || ""}`.replace(/^, |, $/, "") || "Location" : "Location";
  const phone = school?.phone || "Contact Number";
  const estYear = school?.established_year_bs;

  return (
    <section className="max-w-7xl mx-auto px-6 py-14">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {c.tag && (
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--color-accent, #f59e0b)" }}>
              {str(c.tag)}
            </p>
          )}
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
            {str(c.heading, "About Us")}
          </h2>
          <div className="w-12 h-1 rounded" style={{ backgroundColor: "var(--color-accent, #f59e0b)" }} />
          {school?.about_us ? (
            <div
              className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: school.about_us }}
            />
          ) : (
            <p className="text-gray-600 leading-relaxed">
              {str(c.body, "We are a reputed educational institution dedicated to excellence in education and holistic development of students.")}
            </p>
          )}
          {(school?.vision || c.vision) && (
            <div className="p-4 rounded-lg border-l-4" style={{ borderColor: "var(--color-accent, #f59e0b)", backgroundColor: "var(--color-bg, #f9f9f9)" }}>
              <p className="font-semibold text-sm mb-1" style={{ color: "var(--color-primary, #1e3a5f)" }}>Our Vision</p>
              <p className="text-sm text-gray-600">{school?.vision || str(c.vision)}</p>
            </div>
          )}
        </div>
        <div>
          <div className="bg-gray-50 rounded-xl p-5 border" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
            <h3 className="font-bold mb-3 text-sm" style={{ color: "var(--color-primary, #1e3a5f)" }}>Quick Info</h3>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex gap-2"><span>📍</span><span>{location}</span></div>
              <div className="flex gap-2"><span>📞</span><span>{phone}</span></div>
              {estYear && <div className="flex gap-2"><span>🏫</span><span>Established: {estYear} BS</span></div>}
              {!estYear && <div className="flex gap-2"><span>🏫</span><span>Established: –</span></div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Principal ────────────────────────────────────────────────────────────────

function PrincipalSection({ c }: { c: C }) {
  return (
    <section className="py-14 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            {c.tag && (
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>
                {str(c.tag)}
              </p>
            )}
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
              {str(c.heading, "Message from Principal")}
            </h2>
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="w-28 h-28 rounded-xl flex-shrink-0 overflow-hidden shadow-md" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
                {c.photo ? (
                  <img src={str(c.photo)} alt={str(c.name, "Principal")} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">👨‍💼</div>
                )}
              </div>
              <div>
                <blockquote className="text-gray-600 text-sm leading-relaxed italic mb-4 border-l-4 pl-4" style={{ borderColor: "var(--color-accent, #f59e0b)" }}>
                  &ldquo;{str(c.message, "Education is not the filling of a pail, but the lighting of a fire.")}&rdquo;
                </blockquote>
                <p className="font-bold text-sm" style={{ color: "var(--color-primary, #1e3a5f)" }}>{str(c.name, "Principal Name")}</p>
                {c.designation && <p className="text-xs text-gray-500">{str(c.designation)}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Programs ─────────────────────────────────────────────────────────────────

function ProgramsSection({ c }: { c: C }) {
  const items = arr<{ icon: string; name: string; desc: string; grade?: string }>(c.items);
  const display = items.length > 0 ? items : [
    { icon: "📚", name: "Primary Level", desc: "Grades 1–5, strong foundations", grade: "1–5" },
    { icon: "🔬", name: "Secondary Level", desc: "Grades 9–10, NEB curriculum", grade: "9–10" },
    { icon: "🎓", name: "Higher Secondary", desc: "Grades 11–12, Science & Management", grade: "11–12" },
  ];

  return (
    <section className="py-14" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-10">
          {c.tag && (
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>{str(c.tag)}</p>
          )}
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
            {str(c.heading, "Our Programs")}
          </h2>
          <div className="w-12 h-1 rounded mx-auto mt-3" style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {display.map((prog, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ backgroundColor: "var(--color-secondary, #e8f0fe)" }}
              >
                {prog.icon}
              </div>
              <h3 className="font-bold mb-1" style={{ color: "var(--color-primary, #1e3a5f)", fontFamily: "var(--font-heading)" }}>
                {prog.name}
              </h3>
              {prog.grade && <p className="text-xs text-gray-400 mb-1">Grade {prog.grade}</p>}
              <p className="text-sm text-gray-600 leading-relaxed">{prog.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Facilities ───────────────────────────────────────────────────────────────

function FacilitiesSection({ c }: { c: C }) {
  const items = arr<{ icon: string; name: string; desc: string }>(c.items);
  const display = items.length > 0 ? items : [
    { icon: "🖥️", name: "Computer Lab", desc: "Modern computers with high-speed internet" },
    { icon: "📚", name: "Library", desc: "Well-stocked library with digital resources" },
    { icon: "🔬", name: "Science Lab", desc: "Physics, chemistry and biology labs" },
    { icon: "🏆", name: "Sports", desc: "Indoor and outdoor sports facilities" },
    { icon: "🚌", name: "Transport", desc: "Safe transport covering all major routes" },
    { icon: "🎨", name: "Arts & Culture", desc: "Arts, music and cultural programs" },
  ];

  return (
    <section className="py-14 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-10">
          {c.tag && (
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>{str(c.tag)}</p>
          )}
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
            {str(c.heading, "Facilities")}
          </h2>
          <div className="w-12 h-1 rounded mx-auto mt-3" style={{ backgroundColor: "var(--color-accent, #f59e0b)" }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {display.map((item, i) => (
            <div key={i} className="flex gap-4 p-5 rounded-xl border hover:shadow-md transition-shadow" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}
              >
                {item.icon}
              </div>
              <div>
                <h3 className="font-bold mb-1" style={{ color: "var(--color-primary, #1e3a5f)" }}>{item.name}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Notices ─────────────────────────────────────────────────────────────────

function NoticesSection({ c, liveData }: { c: C; liveData?: LiveData }) {
  const liveNotices = liveData?.notices;
  const placeholders = [
    { title: "Annual Examination Schedule 2082/2083", date: "2 days ago", cat: "Academic" },
    { title: "Parent-Teacher Meeting Notice", date: "1 week ago", cat: "Meeting" },
    { title: "School Sports Day — Registration Open", date: "2 weeks ago", cat: "Event" },
    { title: "Holiday Notice — Dashain Vacation", date: "3 weeks ago", cat: "Holiday" },
    { title: "Scholarship Applications Now Open", date: "1 month ago", cat: "Academic" },
    { title: "New Library Books Available", date: "1 month ago", cat: "Facility" },
  ];

  return (
    <section className="py-14" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            {c.tag && (
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>{str(c.tag)}</p>
            )}
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
              {str(c.heading, "Latest Notices")}
            </h2>
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--color-accent, #f59e0b)" }}>View All</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {liveNotices && liveNotices.length > 0
            ? liveNotices.slice(0, 6).map((n) => {
                const d = new Date(n.created_at);
                const ago = isNaN(d.getTime())
                  ? ""
                  : d.toLocaleDateString("en", { month: "short", day: "2-digit", year: "numeric" });
                return (
                  <div key={n.id} className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
                    <h3 className="font-semibold text-sm mb-2" style={{ color: "var(--color-primary, #1e3a5f)" }}>{n.title}</h3>
                    {ago && <p className="text-xs text-gray-400">{ago}</p>}
                  </div>
                );
              })
            : placeholders.map((n, i) => (
                <div key={i} className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
                  <span className="text-xs px-2 py-0.5 rounded-full mb-2 inline-block" style={{ backgroundColor: "var(--color-surface, #f3f4f6)", color: "var(--color-primary, #1e3a5f)" }}>
                    {n.cat}
                  </span>
                  <h3 className="font-semibold text-sm mt-2 mb-2" style={{ color: "var(--color-primary, #1e3a5f)" }}>{n.title}</h3>
                  <p className="text-xs text-gray-400">{n.date}</p>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}

// ─── Teachers ─────────────────────────────────────────────────────────────────

function TeachersSection({ c }: { c: C }) {
  const placeholders = ["Ram Prasad Sharma", "Sita Devi Thapa", "Hari Bahadur KC", "Gita Kumari Shrestha"];

  return (
    <section className="py-14 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            {c.tag && (
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>{str(c.tag)}</p>
            )}
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
              {str(c.heading, "Our Teachers")}
            </h2>
          </div>
          <span className="text-sm font-semibold hidden sm:block" style={{ color: "var(--color-primary, #1e3a5f)" }}>View All</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {placeholders.map((name, i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-center p-5 border border-gray-100">
              <div
                className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white mb-3"
                style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}
              >
                {name.charAt(0)}
              </div>
              <p className="font-semibold text-sm" style={{ color: "var(--color-primary, #1e3a5f)" }}>{name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Teacher</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

function GallerySection({ c }: { c: C }) {
  const colors = [
    "var(--color-primary, #1e3a5f)", "var(--color-secondary, #2e6da4)",
    "var(--color-accent, #f59e0b)", "#6b7280", "var(--color-primary, #1e3a5f)", "#9ca3af",
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 py-14">
      <div className="flex items-end justify-between mb-8">
        <div>
          {c.tag && (
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>{str(c.tag)}</p>
          )}
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
            {str(c.heading, "Photo Gallery")}
          </h2>
        </div>
        <span className="text-sm font-semibold hidden sm:block" style={{ color: "var(--color-primary, #1e3a5f)" }}>View All</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {colors.map((bg, i) => (
          <div key={i} className="aspect-video rounded-xl overflow-hidden flex items-center justify-center text-white/40 text-sm font-medium" style={{ backgroundColor: bg }}>
            {i === 0 ? "📸" : i === 1 ? "🏫" : i === 2 ? "🎓" : i === 3 ? "📚" : i === 4 ? "⚽" : "🎨"}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function TestimonialsSection({ c }: { c: C }) {
  const items = arr<{ quote: string; name: string; title: string; initials?: string }>(c.items);
  const display = items.length > 0 ? items : [
    { quote: "This school has given my child the best foundation for life. Highly recommended.", name: "Parent Name", title: "Parent of Grade 5 Student" },
    { quote: "The teachers are dedicated and the learning environment is excellent.", name: "Student Name", title: "Grade XII Science" },
    { quote: "Best school in the district. The facilities and teaching quality are outstanding.", name: "Alumni Name", title: "Class of 2075 BS" },
  ];

  return (
    <section className="py-14" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-10">
          {c.tag && (
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>{str(c.tag)}</p>
          )}
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
            {str(c.heading, "What People Say")}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {display.map((t, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border shadow-sm" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
              <div className="flex gap-1 mb-3">
                {[1,2,3,4,5].map((s) => <span key={s} className="text-yellow-400 text-sm">★</span>)}
              </div>
              <p className="text-gray-600 italic text-sm leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}
                >
                  {t.initials || t.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--color-primary, #1e3a5f)" }}>{t.name}</p>
                  <p className="text-xs text-gray-500">{t.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ─────────────────────────────────────────────────────────────────────

function CTASection({ c }: { c: C }) {
  const bg = str(c.bg_color, "var(--color-primary, #1e3a5f)");
  const textColor = str(c.text_color, "#ffffff");

  return (
    <section className="py-16 px-6 text-center" style={{ backgroundColor: bg, color: textColor }}>
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          {str(c.heading, "Join Our School Community")}
        </h2>
        {c.subheading && (
          <p className="opacity-80 mb-8 text-sm sm:text-base">{str(c.subheading)}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {c.cta_primary && (
            <span
              className="inline-block px-8 py-3 rounded-lg font-semibold text-white"
              style={{ backgroundColor: "var(--color-accent, #f59e0b)" }}
            >
              {str(c.cta_primary)}
            </span>
          )}
          {c.cta_secondary && (
            <span className="inline-block px-8 py-3 rounded-lg font-semibold border-2 border-white/60">
              {str(c.cta_secondary)}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Slideshow ────────────────────────────────────────────────────────────────

function SlideshowSection({ c }: { c: C }) {
  const slides = arr<{ title: string; subtitle?: string; image?: string; cta_text?: string }>(c.slides);
  const display = slides.length > 0 ? slides : [
    { title: "Welcome to Our School", subtitle: "Excellence in Education", cta_text: "Apply Now" },
    { title: "Building Tomorrow's Leaders", subtitle: "Holistic Development", cta_text: "Learn More" },
    { title: "Join Our Community", subtitle: "Admissions Open", cta_text: "Contact Us" },
  ];
  const slide = display[0];

  return (
    <section
      className="relative min-h-[420px] flex items-center justify-center text-white text-center overflow-hidden"
      style={{
        background: slide.image
          ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${slide.image}) center/cover no-repeat`
          : "linear-gradient(135deg, var(--color-primary, #1e3a5f) 0%, var(--color-secondary, #2e6da4) 100%)",
      }}
    >
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
          {slide.title}
        </h1>
        {slide.subtitle && <p className="text-lg sm:text-xl opacity-85 mb-8">{slide.subtitle}</p>}
        {slide.cta_text && (
          <span className="inline-block px-7 py-3 rounded-lg font-semibold" style={{ backgroundColor: "var(--color-accent, #f59e0b)", color: "#fff" }}>
            {slide.cta_text}
          </span>
        )}
        {/* Slide indicators */}
        <div className="flex gap-2 justify-center mt-8">
          {display.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === 0 ? "w-8 bg-white" : "w-2 bg-white/40"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Contact ─────────────────────────────────────────────────────────────────

function ContactSection({ c, liveData }: { c: C; liveData?: LiveData }) {
  const school = liveData?.school;
  const phone = school?.phone || str(c.phone, "+977-XX-XXXXXXX");
  const email = school?.email || str(c.email, "info@school.edu.np");
  const address = school
    ? [school.municipality, school.district, "Nepal"].filter(Boolean).join(", ")
    : str(c.address, "School Address, District, Nepal");

  return (
    <section className="py-14 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
            {str(c.heading, "Contact Us")}
          </h2>
          {c.subheading && <p className="text-gray-500 mt-2 text-sm">{str(c.subheading)}</p>}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="flex gap-3 p-4 rounded-xl border" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
              <span className="text-xl">📍</span>
              <div><p className="font-semibold text-sm">Address</p><p className="text-sm text-gray-500">{address}</p></div>
            </div>
            <div className="flex gap-3 p-4 rounded-xl border" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
              <span className="text-xl">📞</span>
              <div><p className="font-semibold text-sm">Phone</p><p className="text-sm text-gray-500">{phone}</p></div>
            </div>
            <div className="flex gap-3 p-4 rounded-xl border" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
              <span className="text-xl">✉️</span>
              <div><p className="font-semibold text-sm">Email</p><p className="text-sm text-gray-500">{email}</p></div>
            </div>
          </div>
          <div className="space-y-3">
            <input type="text" placeholder="Your Name" className="w-full border rounded-lg px-4 py-3 text-sm" readOnly />
            <input type="email" placeholder="Email Address" className="w-full border rounded-lg px-4 py-3 text-sm" readOnly />
            <textarea rows={4} placeholder="Your message..." className="w-full border rounded-lg px-4 py-3 text-sm resize-none" readOnly />
            <button className="w-full py-3 rounded-lg font-semibold text-white" style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}>
              Send Message
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Spacer / Divider / Map ───────────────────────────────────────────────────

function SpacerSection({ c }: { c: C }) {
  const h = typeof c.height === "number" ? c.height : 40;
  return <div style={{ height: `${h}px` }} className="bg-white" />;
}

function DividerSection({ c }: { c: C }) {
  const style = str(c.style, "solid");
  return (
    <div className="py-6 px-6 bg-white">
      <hr style={{ borderStyle: style as "solid" | "dashed" | "dotted", borderColor: "var(--color-border, #e5e7eb)", borderTopWidth: "2px" }} />
    </div>
  );
}

function MapSection({ c }: { c: C }) {
  return (
    <section className="py-14 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {c.heading && (
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--color-primary, #1e3a5f)" }}>{str(c.heading)}</h2>
        )}
        <div className="rounded-xl overflow-hidden bg-gray-100 h-64 flex items-center justify-center text-gray-400 border" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
          {c.embed_url ? (
            <iframe src={str(c.embed_url)} className="w-full h-full" loading="lazy" />
          ) : (
            <div className="text-center">
              <p className="text-4xl mb-2">🗺️</p>
              <p className="text-sm">Map will appear here</p>
              <p className="text-xs text-gray-400 mt-1">Add an embed URL in the properties panel</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

export function SectionRenderer({ section, liveData }: { section: SchoolSection; liveData?: LiveData }) {
  const c = section.content as C;

  switch (section.type) {
    case "hero":
      return <HeroSection c={c} />;
    case "slideshow":
      return <SlideshowSection c={c} />;
    case "stats":
      return <StatsSection c={c} />;
    case "about":
      return <AboutSection c={c} liveData={liveData} />;
    case "principal":
      return <PrincipalSection c={c} />;
    case "programs":
      return <ProgramsSection c={c} />;
    case "facilities":
      return <FacilitiesSection c={c} />;
    case "notices":
      return <NoticesSection c={c} liveData={liveData} />;
    case "teachers":
      return <TeachersSection c={c} />;
    case "gallery":
      return <GallerySection c={c} />;
    case "testimonials":
      return <TestimonialsSection c={c} />;
    case "cta":
      return <CTASection c={c} />;
    case "contact":
      return <ContactSection c={c} liveData={liveData} />;
    case "spacer":
      return <SpacerSection c={c} />;
    case "divider":
      return <DividerSection c={c} />;
    case "map":
      return <MapSection c={c} />;
    default:
      return (
        <div className="py-12 text-center text-gray-400 bg-white border-y" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
          <p className="text-3xl mb-2">📦</p>
          <p className="font-medium">{section.title}</p>
          <p className="text-sm capitalize text-gray-300">({section.type})</p>
        </div>
      );
  }
}
