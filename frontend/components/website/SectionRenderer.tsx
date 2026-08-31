"use client";

/**
 * SectionRenderer — renders a SchoolSection exactly as it appears on the public site.
 * Used by both the website builder editor preview and optionally the public site.
 */

import { useState, useEffect, type FormEvent } from "react";

import { HeroSlideshow } from "@/components/website/HeroSlideshow";
import { SchoolStats } from "@/components/website/SchoolStats";
import { ProgramCards } from "@/components/website/ProgramCards";
import { PrincipalMessage } from "@/components/website/PrincipalMessage";
import { AdmissionCTA } from "@/components/website/AdmissionCTA";
import { Testimonials } from "@/components/website/Testimonials";
// import removed
import type { SchoolSection } from "@/lib/school-website/types";

type C = Record<string, any>;
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

export interface LiveData {
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
  const showVision = bool(c.show_vision, true);
  const showMission = bool(c.show_mission, false);

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
              // about_us is sanitized server-side (app/school/[slug]/page.tsx) before it
              // crosses the client boundary — importing sanitizeHtml (isomorphic-dompurify →
              // jsdom) here broke the client bundle and 500-ed every public site render.
              dangerouslySetInnerHTML={{ __html: str(school?.about_us) }}
            />
          ) : (
            <p className="text-gray-600 leading-relaxed">
              {str(c.body, "We are a reputed educational institution dedicated to excellence in education and holistic development of students.")}
            </p>
          )}
          {showVision && (school?.vision || c.vision) && (
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
  const maxItems = Math.min(12, Math.max(1, int(c.max_items, 6)));
  const display = (items.length > 0 ? items : [
    { icon: "📚", name: "Primary Level", desc: "Grades 1–5, strong foundations", grade: "1–5" },
    { icon: "🔬", name: "Secondary Level", desc: "Grades 9–10, NEB curriculum", grade: "9–10" },
    { icon: "🎓", name: "Higher Secondary", desc: "Grades 11–12, Science & Management", grade: "11–12" },
  ]).slice(0, maxItems);

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
        <div className={`grid gap-6 ${colClass[gridCols(c.columns, 3)]}`}>
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
  const maxItems = Math.min(12, Math.max(1, int(c.max_items, 6)));
  const display = (items.length > 0 ? items : [
    { icon: "🖥️", name: "Computer Lab", desc: "Modern computers with high-speed internet" },
    { icon: "📚", name: "Library", desc: "Well-stocked library with digital resources" },
    { icon: "🔬", name: "Science Lab", desc: "Physics, chemistry and biology labs" },
    { icon: "🏆", name: "Sports", desc: "Indoor and outdoor sports facilities" },
    { icon: "🚌", name: "Transport", desc: "Safe transport covering all major routes" },
    { icon: "🎨", name: "Arts & Culture", desc: "Arts, music and cultural programs" },
  ]).slice(0, maxItems);

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
        <div className={`grid gap-6 ${colClass[gridCols(c.columns, 3)]}`}>
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
  const layout = str(c.layout, "grid"); // grid | list | sidebar
  const maxItems = Math.min(12, Math.max(1, int(c.max_items, 6)));
  const showViewAll = bool(c.show_view_all, true);
  const liveNotices = liveData?.notices;
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
        return {
          title: n.title,
          date: isNaN(d.getTime())
            ? ""
            : d.toLocaleDateString("en", { month: "short", day: "2-digit", year: "numeric" }),
          cat: str((n as { category?: string }).category, "Notice"),
        };
      })
    : placeholders;
  const display = source.slice(0, maxItems);

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
          {showViewAll && liveData?.school?.slug && (
            <a href={`/school/${liveData.school.slug}/notices`} className="text-sm font-semibold hover:underline" style={{ color: "var(--color-accent, #f59e0b)" }}>View All</a>
          )}
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
                {n.cat && (
                  <span className="text-xs px-2 py-0.5 rounded-full mb-2 inline-block" style={{ backgroundColor: "var(--color-surface, #f3f4f6)", color: "var(--color-primary, #1e3a5f)" }}>
                    {n.cat}
                  </span>
                )}
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

