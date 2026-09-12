"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { PluginGate } from "@/lib/plugins";
import { api, type ApiResponse } from "@/lib/api";
import { GraduationCap, History, Play, ShieldAlert, TrendingUp, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  FormSection,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

// Quick links — the ai_teacher manifest subitem (Usage & Cost) plus the
// AI Suite surfaces and the curriculum the teacher is grounded in.
const QUICK_LINKS = [
  { label: "Usage & Cost", icon: "BarChart3", href: "/dashboard/analytics/ai-usage" },
  { label: "Teaching Content", icon: "BookOpen", href: "/dashboard/teaching-content" },
  { label: "AI Tools Hub", icon: "Sparkles", href: "/dashboard/ai-tools" },
  { label: "AI Workbench", icon: "Layers", href: "/dashboard/ai-workbench" },
];

type SectionSummary = {
  id: string;
  title_en: string;
  title_ne?: string | null;
  unit_id: string;
  grade?: string;
  estimated_minutes: number;
  published_version_no: number | null;
};

type Lesson = {
  id: string;
  topic: string;
  status: string;
  language: string;
  persona_slug: string;
  chapters_completed: number;
  duration_seconds: number | null;
  cost_npr: number | null;
  created_at: string;
};

type CreateLessonResponse = {
  lesson_id: string;
  player_url: string | null;
  socket_room: string;
  estimated_cost_npr: number;
  grounded: boolean;
};

function CreateLessonForm() {
  const qc = useQueryClient();
  const [sectionId, setSectionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [language, setLanguage] = useState("ne");
  const [persona, setPersona] = useState("aria");
  const [started, setStarted] = useState<CreateLessonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sections = useQuery({
    queryKey: ["ai-teacher-sections"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ items: SectionSummary[] }>>(
        "/teaching-content/sections"
      );
      return (res.data.data?.items || res.data.data || []) as SectionSummary[];
    },
  });

  const students = useQuery({
    queryKey: ["ai-teacher-students"],
    enabled: true,
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ items?: { id: string; full_name: string }[] }>>(
        "/students?per_page=100"
      );
      const data = res.data.data as unknown;
      return (Array.isArray(data) ? data : (data as { items?: { id: string; full_name: string }[] })?.items || []) as { id: string; full_name: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<CreateLessonResponse>>("/ai-teacher/lessons", {
        section_id: sectionId,
        student_id: studentId || undefined,
        language,
        persona_slug: persona,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setStarted(data);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["ai-teacher-lessons"] });
    },
    onError: (e) => {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Couldn't start the lesson."
      );
    },
  });

  if (sections.isLoading) return <PageLoader />;
  if (sections.isError)
    return <ErrorState title="Couldn't load curriculum content" onRetry={() => sections.refetch()} />;

  const published = (sections.data || []).filter((s) => s.published_version_no);

  return (
    <div className="space-y-4">
      {published.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No published teaching content yet"
          body="The AI teacher only teaches published curriculum. Ask your admin to author sections under Teaching Content."
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-sm font-medium">Chapter section</span>
            <AdvancedSelect
              value={sectionId}
              onChange={(v) => setSectionId(v)}
              clearable
              placeholder="Choose a section…"
              options={published.map((s) => ({ value: s.id, label: s.title_en + (s.title_ne ? ` — ${s.title_ne}` : "") }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Student</span>
            <AdvancedSelect
              value={studentId}
              onChange={(v) => setStudentId(v)}
              clearable
              searchable
              placeholder="Choose a student…"
              options={(students.data || []).map((st) => ({ value: st.id, label: st.full_name }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Language</span>
            <AdvancedSelect
              value={language}
              onChange={(v) => setLanguage(v)}
              options={[
                { value: "ne", label: "नेपाली (Nepali)" },
                { value: "mixed", label: "Mixed (Nepali speech, English terms)" },
                { value: "en", label: "English" },
              ]}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Teacher persona</span>
            <AdvancedSelect
              value={persona}
              onChange={(v) => setPersona(v)}
              options={[
                { value: "aria", label: "ARIA — warm, analogy-first" },
                { value: "max", label: "Max — coach energy" },
                { value: "sophia", label: "Sophia — rigorous, first-principles" },
                { value: "leo", label: "Leo — story-first" },
                { value: "nova", label: "Nova — visual, data-first" },
              ]}
            />
          </label>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button
              onClick={() => create.mutate()}
              disabled={!sectionId || !studentId || create.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {create.isPending ? "Preparing lesson…" : "Start lesson"}
            </Button>
            {error && <p className="text-sm" style={{ color: "#c42b1c" }}>{error}</p>}
          </div>
          {started && (
            <div
              className="md:col-span-2 win11-card"
              style={{ borderColor: "var(--w11-accent)" }}
            >
              <div className="py-2 space-y-2">
                <p className="text-sm font-medium">Lesson is ready.</p>
                <p className="text-xs text-[color:var(--w11-text-secondary)]">
                  Estimated cost before start: NPR {started.estimated_cost_npr}
                  {started.grounded ? " • grounded in published content" : " • free topic"}
                </p>
                {started.player_url ? (
                  <a href={started.player_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm">Open the AI Teacher player</Button>
                  </a>
                ) : (
                  <p className="text-xs text-[color:var(--w11-text-secondary)]">
                    The lesson player URL appears once the school finishes service setup.
                    Lesson state still records in history.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LessonHistory() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["ai-teacher-lessons"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Lesson[]>>("/ai-teacher/lessons");
      return res.data.data || [];
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState title="Couldn't load lesson history" onRetry={() => refetch()} />;

  const lessons = data || [];
  if (lessons.length === 0)
    return <EmptyState icon={History} title="No lessons yet" body="Started lessons appear here with mastery and cost." />;

  return (
    <div className="space-y-2">
      {lessons.map((l) => (
        <div key={l.id} className="flex items-center justify-between border-b border-[color:var(--w11-border-subtle)] py-2 last:border-0">
          <div>
            <p className="text-sm font-medium">{l.topic}</p>
            <p className="text-xs text-[color:var(--w11-text-secondary)]">
              {l.persona_slug} • {l.language.toUpperCase()} •{" "}
              {l.chapters_completed} chapters
              {l.duration_seconds ? ` • ${Math.round(l.duration_seconds / 60)} min` : ""}
              {l.cost_npr ? ` • NPR ${l.cost_npr}` : ""}
            </p>
          </div>
          <StatusChip status={l.status} />
        </div>
      ))}
    </div>
  );
}

function MasterySnapshot() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ai-teacher-usage"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{
        lessons_this_month: number;
        minutes_this_month: number;
        cost_npr_this_month: number;
        ceiling_npr: number;
        ceiling_used_pct: number | null;
        alert: boolean;
      }>>("/ai-teacher/usage");
      return res.data.data;
    },
  });

  if (isLoading || isError) return null;
  if (!data) return null;
  return (
    <div>
      <StatGrid min={160}>
        <KpiCard
          label="Lessons"
          value={data.lessons_this_month}
          icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        />
        <KpiCard label="Minutes" value={data.minutes_this_month} />
        <KpiCard
          label="of ceiling"
          value={data.ceiling_used_pct != null ? `${data.ceiling_used_pct}%` : `NPR ${data.cost_npr_this_month}`}
          footnote={data.ceiling_used_pct != null && `(NPR ${data.cost_npr_this_month})`}
        />
      </StatGrid>
      {data.alert && (
        <div className="win11-infobar warning flex items-center gap-2 px-3 py-2 text-xs">
          <ShieldAlert className="h-4 w-4" /> Cost ceiling alert — review the AI Teacher budget.
        </div>
      )}
    </div>
  );
}

export default function AiTeacherPage() {
  return (
    <PluginGate slug="ai_teacher">
      <AOSPage>
        <AOSPageHeader
          icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="AI Teacher"
          subtitle="A live AI teacher that speaks and writes on a whiteboard — grounded strictly in your published curriculum."
          actions={
            <Link href="/dashboard/ai-teacher/content">
              <Button variant="outline" size="sm">Teaching Content →</Button>
            </Link>
          }
        />
        <AOSPageBody>
          {/* Dashboard — KPIs (existing usage snapshot) + quick links */}
          <MasterySnapshot />

          {/* Quick links — 44px gradient icon tile + label, as next/link */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {QUICK_LINKS.map((l) => {
              const Icon = ICON_MAP[l.icon] || ChevronRight;
              return (
                <Link key={l.href} href={l.href} className="block h-full">
                  <div
                    className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                    style={{ cursor: "pointer", marginBottom: 0 }}
                  >
                    <div
                      className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        background: SECTION_GRADIENTS.Learning,
                        boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                      {l.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <FormSection title="Start a lesson">
            <CreateLessonForm />
          </FormSection>

          <DataPanel title="Lesson history">
            <LessonHistory />
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    </PluginGate>
  );
}
