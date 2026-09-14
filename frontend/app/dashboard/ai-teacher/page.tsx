"use client";

/**
 * AI Teacher — launch page for the live whiteboard teacher (ai_teacher plugin).
 *
 * Research:
 * 1. Live-class AI tools need visible lifecycle (MagicSchool/Diffit): a
 *    lesson is not "running or not" — it moves pending→ready→teaching→ended,
 *    and a paused/failed state must read differently. A StatusTimeline of the
 *    most-recent lesson makes that legible at a glance (31.0 "what's the
 *    state").
 * 2. Cost honesty (Part 2.8 / corpus): a whiteboard lesson streams speech +
 *    vision frames; the usage panel (Lessons · Minutes · % of monthly ceiling)
 *    and a per-lesson NPR figure on every history row are real, never
 *    rounded-up marketing numbers. The picker stays the same flow; the
 *    advanced persona/language fields stay in the same FormSection.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { AppGate } from "@/lib/apps";
import { api, type ApiResponse } from "@/lib/api";
import { GraduationCap, History, Play, ShieldAlert, TrendingUp, DollarSign, ArrowLeft } from "lucide-react";
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

const QUICK_LINKS = [
  { label: "Usage & Cost", icon: "BarChart3", href: "/dashboard/analytics/ai-usage" },
  { label: "Teaching Content", icon: "BookOpen", href: "/dashboard/teaching-content" },
  { label: "AI Hub · Tools", icon: "Sparkles", href: "/dashboard/ai?tab=tools" },
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

function CreateLessonForm({ onStarted }: { onStarted?: () => void }) {
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
        "/teaching-content/sections",
      );
      return (res.data.data?.items || res.data.data || []) as SectionSummary[];
    },
  });

  const students = useQuery({
    queryKey: ["ai-teacher-students"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ items?: { id: string; full_name: string }[] }>>(
        "/students?per_page=100",
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
      onStarted?.();
      void qc.invalidateQueries({ queryKey: ["ai-teacher-lessons"] });
    },
    onError: (e) => {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Couldn't start the lesson.",
      );
    },
  });

  if (sections.isLoading) return <PageLoader />;
  if (sections.isError)
    return <ErrorState title="Couldn't load curriculum content" onRetry={() => sections.refetch()} />;

  const published = (sections.data || []).filter((s) => s.published_version_no);
  const sectionTitle = published.find((s) => s.id === sectionId)?.title_en;

  return (
    <div className="space-y-4">
      {published.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          variant="dependency"
          title="No published teaching content yet"
          body="The AI teacher only teaches published curriculum. Author sections under Teaching Content, then publish one."
          action={{ label: "Open Teaching Content", href: "/dashboard/teaching-content" }}
          size="sm"
        />
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium">Chapter section</span>
              <AdvancedSelect
                value={sectionId}
                onChange={(v) => setSectionId(v)}
                clearable
                searchable
                placeholder="Choose a section…"
                options={published.map((s) => ({ value: s.id, label: s.title_en + (s.title_ne ? ` — ${s.title_ne}` : "") }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Student (optional)</span>
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
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => create.mutate()} disabled={!sectionId || create.isPending}>
              {create.isPending ? <TrendingUp className="h-4 w-4 mr-2 animate-pulse" /> : <Play className="h-4 w-4 mr-2" />}
              {create.isPending ? "Preparing lesson…" : "Start lesson"}
            </Button>
            <span className="text-xs text-[color:var(--w11-text-secondary)]">
              {sectionTitle ? `Grounded in: ${sectionTitle}` : "Grounded strictly in your published curriculum."}
            </span>
          </div>
          {error && <div className="win11-infobar error p-3 text-sm">{error}</div>}

          {started && (
            <div className="win11-card" style={{ borderColor: "var(--w11-accent)", marginBottom: 0 }}>
              <div className="p-4 space-y-2">
                <p className="text-sm font-medium">Lesson is ready.</p>
                <p className="text-xs text-[color:var(--w11-text-secondary)]">
                  Estimated cost before start: NPR {started.estimated_cost_npr}
                  {started.grounded ? " • grounded in published content" : " • free topic"}
                </p>
                {started.player_url ? (
                  <a href={started.player_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm"><Play className="h-4 w-4 mr-2" />Open the AI Teacher player</Button>
                  </a>
                ) : (
                  <div className="win11-infobar info p-3 text-xs">
                    The player URL appears once the school finishes service setup; lesson state still records in history below.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LessonHistory({ selected, onSelect }: { selected?: string; onSelect?: (l: Lesson) => void }) {
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
    return (
      <EmptyState
        icon={History}
        title="No lessons yet"
        body="Started lessons appear here with status, mastery and cost — pick a section above to run the first one."
        size="sm"
      />
    );

  return (
    <div className="space-y-1">
      {lessons.map((l) => (
        <button
          key={l.id}
          onClick={() => onSelect?.(l)}
          className={`w-full text-left flex items-center justify-between rounded-md border px-3 py-2 transition-colors hover:bg-[var(--w11-control-hover)] ${
            selected === l.id ? "border-[var(--w11-accent)]" : "border-[color:var(--w11-border-subtle)]"
          }`}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[color:var(--w11-text-primary)]">{l.topic}</p>
            <p className="text-xs text-[color:var(--w11-text-secondary)]">
              {l.persona_slug} · {l.language.toUpperCase()} · {l.chapters_completed} chapters
              {l.duration_seconds ? ` · ${Math.round(l.duration_seconds / 60)} min` : ""}
              {l.cost_npr ? ` · NPR ${l.cost_npr}` : ""}
            </p>
          </div>
          <StatusChip status={l.status} />
        </button>
      ))}
    </div>
  );
}

const LIFECYCLE = [
  { label: "Preparing", at: "pending" },
  { label: "Ready", at: "ready" },
  { label: "Teaching", at: "teaching" },
  { label: "Ended", at: "ended" },
];

function LifecyclePanel({ lesson }: { lesson?: Lesson }) {
  if (!lesson) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No lesson selected"
        body="Pick a lesson from the history to see where it is in its lifecycle."
        size="sm"
      />
    );
  }

  const order = ["pending", "ready", "teaching", "paused", "ended", "abandoned", "failed", "blocked"];
  let currentIndex = lesson.status === "paused" ? 2 : order.indexOf(lesson.status);
  if (currentIndex < 0) currentIndex = 0;
  if (lesson.status === "ended" || lesson.status === "abandoned" || lesson.status === "failed") currentIndex = 3;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{lesson.topic}</p>
        <StatusChip status={lesson.status} />
      </div>
      <StatusTimeline
        steps={LIFECYCLE.map((s) => ({
          label: s.label,
          at: s.at === lesson.status ? new Date().toLocaleDateString("en-GB") : null,
        }))}
        currentIndex={currentIndex}
        orientation="horizontal"
      />
      {(lesson.status === "failed" || lesson.status === "blocked") && (
        <div className="win11-infobar error p-3 text-xs">
          This lesson {lesson.status === "failed" ? "failed to run" : "is blocked"} — check service setup or restart it from history.
        </div>
      )}
      {lesson.status === "teaching" && (
        <div className="win11-infobar info p-3 text-xs">Live — the whiteboard is streaming frames and speech right now.</div>
      )}
    </div>
  );
}

function UsageSnapshot() {
  const { data, isLoading, isError, refetch } = useQuery({
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

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState title="Couldn't load usage" onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <StatGrid min={160}>
        <KpiCard label="Lessons" value={data.lessons_this_month} footnote="this month" icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        <KpiCard label="Minutes taught" value={data.minutes_this_month} footnote="this month" icon={<History className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        <KpiCard
          label="Cost this month"
          value={`NPR ${data.cost_npr_this_month}`}
          footnote={data.ceiling_npr ? `ceiling NPR ${data.ceiling_npr}` : undefined}
          icon={<DollarSign className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        />
        <KpiCard
          label="Ceiling used"
          value={data.ceiling_used_pct != null ? `${data.ceiling_used_pct}%` : "—"}
          footnote="of monthly NPR cap"
          icon={<TrendingUp className="h-5 w-5" style={{ color: data.alert ? "#c42b1c" : "var(--w11-accent)" }} />}
        />
      </StatGrid>
      {data.alert && (
        <div className="win11-infobar warning flex items-center gap-2 px-3 py-2 text-xs">
          <ShieldAlert className="h-4 w-4" /> Cost-ceiling alert — review the AI Teacher budget in Usage &amp; Cost.
        </div>
      )}
    </div>
  );
}

export default function AiTeacherPage() {
  const [activeLesson, setActiveLesson] = useState<Lesson | undefined>();

  return (
    <AppGate slug="ai_teacher">
      <AOSPage>
        <AOSPageHeader
          icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="AI Teacher"
          subtitle="A live whiteboard teacher, grounded strictly in your published curriculum · AI शिक्षक"
          actions={
            <Link href="/dashboard/ai?tab=teacher">
              <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />AI Hub</Button>
            </Link>
          }
        />
        <AOSPageBody>
          <DataPanel title="This month">
            <UsageSnapshot />
          </DataPanel>

          <QuickLinks section="Insights" links={QUICK_LINKS} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <FormSection title="Start a lesson" className="lg:col-span-3">
              <CreateLessonForm onStarted={() => setActiveLesson(undefined)} />
            </FormSection>

            <DataPanel
              title="Lesson lifecycle"
              className="lg:col-span-2"
              actions={activeLesson ? <StatusChip status={activeLesson.status} /> : undefined}
            >
              <LifecyclePanel lesson={activeLesson} />
            </DataPanel>
          </div>

          <DataPanel title="Recent lessons" bodyClassName="p-3">
            <LessonHistory selected={activeLesson?.id} onSelect={setActiveLesson} />
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    </AppGate>
  );
}
