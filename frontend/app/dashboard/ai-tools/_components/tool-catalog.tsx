"use client";

/**
 * ToolCatalog — the AI-tools card grid, shared by /dashboard/ai-tools and the
 * AI Hub Tools tab (wave-H; AI-pillar consolidation, Part 10.4 / DUP §3).
 *
 * Research notes:
 * 1. MagicSchool hub pattern (Part 4.3-5, frontend §15): category-scoped tool
 *    cards with one-line outcomes, searched/filtered from one box — hub is a
 *    launcher, not a dashboard-of-everything (A5 rule).
 * 2. Diffit-style single-purpose cards: clicking opens the dedicated tool page
 *    (deep URLs /dashboard/ai-tools/* stay exactly as they are, 10.4) — the
 *    card itself carries the promise ("what you get"), the page carries the
 *    inputs.
 *
 * The catalog is client-derived from the real sub-app list — counts are real
 * route counts, never invented numbers (Part 2.8 honesty).
 */

import { useMemo, useState } from "react";
import {
  FileQuestion, BookOpen, Calendar, MessageSquare, PenLine, Brain, Grid3X3, Gauge, Languages, Lightbulb, Mail, ClipboardList, ListOrdered, Accessibility, Rocket, Target, Megaphone, Users, Search, CalendarRange, Compass, CalendarDays, FlaskConical, Sparkles, Route, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiCard, StatGrid } from "@/components/aos/kit/page-kit";

export type ToolGroup = "planning" | "assessment" | "communication" | "insights";

export const GROUP_LABELS: Record<ToolGroup, string> = {
  planning: "Teaching & Planning",
  assessment: "Assessment & Exams",
  communication: "Communication & Admin",
  insights: "School Intelligence",
};

const GROUP_COLORS: Record<ToolGroup, string> = {
  planning: "var(--w11-accent)",
  assessment: "#107c10",
  communication: "#d83b01",
  insights: "#7c3aed",
};

export interface ToolDef {
  key: string;
  label: string;
  /** What you get, one line — the card promise. */
  desc: string;
  icon: typeof Sparkles;
  group: ToolGroup;
}

export const AI_TOOLS: ToolDef[] = [
  { key: "question-paper", label: "AI Question Paper Generator", desc: "Generate exam papers with Bloom's taxonomy, chapter-wise balance", icon: FileQuestion, group: "assessment" },
  { key: "blueprint-builder", label: "Blueprint Builder", desc: "Design the marks grid of a paper before generating it", icon: Grid3X3, group: "assessment" },
  { key: "lesson-plan", label: "AI Lesson Plan", desc: "Generate structured lesson plans for any subject and grade", icon: BookOpen, group: "planning" },
  { key: "text-leveler", label: "Text Leveler", desc: "Rewrite any passage up or down reading levels for mixed-ability classes", icon: Gauge, group: "planning" },
  { key: "vocab-support", label: "Vocabulary Builder", desc: "Bilingual EN/NE word banks for any unit", icon: Languages, group: "planning" },
  { key: "lesson-hook", label: "Lesson Hook", desc: "5-minute openers that make a topic impossible to ignore", icon: Lightbulb, group: "planning" },
  { key: "email-responder", label: "Email Responder", desc: "Professional parent/stakeholder replies from your bullet points", icon: Mail, group: "communication" },
  { key: "meeting-minutes", label: "Meeting Minutes", desc: "Raw staff-meeting notes → decisions and action items", icon: ClipboardList, group: "communication" },
  { key: "writing-scaffold", label: "Writing Scaffold", desc: "Step-by-step writing support with sentence starters", icon: ListOrdered, group: "planning" },
  { key: "accommodation-finder", label: "Accommodation Finder", desc: "Barrier → practical classroom adjustments", icon: Accessibility, group: "planning" },
  { key: "enrichment-planner", label: "Enrichment Planner", desc: "Stretch activities for early finishers — no busywork", icon: Rocket, group: "planning" },
  { key: "choice-board", label: "UDL Choice Board", desc: "3×3 choice boards: show it, express it, make it matter", icon: Target, group: "planning" },
  { key: "attendance-outreach", label: "Attendance Outreach", desc: "Kind, escalating guardian follow-up drafts", icon: Megaphone, group: "communication" },
  { key: "conference-prep", label: "Conference Prep", desc: "PT meeting agendas with open questions", icon: Users, group: "communication" },
  { key: "observation-feedback", label: "Observation Feedback", desc: "Balanced teacher feedback from your notes", icon: Search, group: "communication" },
  { key: "annual-scheme", label: "Annual Scheme", desc: "Units across the Nepali academic year, festival-aware", icon: CalendarRange, group: "planning" },
  { key: "transition-guide", label: "Transition Guide", desc: "Grade-transition prep for students and guardians", icon: Compass, group: "planning" },
  { key: "exam-timetable-draft", label: "Exam Timetable Drafter", desc: "Draft schedules with clash checks — solver owns the final", icon: CalendarDays, group: "assessment" },
  { key: "practical-exam", label: "Practical Exam Builder", desc: "Lab tasks, materials and marking criteria", icon: FlaskConical, group: "assessment" },
  { key: "timetable", label: "AI Timetable Generator", desc: "Clash-free timetable in 30 seconds", icon: Calendar, group: "planning" },
  { key: "report-remarks", label: "AI Report Remarks", desc: "Personalized report card comments per student", icon: MessageSquare, group: "assessment" },
  { key: "letter-writer", label: "AI Letter Writer", desc: "Generate school letters, notices, and circulars", icon: PenLine, group: "communication" },
  { key: "insights", label: "AI School Insights", desc: "Weekly AI intelligence report on school performance", icon: Brain, group: "insights" },
  { key: "learning-paths", label: "Adaptive Learning Paths", desc: "Personalized study paths that adapt to each student's mastery", icon: Route, group: "planning" },
  { key: "progress", label: "Student Progress", desc: "Track class and student progress across assessments", icon: TrendingUp, group: "assessment" },
];