function TeachersSection({ c, liveData }: { c: C; liveData?: LiveData }) {
  const maxItems = Math.min(12, Math.max(1, int(c.max_items, 4)));
  const showViewAll = bool(c.show_view_all, true);
  const liveTeachers = liveData?.teachers;
  const source = liveTeachers && liveTeachers.length > 0
    ? liveTeachers.map((t) => ({ name: t.name, role: t.designation || t.subject || "Teacher", photo: t.photo || "" }))
    : ["Ram Prasad Sharma", "Sita Devi Thapa", "Hari Bahadur KC", "Gita Kumari Shrestha"].map((n) => ({ name: n, role: "Teacher", photo: "" }));
  const display = source.slice(0, maxItems);

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
          {showViewAll && liveData?.school?.slug && (
            <a href={`/school/${liveData.school.slug}/teachers`} className="text-sm font-semibold hover:underline hidden sm:block" style={{ color: "var(--color-primary, #1e3a5f)" }}>View All</a>
          )}
        </div>
        <div className={`grid gap-5 ${colClass[gridCols(c.columns, 4)]}`}>
          {display.map((t, i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-center p-5 border border-gray-100">
              {t.photo ? (
                <img src={t.photo} alt={t.name} className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-gray-100 mb-3" />
              ) : (
                <div
                  className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white mb-3"
                  style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}
                >
                  {t.name.charAt(0)}
                </div>
              )}
              <p className="font-semibold text-sm" style={{ color: "var(--color-primary, #1e3a5f)" }}>{t.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

function GallerySection({ c, liveData }: { c: C; liveData?: LiveData }) {
  const cols = gridCols(c.columns, 3);
  const maxItems = Math.min(12, Math.max(1, int(c.max_items, 6)));
  const showViewAll = bool(c.show_view_all, true);
  const liveGallery = liveData?.gallery;
  const colors = [
    "var(--color-primary, #1e3a5f)", "var(--color-secondary, #2e6da4)",
    "var(--color-accent, #f59e0b)", "#6b7280", "var(--color-primary, #1e3a5f)", "#9ca3af",
  ];
  const emojis = ["📸", "🏫", "🎓", "📚", "⚽", "🎨", "🏆", "🎭", "🔬", "🚌", "🎶", "🧪"];
  const tiles = Array.from({ length: maxItems }, (_, i) => ({
    color: colors[i % colors.length],
    emoji: emojis[i % 12],
    item: liveGallery && liveGallery.length > 0 ? liveGallery[i % liveGallery.length] : undefined,
  }));

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
        {showViewAll && liveData?.school?.slug && (
          <a href={`/school/${liveData.school.slug}/gallery`} className="text-sm font-semibold hover:underline hidden sm:block" style={{ color: "var(--color-primary, #1e3a5f)" }}>View All</a>
        )}
      </div>
      <div className={`grid gap-3 ${colClass[cols]}`}>
        {tiles.map((t, i) => (
          <div key={i} className="aspect-video rounded-xl overflow-hidden flex items-center justify-center text-white/40 text-sm font-medium" style={{ backgroundColor: t.color }}>
            {t.item?.url ? (
              <img src={t.item.url} alt={t.item.caption || "Gallery photo"} className="w-full h-full object-cover" />
            ) : (
              t.emoji
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
  const maxItems = Math.min(12, Math.max(1, int(c.max_items, 6)));
  const display = (items.length > 0 ? items : [
    { quote: "This school has given my child the best foundation for life. Highly recommended.", name: "Parent Name", title: "Parent of Grade 5 Student" },
    { quote: "The teachers are dedicated and the learning environment is excellent.", name: "Student Name", title: "Grade XII Science" },
    { quote: "Best school in the district. The facilities and teaching quality are outstanding.", name: "Alumni Name", title: "Class of 2075 BS" },
  ]).slice(0, maxItems);

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
        <div className={`grid gap-6 ${colClass[gridCols(c.columns, 3)]}`}>
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
        {str(c.body ?? c.subheading) && (
          <p className="opacity-80 mb-8 text-sm sm:text-base">{str(c.body ?? c.subheading)}</p>
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
  const autoPlay = bool(c.auto_play, true);
  const interval = Math.max(2000, int(c.interval, 5000));
  const opacity = Math.min(1, Math.max(0, typeof c.overlay_opacity === "number" ? c.overlay_opacity : 0.55));
  const display = slides.length > 0 ? slides : [
    { title: "Welcome to Our School", subtitle: "Excellence in Education", cta_text: "Apply Now" },
    { title: "Building Tomorrow's Leaders", subtitle: "Holistic Development", cta_text: "Learn More" },
    { title: "Join Our Community", subtitle: "Admissions Open", cta_text: "Contact Us" },
  ];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!autoPlay || display.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % display.length), interval);
    return () => clearInterval(t);
  }, [autoPlay, interval, display.length]);

  const slide = display[Math.min(idx, display.length - 1)];

  return (
    <section
      className="relative flex items-center justify-center text-white text-center overflow-hidden"
      style={{
        minHeight: cssSize(c.height, "420px"),
        background: slide.image
          ? `linear-gradient(rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity})), url(${slide.image}) center/cover no-repeat`
          : `linear-gradient(rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity})), linear-gradient(135deg, var(--color-primary, #1e3a5f) 0%, var(--color-secondary, #2e6da4) 100%)`,
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
        {display.length > 1 && (
          <div className="flex gap-2 justify-center mt-8">
            {display.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-white" : "w-2 bg-white/40"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Contact ─────────────────────────────────────────────────────────────────

/** Live contact form — POSTs to the public contact endpoint. On the website
 *  builder editor canvas (no school slug in liveData) it renders as an honest
 *  disabled preview instead of a form that goes nowhere. */
function ContactFormSection({ slug }: { slug: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSending(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/v1/website/public/${slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          phone: fd.get("phone"),
          email: fd.get("email"),
          message: fd.get("message"),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to send message");
      } else {
        setSent(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="border rounded-lg p-6 text-center" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
        <div className="text-3xl mb-2">✅</div>
        <p className="font-semibold text-sm">Message Sent!</p>
        <p className="text-gray-500 text-xs mt-1">Thank you — the school will get back to you soon.</p>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <input name="name" type="text" required placeholder="Your Name" className="w-full border rounded-lg px-4 py-3 text-sm" />
      <input name="email" type="email" placeholder="Email Address" className="w-full border rounded-lg px-4 py-3 text-sm" />
      <input name="phone" type="tel" placeholder="Phone (optional)" className="w-full border rounded-lg px-4 py-3 text-sm" />
      <textarea name="message" required rows={4} placeholder="Your message..." className="w-full border rounded-lg px-4 py-3 text-sm resize-none" />
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}
      >
        {sending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}

function ContactSection({ c, liveData }: { c: C; liveData?: LiveData }) {
  const school = liveData?.school;
  const slug = school?.slug;
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
          {c.subheading && <p className="text-gray-500 mt-2 text-sm">{str(c.subheading)}</p>}
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
              {slug ? (
                <ContactFormSection slug={slug} />
              ) : (
                <div className="space-y-3" aria-hidden>
                  <input type="text" placeholder="Your Name" className="w-full border rounded-lg px-4 py-3 text-sm bg-gray-50" disabled />
                  <input type="email" placeholder="Email Address" className="w-full border rounded-lg px-4 py-3 text-sm bg-gray-50" disabled />
                  <textarea rows={4} placeholder="Your message..." className="w-full border rounded-lg px-4 py-3 text-sm resize-none bg-gray-50" disabled />
                  <button type="button" disabled className="w-full py-3 rounded-lg font-semibold text-white bg-gray-300 cursor-not-allowed">
                    Send Message (preview)
                  </button>
                  <p className="text-xs text-gray-400 text-center">Form preview — visitors on your live site can send real messages.</p>
                </div>
              )}
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

// ─── Spacer / Divider / Map ───────────────────────────────────────────────────

function SpacerSection({ c }: { c: C }) {
  return <div style={{ height: cssSize(c.height, "40px"), backgroundColor: str(c.bg_color, "#ffffff") }} />;
}

function DividerSection({ c }: { c: C }) {
  const style = str(c.style, "line"); // line | dots | wave (legacy "solid"/"dashed"/"dotted" still work)
  const color = str(c.color, "var(--color-border, #e5e7eb)");
  const contained = str(c.width, "full") === "contained";
  const lineStyle = ["solid", "dashed", "dotted"].includes(style) ? style : "solid";
  return (
    <div className="py-6 px-6 bg-white" style={contained ? { paddingLeft: "6rem", paddingRight: "6rem" } : undefined}>
      {style === "dots" ? (
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
          ))}
        </div>
      ) : style === "wave" ? (
        <div className="text-center text-xl leading-none select-none" style={{ color }}>〜〜〜〜〜</div>
      ) : (
        <hr style={{ borderStyle: lineStyle as "solid" | "dashed" | "dotted", borderColor: color, borderTopWidth: "2px" }} />
      )}
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

/** Public results checker card — routes students to the school's results page. */
function ResultsSection({ c, liveData }: { c: C; liveData?: LiveData }) {
  const slug = liveData?.school?.slug;
  return (
    <section className="py-14 bg-white">
      <div className="max-w-xl mx-auto px-6 text-center">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary, #1e3a5f)" }}>
          {str(c.heading, "Check Your Result")}
        </h2>
        {str(c.subtitle) && <p className="text-gray-500 text-sm mb-6">{str(c.subtitle)}</p>}
        {slug ? (
          <a
            href={`/school/${slug}/results`}
            className="inline-block px-8 py-3 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}
          >
            {str(c.button_text, "Check Result")}
          </a>
        ) : (
          <span
            className="inline-block px-8 py-3 rounded-lg font-semibold text-white"
            style={{ backgroundColor: "var(--color-primary, #1e3a5f)" }}
          >
            {str(c.button_text, "Check Result")}
          </span>
        )}
      </div>
    </section>
  );
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

export function SectionRenderer({ section, liveData }: { section: SchoolSection; liveData?: LiveData }) {
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
      return <FacilitiesSection c={c} />;
    case "notices":
      return <NoticesSection c={c} liveData={liveData} />;
    case "teachers":
      return <TeachersSection c={c} liveData={liveData} />;
    case "gallery":
      return <GallerySection c={c} liveData={liveData} />;
    case "testimonials":
      return <TestimonialsSection c={c} />;
    case "results":
      return <ResultsSection c={c} liveData={liveData} />;
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
