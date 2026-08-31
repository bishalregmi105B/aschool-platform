"use client";

/**
 * EditorSectionRenderer — editor-preview renderer for builder sections.
 *
 * Mirrors SectionRenderer (public site) but honors EVERY control key defined
 * in lib/school-website/registry.ts. The shared SectionRenderer ignores
 * several registry keys (max_items, show_view_all, layout, columns, use_api,
 * spacer/divider units, cta body, contact show_form/show_map, slideshow
 * height/interval/auto_play…), which is why Properties-panel edits never
 * appeared to change the editor preview. This renderer is the single preview
 * for /dashboard/website-builder/editor; the same key support should be
 * ported into SectionRenderer so the live site matches (see report).
 */

import { useEffect, useState, type FormEvent } from "react";

import type { SchoolSection } from "@/lib/school-website/types";

type C = Record<string, any>;

export interface EditorLiveData {
  school?: {
    slug?: string;
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
  teachers?: Array<{ id: string; name: string; subject?: string; photo?: string; designation?: string }>;
  gallery?: Array<{ id: string; url: string; caption?: string }>;
}

const str = (v: unknown, fallback = "") => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : fallback);
const bool = (v: unknown, fallback = true) => (typeof v === "boolean" ? v : fallback);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const int = (v: unknown, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

/** "520px" | 520 | "50vh" → css min-height string. */
const cssSize = (v: unknown, fallback: string) => {
  if (typeof v === "number" && Number.isFinite(v)) return `${v}px`;
  if (typeof v === "string" && v.trim()) return /^\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}px` : v.trim();
  return fallback;
};

/** Registry "columns" select stores strings ("2"|"3"|"4") or numbers. */
const gridCols = (v: unknown, fallback: number) => {
  const n = int(v, fallback);
  return Math.min(4, Math.max(1, n));
};

const colClass: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4",
};

function SectionHeading({ tag, heading, align = "center" }: { tag?: unknown; heading: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "text-center mb-10" : "mb-8"}>
      {bool(tag) && str(tag) && (
        <p
          className={`text-xs font-semibold tracking-widest uppercase mb-1 ${align === "center" ? "" : ""}`}
          style={{ color: "var(--color-accent, #f59e0b)" }}
        >
          {str(tag)}
        </p>
      )}
      <h2
        className="text-2xl sm:text-3xl font-bold"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}
      >
        {heading}
      </h2>
      <div className={`w-12 h-1 rounded mt-3 ${align === "center" ? "mx-auto" : ""}`} style={{ backgroundColor: "var(--color-accent, #f59e0b)" }} />
    </div>
  );
}

function ViewAllLink({ enabled, color }: { enabled: boolean; color?: string }) {
  if (!enabled) return null;
  return (
    <span className="text-sm font-semibold hidden sm:block" style={{ color: color || "var(--color-primary, #1e3a5f)" }}>
      View All →
    </span>
  );
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
      className="relative flex items-center justify-center text-center overflow-hidden"
      style={{ ...style, color: textColor, minHeight: cssSize(c.height, "520px") }}
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
        {str(c.subheading) && <p className="text-lg sm:text-xl opacity-85 mb-6 max-w-xl mx-auto">{str(c.subheading)}</p>}
        {bool(c.show_location) && <p className="text-sm opacity-60 mb-6">📍 Location, District</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {str(c.cta_primary) && (
            <span
              className="px-7 py-3 rounded-lg font-semibold shadow-lg"
              style={{ backgroundColor: "var(--color-accent, #f59e0b)", color: "#fff" }}
            >
              {str(c.cta_primary)}
            </span>
          )}
          {str(c.cta_secondary) && (
            <span className="px-7 py-3 rounded-lg font-semibold border-2 border-white/70">{str(c.cta_secondary)}</span>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Slideshow ────────────────────────────────────────────────────────────────

function SlideshowSection({ c }: { c: C }) {
  const slides = arr<{ title?: string; subtitle?: string; image?: string; cta_text?: string; cta_link?: string }>(c.slides);
  const autoPlay = bool(c.auto_play, true);
  const interval = Math.max(2000, int(c.interval, 5000));
  const opacity = Math.min(1, Math.max(0, typeof c.overlay_opacity === "number" ? c.overlay_opacity : 0.5));
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!autoPlay || slides.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [autoPlay, interval, slides.length]);

  if (slides.length === 0) {
    return (
      <section
        className="flex items-center justify-center text-white text-center"
        style={{
          minHeight: cssSize(c.height, "600px"),
          background: `linear-gradient(rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity})), linear-gradient(135deg, var(--color-primary, #1e3a5f) 0%, var(--color-secondary, #2e6da4) 100%)`,
        }}
      >
        <div>
          <p className="text-4xl mb-2">🎞️</p>
          <p className="text-sm opacity-80">No slides yet — add one in the properties panel</p>
        </div>
      </section>
    );
  }

  const slide = slides[Math.min(idx, slides.length - 1)];
  return (
    <section
      className="relative flex items-center justify-center text-white text-center overflow-hidden"
      style={{
        minHeight: cssSize(c.height, "600px"),
        background: slide.image
          ? `linear-gradient(rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity})), url(${slide.image}) center/cover no-repeat`
          : `linear-gradient(rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity})), linear-gradient(135deg, var(--color-primary, #1e3a5f) 0%, var(--color-secondary, #2e6da4) 100%)`,
      }}
    >
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
          {str(slide.title, "Slide")}
        </h1>
        {str(slide.subtitle) && <p className="text-lg sm:text-xl opacity-85 mb-8">{str(slide.subtitle)}</p>}
        {str(slide.cta_text) && (
          <span className="inline-block px-7 py-3 rounded-lg font-semibold" style={{ backgroundColor: "var(--color-accent, #f59e0b)", color: "#fff" }}>
            {str(slide.cta_text)}
          </span>
        )}
        {slides.length > 1 && (
          <div className="flex gap-2 justify-center mt-8">
            {slides.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-white" : "w-2 bg-white/40"}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function StatsSection({ c }: { c: C }) {
  const items = arr<{ value: string; label: string }>(c.items);
  const display = items.length > 0
    ? items
    : [
        { value: "1200+", label: "Students" },
        { value: "85+", label: "Teachers" },
        { value: "A+", label: "Grade Ranking" },
        { value: "2050", label: "Established (BS)" },
      ];

  return (
    <section style={{ backgroundColor: str(c.bg_color, "var(--color-secondary, #1e3a5f)") }}>
      <div className="grid grid-cols-2 md:grid-cols-4" style={{ color: str(c.text_color, "#ffffff") }}>
        {display.map((stat, i) => (
          <div key={i} className="text-center py-6 px-4" style={{ borderRight: i < display.length - 1 ? "1px solid rgba(255,255,255,0.1)" : undefined }}>
            <p className="text-2xl md:text-3xl font-bold">{str(stat.value, "0+")}</p>
            <p className="text-xs sm:text-sm opacity-60 mt-1">{str(stat.label)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────

function AboutSection({ c, liveData }: { c: C; liveData?: EditorLiveData }) {
  const school = liveData?.school;
  const showVision = bool(c.show_vision, true);
  const showMission = bool(c.show_mission, false);
  const isSplit = str(c.layout, "default") === "split";

  return (
    <section className="max-w-7xl mx-auto px-6 py-14">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className={`space-y-4 ${isSplit ? "lg:col-span-2" : "lg:col-span-2"}`}>
          {str(c.tag) && (
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--color-accent, #f59e0b)" }}>
              {str(c.tag)}
            </p>
          )}
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
            {str(c.heading, "About Us")}
          </h2>
          <div className="w-12 h-1 rounded" style={{ backgroundColor: "var(--color-accent, #f59e0b)" }} />
          {school?.about_us ? (
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: str(school.about_us) }} />
          ) : (
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">
              {str(c.body, "We are a reputed educational institution dedicated to excellence in education and holistic development of students.")}
            </p>
          )}
          {showVision && (school?.vision || str(c.vision)) && (
            <div className="p-4 rounded-lg border-l-4" style={{ borderColor: "var(--color-accent, #f59e0b)", backgroundColor: "var(--color-bg, #f9f9f9)" }}>
              <p className="font-semibold text-sm mb-1" style={{ color: "var(--color-primary, #1e3a5f)" }}>Our Vision</p>
              <p className="text-sm text-gray-600">{school?.vision || str(c.vision)}</p>
            </div>
          )}
          {showMission && str(c.mission) && (
            <div className="p-4 rounded-lg border-l-4" style={{ borderColor: "var(--color-secondary, #2e6da4)", backgroundColor: "var(--color-bg, #f9f9f9)" }}>
              <p className="font-semibold text-sm mb-1" style={{ color: "var(--color-primary, #1e3a5f)" }}>Our Mission</p>
              <p className="text-sm text-gray-600">{str(c.mission)}</p>
            </div>
          )}
          {str(c.cta_text) && (
            <span
              className="inline-block px-6 py-2.5 rounded-lg font-semibold text-white text-sm mt-2"
              style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}
            >
              {str(c.cta_text)}
            </span>
          )}
        </div>
        <div>
          <div className="bg-gray-50 rounded-xl p-5 border" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
            <h3 className="font-bold mb-3 text-sm" style={{ color: "var(--color-primary, #1e3a5f)" }}>Quick Info</h3>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex gap-2"><span>📍</span><span>{school ? `${school.municipality || ""}, ${school.district || ""}`.replace(/^, |, $/, "") || "Location" : "Location"}</span></div>
              <div className="flex gap-2"><span>📞</span><span>{school?.phone || "Contact Number"}</span></div>
              <div className="flex gap-2"><span>🏫</span><span>Established: {school?.established_year_bs ?? "–"}</span></div>
            </div>
            {isSplit && (
              <div className="mt-4 aspect-video rounded-lg flex items-center justify-center text-3xl" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
                🖼️
              </div>
            )}
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
            {str(c.tag) && (
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>
                {str(c.tag)}
              </p>
            )}
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
              {str(c.heading, "Message from Principal")}
            </h2>
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="w-28 h-28 rounded-xl flex-shrink-0 overflow-hidden shadow-md" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
                {str(c.photo) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={str(c.photo)} alt={str(c.name, "Principal")} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">👨‍💼</div>
                )}
              </div>
              <div>
                <blockquote className="text-gray-600 text-sm leading-relaxed italic mb-4 border-l-4 pl-4" style={{ borderColor: "var(--color-accent, #f59e0b)" }}>
                  &ldquo;{str(c.message ?? c.quote, "Education is not the filling of a pail, but the lighting of a fire.")}&rdquo;
                </blockquote>
                <p className="font-bold text-sm" style={{ color: "var(--color-primary, #1e3a5f)" }}>{str(c.name, "Principal Name")}</p>
                {str(c.designation) && <p className="text-xs text-gray-500">{str(c.designation)}</p>}
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
  const items = arr<{ icon?: string; title?: string; name?: string; desc?: string; grade?: string }>(c.items);
  const cols = gridCols(c.columns, 3);
  const display = items.length > 0
    ? items
    : [
        { icon: "📚", name: "Primary Level", desc: "Grades 1–5, strong foundations", grade: "1–5" },
        { icon: "🔬", name: "Secondary Level", desc: "Grades 9–10, NEB curriculum", grade: "9–10" },
        { icon: "🎓", name: "Higher Secondary", desc: "Grades 11–12, Science & Management", grade: "11–12" },
      ];

  return (
    <section className="py-14" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeading tag={c.tag} heading={str(c.heading, "Our Programs")} />
        <div className={`grid gap-6 ${colClass[cols]}`}>
          {display.map((prog, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ backgroundColor: "var(--color-secondary, #e8f0fe)" }}>
                {prog.icon || "📘"}
              </div>
              <h3 className="font-bold mb-1" style={{ color: "var(--color-primary, #1e3a5f)", fontFamily: "var(--font-heading)" }}>
                {str(prog.name ?? prog.title, "Program")}
              </h3>
              {str(prog.grade) && <p className="text-xs text-gray-400 mb-1">Grade {str(prog.grade)}</p>}
              <p className="text-sm text-gray-600 leading-relaxed">{str(prog.desc)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Facilities ───────────────────────────────────────────────────────────────

function FacilitiesSection({ c, liveData }: { c: C; liveData?: EditorLiveData }) {
  const items = arr<{ icon?: string; title?: string; name?: string; desc?: string }>(c.items);
  const useApi = bool(c.use_api, false);
  const cols = gridCols(c.columns, 3);
  const display = items.length > 0
    ? items
    : [
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
        <SectionHeading tag={c.tag} heading={str(c.heading, "Facilities")} />
        {str(c.subtitle) && <p className="text-center text-gray-500 text-sm -mt-6 mb-8 max-w-2xl mx-auto">{str(c.subtitle)}</p>}
        {useApi && !liveData?.school && (
          <p className="text-center text-xs text-gray-400 mb-6">☁️ Live facilities load from Settings → Facilities on your public site</p>
        )}
        <div className={`grid gap-6 ${colClass[cols]}`}>
          {display.map((item, i) => (
            <div key={i} className="flex gap-4 p-5 rounded-xl border hover:shadow-md transition-shadow" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
                {item.icon || "🏫"}
              </div>
              <div>
                <h3 className="font-bold mb-1" style={{ color: "var(--color-primary, #1e3a5f)" }}>{str(item.name ?? item.title)}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{str(item.desc)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Notices ──────────────────────────────────────────────────────────────────

function NoticesSection({ c, liveData }: { c: C; liveData?: EditorLiveData }) {
  const layout = str(c.layout, "grid"); // grid | list | sidebar
  const maxItems = Math.min(12, Math.max(1, int(c.max_items, 6)));
  const showViewAll = bool(c.show_view_all, true);
  const useApi = bool(c.use_api, false);

  const liveNotices = useApi ? liveData?.notices : undefined;
  const placeholders = [
    { title: "Annual Examination Schedule 2082/2083", date: "2 days ago", cat: "Academic" },
    { title: "Parent-Teacher Meeting Notice", date: "1 week ago", cat: "Meeting" },
    { title: "School Sports Day — Registration Open", date: "2 weeks ago", cat: "Event" },
    { title: "Holiday Notice — Dashain Vacation", date: "3 weeks ago", cat: "Holiday" },
    { title: "Scholarship Applications Now Open", date: "1 month ago", cat: "Academic" },
    { title: "New Library Books Available", date: "1 month ago", cat: "Facility" },
  ];
  const source = liveNotices && liveNotices.length > 0
    ? liveNotices.map((n) => {
        const d = new Date(n.created_at);
        return { title: n.title, date: isNaN(d.getTime()) ? "" : d.toLocaleDateString("en", { month: "short", day: "2-digit", year: "numeric" }), cat: "Notice" };
      })
    : placeholders;

  const display = source.slice(0, maxItems);

  return (
    <section className="py-14" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            {str(c.tag) && (
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>{str(c.tag)}</p>
            )}
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
              {str(c.heading, "Latest Notices")}
            </h2>
          </div>
          <ViewAllLink enabled={showViewAll} color="var(--color-accent, #f59e0b)" />
        </div>

        {layout === "list" || layout === "sidebar" ? (
          <div className={`grid gap-8 ${layout === "sidebar" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
            <div className={`bg-white border rounded-xl divide-y ${layout === "sidebar" ? "lg:col-span-2" : ""}`} style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
              {display.map((n, i) => (
                <div key={i} className="px-5 py-4 flex items-start justify-between gap-4">
                  <h3 className="font-semibold text-sm" style={{ color: "var(--color-primary, #1e3a5f)" }}>{n.title}</h3>
                  <span className="text-xs text-gray-400 flex-shrink-0">{n.date}</span>
                </div>
              ))}
            </div>
            {layout === "sidebar" && (
              <div className="bg-white border rounded-xl p-5" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
                <p className="font-bold text-sm mb-3" style={{ color: "var(--color-primary, #1e3a5f)" }}>Notice Categories</p>
                <div className="space-y-2 text-sm text-gray-500">
                  {display.slice(0, 4).map((n, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-accent, #f59e0b)" }} />
                      {n.cat}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {display.map((n, i) => (
              <div key={i} className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
                <span className="text-xs px-2 py-0.5 rounded-full mb-2 inline-block" style={{ backgroundColor: "var(--color-surface, #f3f4f6)", color: "var(--color-primary, #1e3a5f)" }}>
                  {n.cat}
                </span>
                <h3 className="font-semibold text-sm mt-2 mb-2" style={{ color: "var(--color-primary, #1e3a5f)" }}>{n.title}</h3>
                <p className="text-xs text-gray-400">{n.date}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Teachers ─────────────────────────────────────────────────────────────────

function TeachersSection({ c, liveData }: { c: C; liveData?: EditorLiveData }) {
  const maxItems = Math.min(12, Math.max(1, int(c.max_items, 4)));
  const showViewAll = bool(c.show_view_all, true);
  const useApi = bool(c.use_api, false);

  const source = useApi && liveData?.teachers && liveData.teachers.length > 0
    ? liveData.teachers.map((t) => ({ name: t.name, role: t.designation || t.subject || "Teacher", photo: t.photo }))
    : ["Ram Prasad Sharma", "Sita Devi Thapa", "Hari Bahadur KC", "Gita Kumari Shrestha"].map((n) => ({ name: n, role: "Teacher", photo: "" }));

  const display = source.slice(0, maxItems);

  return (
    <section className="py-14 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            {str(c.tag) && (
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>{str(c.tag)}</p>
            )}
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
              {str(c.heading, "Our Teachers")}
            </h2>
          </div>
          <ViewAllLink enabled={showViewAll} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {display.map((t, i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-center p-5 border border-gray-100">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white mb-3" style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}>
                {t.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.photo} alt={t.name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  str(t.name, "T").charAt(0)
                )}
              </div>
              <p className="font-semibold text-sm" style={{ color: "var(--color-primary, #1e3a5f)" }}>{str(t.name)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{str(t.role, "Teacher")}</p>
            </div>
          ))}
        </div>
        {useApi && !liveData?.teachers && (
          <p className="text-center text-xs text-gray-400 mt-6">☁️ Live teacher profiles load from the Staff directory on your public site</p>
        )}
      </div>
    </section>
  );
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

function GallerySection({ c, liveData }: { c: C; liveData?: EditorLiveData }) {
  const cols = gridCols(c.columns, 3);
  const maxItems = Math.min(12, Math.max(1, int(c.max_items, 6)));
  const showViewAll = bool(c.show_view_all, true);
  const useApi = bool(c.use_api, false);

  const colors = [
    "var(--color-primary, #1e3a5f)", "var(--color-secondary, #2e6da4)",
    "var(--color-accent, #f59e0b)", "#6b7280", "var(--color-primary, #1e3a5f)", "#9ca3af",
  ];
  const count = useApi && liveData?.gallery && liveData.gallery.length > 0
    ? Math.min(maxItems, liveData.gallery.length)
    : maxItems;
  const tiles = Array.from({ length: count }, (_, i) => colors[i % colors.length]);

  return (
    <section className="max-w-7xl mx-auto px-6 py-14">
      <div className="flex items-end justify-between mb-8">
        <div>
          {str(c.tag) && (
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>{str(c.tag)}</p>
          )}
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
            {str(c.heading, "Photo Gallery")}
          </h2>
        </div>
        <ViewAllLink enabled={showViewAll} />
      </div>
      <div className={`grid gap-3 ${colClass[cols]}`}>
        {tiles.map((bg, i) => (
          <div key={i} className="aspect-video rounded-xl overflow-hidden flex items-center justify-center text-white/40 text-sm font-medium" style={{ backgroundColor: bg }}>
            {useApi && liveData?.gallery?.[i]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={liveData.gallery[i].url} alt={liveData.gallery[i].caption || "Gallery photo"} className="w-full h-full object-cover" />
            ) : (
              ["📸", "🏫", "🎓", "📚", "⚽", "🎨", "🏆", "🎭", "🔬", "🚌", "🎶", "🧪"][i % 12]
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function TestimonialsSection({ c }: { c: C }) {
  const items = arr<{ quote: string; name: string; title: string; initials?: string }>(c.items);
  const cols = gridCols(c.columns, 3);
  const display = items.length > 0
    ? items
    : [
        { quote: "This school has given my child the best foundation for life. Highly recommended.", name: "Parent Name", title: "Parent of Grade 5 Student" },
        { quote: "The teachers are dedicated and the learning environment is excellent.", name: "Student Name", title: "Grade XII Science" },
        { quote: "Best school in the district. The facilities and teaching quality are outstanding.", name: "Alumni Name", title: "Class of 2075 BS" },
      ];

  return (
    <section className="py-14" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeading tag={c.tag} heading={str(c.heading, "What People Say")} />
        <div className={`grid gap-6 ${colClass[cols]}`}>
          {display.map((t, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border shadow-sm" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => <span key={s} className="text-yellow-400 text-sm">★</span>)}
              </div>
              <p className="text-gray-600 italic text-sm leading-relaxed mb-4">&ldquo;{str(t.quote)}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}>
                  {str(t.initials ?? t.name, "A").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--color-primary, #1e3a5f)" }}>{str(t.name)}</p>
                  <p className="text-xs text-gray-500">{str(t.title)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTASection({ c }: { c: C }) {
  return (
    <section className="py-16 px-6 text-center" style={{ backgroundColor: str(c.bg_color, "var(--color-primary, #1e3a5f)"), color: str(c.text_color, "#ffffff") }}>
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          {str(c.heading, "Join Our School Community")}
        </h2>
        {str(c.body ?? c.subheading) && <p className="opacity-80 mb-8 text-sm sm:text-base">{str(c.body ?? c.subheading)}</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {str(c.cta_primary) && (
            <span className="inline-block px-8 py-3 rounded-lg font-semibold text-white" style={{ backgroundColor: "var(--color-accent, #f59e0b)" }}>
              {str(c.cta_primary)}
            </span>
          )}
          {str(c.cta_secondary) && (
            <span className="inline-block px-8 py-3 rounded-lg font-semibold border-2 border-white/60">{str(c.cta_secondary)}</span>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function ResultsSection({ c }: { c: C }) {
  return (
    <section className="py-14 bg-white">
      <div className="max-w-xl mx-auto px-6 text-center">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
          {str(c.heading, "Check Your Result")}
        </h2>
        {str(c.subtitle) && <p className="text-gray-500 text-sm mb-6">{str(c.subtitle)}</p>}
        <div className="space-y-3 text-left">
          <input disabled placeholder="Roll Number" className="w-full border rounded-lg px-4 py-3 text-sm bg-gray-50" style={{ borderColor: "var(--color-border, #e5e7eb)" }} />
          <div className="grid grid-cols-2 gap-3">
            <input disabled placeholder="Class" className="w-full border rounded-lg px-4 py-3 text-sm bg-gray-50" style={{ borderColor: "var(--color-border, #e5e7eb)" }} />
            <input disabled placeholder="Year (BS)" className="w-full border rounded-lg px-4 py-3 text-sm bg-gray-50" style={{ borderColor: "var(--color-border, #e5e7eb)" }} />
          </div>
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-lg font-semibold text-white disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}
          >
            {str(c.button_text, "Check Result")}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-4">Form preview — students check results on your live site.</p>
      </div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────

function ContactSection({ c, liveData }: { c: C; liveData?: EditorLiveData }) {
  const school = liveData?.school;
  const showForm = bool(c.show_form, true);
  const showMap = bool(c.show_map, false);
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
          {str(c.subtitle) && <p className="text-gray-500 mt-2 text-sm">{str(c.subtitle)}</p>}
        </div>
        <div className={`grid gap-10 ${showMap ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-2"}`}>
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
          {showForm && (
            <div className={showMap ? "lg:col-span-1" : ""}>
              <div className="space-y-3" aria-hidden>
                <input type="text" placeholder="Your Name" className="w-full border rounded-lg px-4 py-3 text-sm bg-gray-50" disabled />
                <input type="email" placeholder="Email Address" className="w-full border rounded-lg px-4 py-3 text-sm bg-gray-50" disabled />
                <textarea rows={4} placeholder="Your message..." className="w-full border rounded-lg px-4 py-3 text-sm resize-none bg-gray-50" disabled />
                <button type="button" disabled className="w-full py-3 rounded-lg font-semibold text-white bg-gray-300 cursor-not-allowed">
                  Send Message (preview)
                </button>
                <p className="text-xs text-gray-400 text-center">Form preview — visitors on your live site can send real messages.</p>
              </div>
            </div>
          )}
          {showMap && (
            <div>
              <div className="rounded-xl overflow-hidden bg-gray-100 h-56 flex items-center justify-center text-gray-400 border" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
                {str(c.embed_url) ? (
                  <iframe src={str(c.embed_url)} className="w-full h-full" loading="lazy" title="Map" />
                ) : (
                  <div className="text-center"><p className="text-3xl mb-1">🗺️</p><p className="text-xs">Add a Map Embed URL in the properties panel</p></div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function SpacerSection({ c }: { c: C }) {
  return <div style={{ height: cssSize(c.height, "40px"), backgroundColor: str(c.bg_color, "#ffffff") }} />;
}

function DividerSection({ c }: { c: C }) {
  const style = str(c.style, "line"); // line | dots | wave
  const color = str(c.color, "#e5e7eb");
  const contained = str(c.width, "full") === "contained";
  return (
    <div className="py-6 bg-white" style={{ paddingLeft: contained ? "6rem" : undefined, paddingRight: contained ? "6rem" : undefined }}>
      {style === "dots" ? (
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
          ))}
        </div>
      ) : style === "wave" ? (
        <div className="text-center text-xl leading-none select-none" style={{ color }}>〜〜〜〜〜</div>
      ) : (
        <hr style={{ borderStyle: "solid", borderColor: color, borderTopWidth: "2px" }} />
      )}
    </div>
  );
}

function MapSection({ c }: { c: C }) {
  const showInfo = bool(c.show_contact_info, true);
  return (
    <section className="py-14 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {str(c.heading) && (
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--color-primary, #1e3a5f)" }}>{str(c.heading)}</h2>
        )}
        <div className="rounded-xl overflow-hidden bg-gray-100 h-64 flex items-center justify-center text-gray-400 border" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
          {str(c.embed_url) ? (
            <iframe src={str(c.embed_url)} className="w-full h-full" loading="lazy" title="Map" />
          ) : (
            <div className="text-center">
              <p className="text-4xl mb-2">🗺️</p>
              <p className="text-sm">Map will appear here</p>
              <p className="text-xs text-gray-400 mt-1">Add an embed URL in the properties panel</p>
            </div>
          )}
        </div>
        {showInfo && (str(c.address) || str(c.phone) || str(c.email)) && (
          <div className="mt-5 flex flex-wrap gap-4 justify-center text-sm text-gray-500">
            {str(c.address) && <span>📍 {str(c.address)}</span>}
            {str(c.phone) && <span>📞 {str(c.phone)}</span>}
            {str(c.email) && <span>✉️ {str(c.email)}</span>}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function EditorSectionRenderer({ section, liveData }: { section: SchoolSection; liveData?: EditorLiveData }) {
  const c = (section.content ?? {}) as C;

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
      return <FacilitiesSection c={c} liveData={liveData} />;
    case "notices":
      return <NoticesSection c={c} liveData={liveData} />;
    case "teachers":
      return <TeachersSection c={c} liveData={liveData} />;
    case "gallery":
      return <GallerySection c={c} liveData={liveData} />;
    case "testimonials":
      return <TestimonialsSection c={c} />;
    case "results":
      return <ResultsSection c={c} />;
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