export function ToolCatalog({ compact }: { compact?: boolean }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<"all" | ToolGroup>("all");

  const shown = useMemo(
    () =>
      AI_TOOLS.filter(
        (t) =>
          (group === "all" || t.group === group) &&
          (!q.trim() || (t.label + " " + t.desc).toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [q, group],
  );

  const count = (g: ToolGroup) => AI_TOOLS.filter((t) => t.group === g).length;

  return (
    <div className="space-y-4">
      {!compact && (
        <StatGrid>
          <KpiCard label="AI Tools" value={AI_TOOLS.length} color="var(--w11-accent)" icon={<Sparkles className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />} />
          {(Object.keys(GROUP_LABELS) as ToolGroup[]).map((g) => (
            <KpiCard
              key={g}
              label={GROUP_LABELS[g]}
              value={count(g)}
              color={GROUP_COLORS[g]}
              icon={<span className="h-4 w-4" style={{ background: GROUP_COLORS[g], borderRadius: 4, display: "inline-block" }} />}
            />
          ))}
        </StatGrid>
      )}

      {/* Search + category chips (MagicSchool launcher pattern) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--w11-text-secondary)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tools…"
            className="pl-8"
            aria-label="Search AI tools"
          />
        </div>
        <Button variant={group === "all" ? "default" : "outline"} size="sm" onClick={() => setGroup("all")}>
          All
        </Button>
        {(Object.keys(GROUP_LABELS) as ToolGroup[]).map((g) => (
          <Button
            key={g}
            variant={group === g ? "default" : "outline"}
            size="sm"
            onClick={() => setGroup(g)}
            style={group === g ? { background: GROUP_COLORS[g], borderColor: GROUP_COLORS[g] } : undefined}
          >
            {GROUP_LABELS[g]}
          </Button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-[color:var(--w11-text-secondary)]">
          No tools match “{q}” — clear the search or pick another category.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((tool) => (
            <Link key={tool.key} href={`/dashboard/ai-tools/${tool.key}`} className="win11-card interactive" style={{ marginBottom: 0 }}>
              <div className="p-5 flex items-start gap-4">
                <div
                  className="p-3 rounded-lg shrink-0"
                  style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}
                >
                  <tool.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[color:var(--w11-text-primary)]">{tool.label}</h3>
                  <p className="text-sm mt-1 text-[color:var(--w11-text-secondary)]">{tool.desc}</p>
                  <Badge variant="secondary" className="mt-2">AI Powered</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
