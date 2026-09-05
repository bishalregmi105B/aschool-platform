"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PluginGate } from "@/lib/plugins";
import { api, type ApiResponse } from "@/lib/api";
import { GraduationCap, History, Play, ShieldAlert, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <option value="">Choose a section…</option>
              {published.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title_en}
                  {s.title_ne ? ` — ${s.title_ne}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Student</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Choose a student…</option>
              {(students.data || []).map((st) => (
                <option key={st.id} value={st.id}>{st.full_name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Language</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="ne">नेपाली (Nepali)</option>
              <option value="mixed">Mixed (Nepali speech, English terms)</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Teacher persona</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
            >
              <option value="aria">ARIA — warm, analogy-first</option>
              <option value="max">Max — coach energy</option>
              <option value="sophia">Sophia — rigorous, first-principles</option>
              <option value="leo">Leo — story-first</option>
              <option value="nova">Nova — visual, data-first</option>
            </select>
          </label>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button
              onClick={() => create.mutate()}
              disabled={!sectionId || !studentId || create.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {create.isPending ? "Preparing lesson…" : "Start lesson"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          {started && (
            <Card className="md:col-span-2 border-primary/30 bg-primary/5">
              <CardContent className="py-4 space-y-2">
                <p className="text-sm font-medium">Lesson is ready.</p>
                <p className="text-xs text-muted-foreground">
                  Estimated cost before start: NPR {started.estimated_cost_npr}
                  {started.grounded ? " • grounded in published content" : " • free topic"}
                </p>
                {started.player_url ? (
                  <a href={started.player_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm">Open the AI Teacher player</Button>
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The lesson player URL appears once the school finishes service setup.
                    Lesson state still records in history.
                  </p>
                )}
              </CardContent>
            </Card>
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
        <div key={l.id} className="flex items-center justify-between border-b py-2 last:border-0">
          <div>
            <p className="text-sm font-medium">{l.topic}</p>
            <p className="text-xs text-muted-foreground">
              {l.persona_slug} • {l.language.toUpperCase()} •{" "}
              {l.chapters_completed} chapters
              {l.duration_seconds ? ` • ${Math.round(l.duration_seconds / 60)} min` : ""}
              {l.cost_npr ? ` • NPR ${l.cost_npr}` : ""}
            </p>
          </div>
          <Badge
            variant={
              l.status === "ended" ? "success" : l.status === "failed" ? "destructive" : "default"
            }
          >
            {l.status}
          </Badge>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />Usage this month
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xl font-bold">{data.lessons_this_month}</p>
          <p className="text-xs text-muted-foreground">Lessons</p>
        </div>
        <div>
          <p className="text-xl font-bold">{data.minutes_this_month}</p>
          <p className="text-xs text-muted-foreground">Minutes</p>
        </div>
        <div>
          <p className="text-xl font-bold">
            {data.ceiling_used_pct != null ? `${data.ceiling_used_pct}%` : `NPR ${data.cost_npr_this_month}`}
          </p>
          <p className="text-xs text-muted-foreground">of ceiling {data.ceiling_used_pct != null && `(NPR ${data.cost_npr_this_month})`}</p>
        </div>
        {data.alert && (
          <p className="col-span-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <ShieldAlert className="h-4 w-4" /> Cost ceiling alert — review the AI Teacher budget.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AiTeacherPage() {
  return (
    <PluginGate slug="ai_teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6" />AI Teacher
            </h1>
            <p className="text-muted-foreground">
              A live AI teacher that speaks and writes on a whiteboard — grounded strictly in
              your published curriculum.
            </p>
          </div>
          <Link href="/dashboard/ai-teacher/content" className="text-sm text-primary hover:underline">
            Teaching Content →
          </Link>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Start a lesson</CardTitle></CardHeader>
          <CardContent>
            <CreateLessonForm />
          </CardContent>
        </Card>

        <MasterySnapshot />

        <Card>
          <CardHeader><CardTitle className="text-base">Lesson history</CardTitle></CardHeader>
          <CardContent>
            <LessonHistory />
          </CardContent>
        </Card>
      </div>
    </PluginGate>
  );
}
