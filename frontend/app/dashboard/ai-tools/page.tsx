"use client";

import { PluginGate } from "@/lib/plugins";
import { Badge } from "@/components/ui/badge";
import { AOSPage, AOSPageHeader, AOSPageBody } from "@/components/aos/kit/page-kit";
import { FileQuestion, BookOpen, Calendar, MessageSquare, PenLine, Brain, Grid3X3, Gauge, Languages, Lightbulb, Mail, ClipboardList, ListOrdered, Accessibility, Rocket, Target, Megaphone, Users, Search, CalendarRange, Compass, CalendarDays, FlaskConical, Sparkles } from "lucide-react";
import Link from "next/link";

const AI_TOOLS = [
  { key: "question-paper", label: "AI Question Paper Generator", desc: "Generate exam papers with Bloom's taxonomy, chapter-wise balance", icon: FileQuestion },
  { key: "blueprint-builder", label: "Blueprint Builder", desc: "Design the marks grid of a paper before generating it", icon: Grid3X3 },
  { key: "lesson-plan", label: "AI Lesson Plan", desc: "Generate structured lesson plans for any subject and grade", icon: BookOpen },
  { key: "text-leveler", label: "Text Leveler", desc: "Rewrite any passage up or down reading levels for mixed-ability classes", icon: Gauge },
  { key: "vocab-support", label: "Vocabulary Builder", desc: "Bilingual EN/NE word banks for any unit", icon: Languages },
  { key: "lesson-hook", label: "Lesson Hook", desc: "5-minute openers that make a topic impossible to ignore", icon: Lightbulb },
  { key: "email-responder", label: "Email Responder", desc: "Professional parent/stakeholder replies from your bullet points", icon: Mail },
  { key: "meeting-minutes", label: "Meeting Minutes", desc: "Raw staff-meeting notes → decisions and action items", icon: ClipboardList },
  { key: "writing-scaffold", label: "Writing Scaffold", desc: "Step-by-step writing support with sentence starters", icon: ListOrdered },
  { key: "accommodation-finder", label: "Accommodation Finder", desc: "Barrier → practical classroom adjustments", icon: Accessibility },
  { key: "enrichment-planner", label: "Enrichment Planner", desc: "Stretch activities for early finishers — no busywork", icon: Rocket },
  { key: "choice-board", label: "UDL Choice Board", desc: "3×3 choice boards: show it, express it, make it matter", icon: Target },
  { key: "attendance-outreach", label: "Attendance Outreach", desc: "Kind, escalating guardian follow-up drafts", icon: Megaphone },
  { key: "conference-prep", label: "Conference Prep", desc: "PT meeting agendas with open questions", icon: Users },
  { key: "observation-feedback", label: "Observation Feedback", desc: "Balanced teacher feedback from your notes", icon: Search },
  { key: "annual-scheme", label: "Annual Scheme", desc: "Units across the Nepali academic year, festival-aware", icon: CalendarRange },
  { key: "transition-guide", label: "Transition Guide", desc: "Grade-transition prep for students and guardians", icon: Compass },
  { key: "exam-timetable-draft", label: "Exam Timetable Drafter", desc: "Draft schedules with clash checks — solver owns the final", icon: CalendarDays },
  { key: "practical-exam", label: "Practical Exam Builder", desc: "Lab tasks, materials and marking criteria", icon: FlaskConical },
  { key: "timetable", label: "AI Timetable Generator", desc: "Clash-free timetable in 30 seconds", icon: Calendar },
  { key: "report-remarks", label: "AI Report Remarks", desc: "Personalized report card comments per student", icon: MessageSquare },
  { key: "letter-writer", label: "AI Letter Writer", desc: "Generate school letters, notices, and circulars", icon: PenLine },
  { key: "insights", label: "AI School Insights", desc: "Weekly AI intelligence report on school performance", icon: Brain },
];

export default function AIToolsPage() {
  return (
    <PluginGate slug="ai_suite">
      <AIToolsContent />
    </PluginGate>
  );
}

function AIToolsContent() {
  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Sparkles className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="AI Tools Hub"
        subtitle={`${AI_TOOLS.length} AI-powered tools to save hours of manual work`}
      />
      <AOSPageBody>
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
