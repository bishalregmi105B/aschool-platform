"use client";

import { PluginGate } from "@/lib/plugins";
import { Badge } from "@/components/ui/badge";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
} from "@/components/aos/kit/page-kit";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { FileQuestion, BookOpen, Calendar, MessageSquare, PenLine, Brain, Grid3X3, Gauge, Languages, Lightbulb, Mail, ClipboardList, ListOrdered, Accessibility, Rocket, Target, Megaphone, Users, Search, CalendarRange, Compass, CalendarDays, FlaskConical, Sparkles, Route, TrendingUp } from "lucide-react";
import Link from "next/link";

// Functional groups — used for the hub KPI counts (client-computed from the
// real sub-app list, never invented).
type ToolGroup = "planning" | "assessment" | "communication" | "insights";

const GROUP_LABELS: Record<ToolGroup, string> = {
  planning: "Teaching & Planning",
  assessment: "Assessment & Exams",
  communication: "Communication & Admin",
  insights: "School Intelligence",
};

const AI_TOOLS: { key: string; label: string; desc: string; icon: typeof Sparkles; group: ToolGroup }[] = [
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

const GROUP_COLORS: Record<ToolGroup, string> = {
  planning: "var(--w11-accent)",
  assessment: "#107c10",
  communication: "#d83b01",
  insights: "#7c3aed",
};

export default function AIToolsPage() {
  return (
    <PluginGate slug="ai_suite">
      <AIToolsContent />
    </PluginGate>
  );
}

function AIToolsContent() {
  const groupCount = (g: ToolGroup) => AI_TOOLS.filter((t) => t.group === g).length;

  const kpis = [
    { label: "AI Tools", value: AI_TOOLS.length, color: "var(--w11-accent)", icon: <Sparkles className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /> },
    { label: GROUP_LABELS.planning, value: groupCount("planning"), color: GROUP_COLORS.planning, icon: <BookOpen className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /> },
    { label: GROUP_LABELS.assessment, value: groupCount("assessment"), color: GROUP_COLORS.assessment, icon: <ClipboardList className="h-4 w-4" style={{ color: "#107c10" }} /> },
    { label: GROUP_LABELS.communication, value: groupCount("communication"), color: GROUP_COLORS.communication, icon: <Megaphone className="h-4 w-4" style={{ color: "#d83b01" }} /> },
    { label: GROUP_LABELS.insights, value: groupCount("insights"), color: GROUP_COLORS.insights, icon: <Brain className="h-4 w-4" style={{ color: "#7c3aed" }} /> },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Sparkles className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="AI Tools Hub"
        subtitle={`${AI_TOOLS.length} AI-powered tools to save hours of manual work`}
      />
      <AOSPageBody>
        {/* Dashboard — KPI stat grid (counts of the real sub-app list) */}
        <StatGrid>
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} icon={k.icon} />
          ))}
        </StatGrid>

        {/* Quick links — every sub-app, 44px Sparkles/Brain gradient tiles,
            label 13px/600, as next/link */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {AI_TOOLS.map((tool) => {
            const TileIcon =
              tool.group === "insights" || tool.key === "learning-paths" || tool.key === "progress"
                ? Brain
                : Sparkles;
            return (
              <Link key={tool.key} href={`/dashboard/ai-tools/${tool.key}`} className="block h-full">
                <div
                  className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                  style={{ cursor: "pointer", marginBottom: 0 }}
                >
                  <div
                    className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      background: SECTION_GRADIENTS.Insights,
                      boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                    }}
                  >
                    <TileIcon className="h-5 w-5" />
                  </div>
                  <span className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                    {tool.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Full catalog with descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AI_TOOLS.map((tool) => (
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
      </AOSPageBody>
    </AOSPage>
  );
}
