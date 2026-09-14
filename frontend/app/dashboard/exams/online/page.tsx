"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTimeField } from "@/components/ui/datetime-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  DataPanel, StatusChip, AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { Monitor, Plus, Play, Clock, CheckCircle2, Sparkles, Eye } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ExamRunnerDialog } from "./runner";

interface OnlineExam {
  id: string;
  title: string;
  class_id: string | null;
  subject_id: string | null;
  subject_name: string | null;
  duration_minutes: number;
  total_questions: number;
  total_marks: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  instructions: string | null;
}

/** Online-exam status → StatusChip tone key ("accent" renders the raw chip). */
const STATUS_TONE: Record<string, string> = {
  upcoming: "accent",
  active: "active",
  completed: "completed",
  draft: "draft",
};

const EMPTY_FORM = {
  title: "", class_id: "", subject_id: "",
  duration_minutes: "30", total_marks: "100",
  start_at: "", end_at: "", instructions: "",
};

export default function OnlineExamPage() {

  return (
    <PluginGate slug="exams">
      <OnlineExamContent />
    </PluginGate>
  );
}

function OnlineExamContent() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  // Wave C: eSchool-style runner preview (palette + away warning + autosave).
  const [runnerExamId, setRunnerExamId] = useState<string | null>(null);

  const { data: exams = [], isLoading } = useQuery<OnlineExam[]>({
    queryKey: ["online-exams"],
    queryFn: () => api.get("/exams/online").then(r => r.data?.data ?? r.data ?? []),
  });

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then(r => r.data?.data ?? []),
    enabled: createOpen,
  });

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ["subjects-for-online", form.class_id],
    queryFn: () => api.get(`/academics/subjects?class_id=${form.class_id}`).then(r => r.data?.data ?? []),
    enabled: !!form.class_id && createOpen,
  });

  const createMut = useMutation({
    mutationFn: (payload: any) => api.post("/exams/online", payload),
    onSuccess: () => {
      toast.success("Online exam created");
      qc.invalidateQueries({ queryKey: ["online-exams"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error("Failed to create exam"),
  });

  const upcoming = exams.filter((e: any) => e.status === "upcoming").length;
  const active = exams.filter((e: any) => e.status === "active").length;
  const completed = exams.filter((e: any) => e.status === "completed").length;

  // Wave C fix: DataTable's search box is display-only — filter here.
  const needle = search.trim().toLowerCase();
  const visibleExams = needle
    ? exams.filter((e: any) => `${e.title} ${e.subject_name ?? ""}`.toLowerCase().includes(needle))
    : exams;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      title: form.title,
      class_id: form.class_id || undefined,
      subject_id: form.subject_id || undefined,
      duration_minutes: parseInt(form.duration_minutes) || 30,
      total_marks: parseInt(form.total_marks) || 100,
      start_at: form.start_at || undefined,
      end_at: form.end_at || undefined,
      instructions: form.instructions || undefined,
      status: "upcoming",
    });
  };

  const ONLINE_EXAM_COLUMNS: Column<any>[] = [
    { key: "title", label: "Title", sortable: true, value: (e) => e.title ?? "", render: (e) => <span className="font-medium">{e.title}</span> },
    { key: "subject_name", label: "Subject", sortable: true, value: (e) => e.subject_name ?? "", render: (e) => e.subject_name ?? "—" },
    { key: "duration_minutes", label: "Duration", align: "right", sortable: true, value: (e) => e.duration_minutes ?? 0, render: (e) => <>{e.duration_minutes} min</> },
    { key: "total_marks", label: "Marks", align: "right", sortable: true, value: (e) => e.total_marks ?? 0 },
    { key: "total_questions", label: "Questions", align: "right", sortable: true, value: (e) => e.total_questions ?? 0 },
    {
      key: "window",
      label: "Window",
      sortable: true,
      value: (e) => e.start_date ?? "",
      render: (e) => (
        <span className="text-xs text-[color:var(--w11-text-secondary)] whitespace-nowrap">
          {e.start_date ? new Date(e.start_date).toLocaleString() : "—"}
          {e.end_date ? ` → ${new Date(e.end_date).toLocaleString()}` : ""}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (e) => e.status ?? "",
      render: (e) => {
        const tone = STATUS_TONE[e.status];
        if (tone === "accent") {
          return <span className="win11-chip accent capitalize">{e.status}</span>;
        }
        return <StatusChip status={tone ?? e.status} label={e.status} className="capitalize" />;
      },
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (e) => (
        <div className="flex justify-end" onClick={(ev) => ev.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            title={t("Preview the exam runner (palette, timer, autosave)", "रनर पूर्वावलोकन")}
            onClick={() => setRunnerExamId(e.id)}
          >
            <Eye className="h-3.5 w-3.5" /> {t("Preview runner", "रनर हेर्नुहोस्")}
          </Button>
        </div>
      ),
    },
  ];

  const loadingValue = (
    <div className="h-8 w-12 rounded animate-pulse" style={{ background: "var(--w11-control-hover)" }} />
  );

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Monitor className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Online Exams", "अनलाइन परीक्षाहरू")}
        subtitle={`${exams.length} ${t("exams", "परीक्षा")} · ${t("Create and manage online examinations with auto-grading", "स्वतः-ग्रेडिङका साथ अनलाइन परीक्षा बनाउनुहोस् र व्यवस्थापन गर्नुहोस्")}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/exams/online/questions">
                <Sparkles className="h-4 w-4 mr-2" style={{ color: "var(--w11-accent)" }} /> AI Question Generator
              </Link>
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Create Online Exam</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Online Exam</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <Label>Title *</Label>
                    <Input
                      required
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Chapter 3 Quiz"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Class</Label>
                      <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v, subject_id: "" }))}>
                        <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                        <SelectContent>
                          {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Subject</Label>
                      <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                        <SelectContent>
                          {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Duration (mins)</Label>
                      <Input type="number" min="5" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Total Marks</Label>
                      <Input type="number" min="1" value={form.total_marks} onChange={e => setForm(f => ({ ...f, total_marks: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Start Date/Time</Label>
                      <DateTimeField value={form.start_at} onChange={v => setForm(f => ({ ...f, start_at: v }))} />
                    </div>
                    <div>
                      <Label>End Date/Time</Label>
                      <DateTimeField value={form.end_at} onChange={v => setForm(f => ({ ...f, end_at: v }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Instructions</Label>
                    <Textarea
                      value={form.instructions}
                      onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                      placeholder="Shown to students before they start..."
                      rows={2}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMut.isPending}>
                      {createMut.isPending ? <Spinner /> : "Create Exam"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <AOSPageBody className="space-y-4">
        <StatGrid className="mb-0" min={180}>
          <KpiCard
            label="Upcoming"
            value={isLoading ? loadingValue : upcoming}
            icon={<Clock className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Active Now"
            value={isLoading ? loadingValue : active}
            color="#107c10"
            icon={<Play className="h-5 w-5" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label="Completed"
            value={isLoading ? loadingValue : completed}
            color="var(--w11-text-primary)"
            icon={<CheckCircle2 className="h-5 w-5" style={{ color: "var(--w11-text-secondary)" }} />}
          />
        </StatGrid>

        <DataPanel title={`All Online Exams (${exams.length})`}>
          {exams.length === 0 && !isLoading ? (
            <AOSEmptyState
              icon={<Monitor className="h-12 w-12" style={{ color: "var(--w11-text-tertiary)" }} />}
              title="No online exams yet"
              description="Create your first online exam to get started with auto-grading"
            />
          ) : (
            <DataTable
              columns={ONLINE_EXAM_COLUMNS}
              rows={visibleExams}
              rowKey={(exam: any) => exam.id}
              loading={isLoading}
              searchable
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder={t("Search online exams…", "अनलाइन परीक्षा खोज्नुहोस्…")}
              exportFileName="online-exams"
              empty={{
                icon: Monitor,
                title: t("No online exams found", "कुनै अनलाइन परीक्षा भेटिएन"),
                body: t("Create your first online exam to get started with auto-grading.", "स्वतः-ग्रेडिङका लागि पहिलो अनलाइन परीक्षा बनाउनुहोस्।"),
              }}
            />
          )}
        </DataPanel>

        <ExamRunnerDialog
          examId={runnerExamId}
          open={!!runnerExamId}
          onOpenChange={(v) => { if (!v) setRunnerExamId(null); }}
        />
      </AOSPageBody>
    </AOSPage>
  );
}
