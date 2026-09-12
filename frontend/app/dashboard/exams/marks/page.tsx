"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  isPassingResolvedMarksConfig,
  resolveExamMarkConfig,
  type MarksConfigExam,
  type MarksConfigSubject,
} from "@/lib/exam-mark-config";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/spinner";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  FilterCommandBar, DataPanel,
} from "@/components/aos/kit/page-kit";
import { usePluginWidgets } from "@/lib/plugin-widgets/usePluginWidgets";
import {
  resolveComponentWidget,
  type ComponentWidgetProps,
} from "@/lib/plugin-widgets/registry";
import { Save, ClipboardList, CheckCircle2, XCircle, ArrowLeft, Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useAOSRouteParams } from "@/lib/aos-window-route";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: number;
  student_id: string;
}

interface MarkEntry {
  student_id: string;
  theory_marks: string;
  practical_marks: string;
  components?: Record<string, string>;
}

/** Row of GET /exams/<id>/components — the N-way mark distribution. */
interface MarkComponentDef {
  id: string;
  name: string;
  max_mark: number;
  pass_mark: number | null;
  seq: number;
  subject_id?: string;
}

interface SubjectOption {
  id: string;
  name: string;
  code?: string;
}

interface SubjectOption extends MarksConfigSubject {
  id: string;
  name: string;
  code?: string;
}

interface ExamOption extends MarksConfigExam {
  id: string;
  name: string;
  exam_type: string;
}

/** NEB grading — client-side for instant feedback.
 *  Colors come from the Fluent status palette (the 11.css win11-chip tones). */
const W11_SUCCESS = "#107c10";
const W11_WARNING = "#d83b01";
const W11_ERROR = "#c42b1c";
const W11_ACCENT = "var(--w11-accent)";

function nebGrade(pct: number): { grade: string; gpa: number; color: string } {
  if (pct >= 90) return { grade: "A+", gpa: 4.0, color: W11_SUCCESS };
  if (pct >= 80) return { grade: "A",  gpa: 3.6, color: W11_SUCCESS };
  if (pct >= 70) return { grade: "B+", gpa: 3.2, color: W11_ACCENT };
  if (pct >= 60) return { grade: "B",  gpa: 2.8, color: W11_ACCENT };
  if (pct >= 50) return { grade: "C+", gpa: 2.4, color: W11_WARNING };
  if (pct >= 40) return { grade: "C",  gpa: 2.0, color: W11_WARNING };
  if (pct >= 35) return { grade: "D",  gpa: 1.6, color: W11_WARNING };
  return { grade: "NG", gpa: 0.0, color: W11_ERROR };
}

export default function MarksPage() {
  return (
    <PluginGate slug="exams">
      <MarksContent />
    </PluginGate>
  );
}

function MarksContent() {
  const queryClient = useQueryClient();
  const searchParams = useAOSRouteParams();
  const [examId, setExamId] = useState(searchParams.get("exam") || "");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [marks, setMarks] = useState<Record<string, MarkEntry>>({});

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const res = await api.get("/exams?per_page=200");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects", classId],
    queryFn: async () => {
      const res = await api.get(`/academics/subjects?class_id=${classId}`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!classId,
  });

  const { data: students, isLoading: studentsLoading, isError: studentsError, refetch: refetchStudents } = useQuery({
    queryKey: ["students-class", classId],
    queryFn: async () => {
      const res = await api.get(`/students?class_id=${classId}&per_page=200`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!classId,
    retry: 1,
  });

  // Load existing marks when exam/class/subject change
  const { data: existingMarks } = useQuery({
    queryKey: ["existing-marks", examId, classId, subjectId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}/marks?subject_id=${subjectId}&class_id=${classId}&per_page=200`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!examId && !!classId && !!subjectId,
  });

  // ── Mark components (A-32): the N-way distribution for this exam+subject.
  // When defined, the grid renders one column per component and theory /
  // practical inputs collapse into computed per-component totals.
  const { data: componentDefs } = useQuery({
    queryKey: ["exam-components", examId, subjectId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}/components?subject_id=${subjectId}`);
      return (res.data?.data?.components || []) as MarkComponentDef[];
    },
    enabled: !!examId && !!subjectId,
  });
  const components = componentDefs || [];
  const hasComponents = components.length > 0;
  const componentsFullMarks = components.reduce((sum, c) => sum + (Number(c.max_mark) || 0), 0);
  const componentsPassMarks = components.reduce(
    (sum, c) => sum + (c.pass_mark != null ? Number(c.pass_mark) : 0),
    0,
  );

  // Components manager dialog (define/edit the distribution)
  const [componentsOpen, setComponentsOpen] = useState(false);

  // Populate marks from existing data
  useEffect(() => {
    if (existingMarks && existingMarks.length > 0) {
      const loaded: Record<string, MarkEntry> = {};
      for (const m of existingMarks) {
        const componentScores: Record<string, string> = {};
        if (m.components && typeof m.components === "object") {
          for (const [cid, score] of Object.entries(m.components)) {
            componentScores[cid] = String(score ?? "");
          }
        }
        loaded[m.student_id] = {
          student_id: m.student_id,
          theory_marks: String(m.theory_marks || ""),
          practical_marks: String(m.practical_marks || ""),
          components: Object.keys(componentScores).length ? componentScores : undefined,
        };
      }
      setMarks(loaded);
    }
  }, [existingMarks]);

  const selectedExam = (exams || []).find((e: ExamOption) => e.id === examId);
  const selectedSubject = (subjects || []).find((subject: SubjectOption) => subject.id === subjectId);
  const marksConfig = resolveExamMarkConfig(selectedSubject, selectedExam);
  const {
    hasPractical,
    usesSubjectPracticalConfig,
    theoryFullMarks,
    theoryPassMarks,
    practicalFullMarks,
    practicalPassMarks,
    totalFullMarks,
    totalPassMarks,
  } = marksConfig;

  const saveMutation = useMutation({
    mutationFn: async () => {
      let entries;
      if (hasComponents) {
        // Component mode: one score per defined component; the backend sums
        // them into the obtained total (theory/practical are not sent).
        entries = Object.entries(marks)
          .map(([studentId, entry]) => {
            const compMap: Record<string, number> = {};
            for (const c of components) {
              const raw = entry.components?.[c.id];
              if (raw !== undefined && raw !== "") compMap[c.id] = parseFloat(raw) || 0;
            }
            return { student_id: studentId, components: compMap };
          })
          .filter((e) => Object.keys(e.components).length > 0);
      } else {
        entries = Object.entries(marks)
          .filter(([_, entry]) => entry.theory_marks || entry.practical_marks)
          .map(([studentId, entry]) => ({
            student_id: studentId,
            subject_id: subjectId,
            class_id: classId,
            theory_marks: parseFloat(entry.theory_marks) || 0,
            practical_marks: parseFloat(entry.practical_marks) || 0,
            full_marks: totalFullMarks,
            pass_marks: totalPassMarks,
          }));
      }
      const res = await api.post(`/exams/${examId}/marks`, {
        subject_id: subjectId,
        marks: entries,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Marks saved! (${data?.data?.new || 0} new, ${data?.data?.updated || 0} updated)`);
      queryClient.invalidateQueries({ queryKey: ["marks", "existing-marks"] });
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      toast.error(
        typeof msg === "string" ? msg : "Failed to save marks",
      );
    },
  });

  const updateMark = useCallback((studentId: string, field: "theory_marks" | "practical_marks", value: string) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        theory_marks: prev[studentId]?.theory_marks || "",
        practical_marks: prev[studentId]?.practical_marks || "",
        [field]: value,
      },
    }));
  }, []);

  const updateComponentScore = useCallback((studentId: string, componentId: string, value: string) => {
    setMarks((prev) => {
      const entry = prev[studentId] || {
        student_id: studentId,
        theory_marks: "",
        practical_marks: "",
      };
      return {
        ...prev,
        [studentId]: {
          ...entry,
          student_id: studentId,
          components: { ...(entry.components || {}), [componentId]: value },
        },
      };
    });
  }, []);

  /** Component-mode helpers: obtained total + pass/fail for one student. */
  const componentTotals = (entry: MarkEntry | undefined) => {
    let total = 0;
    let any = false;
    let failing = false;
    for (const c of components) {
      const raw = entry?.components?.[c.id];
      if (raw === undefined || raw === "") continue;
      any = true;
      const score = parseFloat(raw) || 0;
      total += score;
      if (c.pass_mark != null && score < Number(c.pass_mark)) failing = true;
    }
    return { total, any, failing };
  };

  // Stats
  const studentList: Student[] = students || [];

  // ── Plugin-carried marks grid (exams/widgets.yaml → marks_entry_grid) ──
  // The exams plugin declares its own keyboard-first grid; when the widget
  // system serves it for this slot we render THAT instead of the page's
  // fallback table. Same endpoint, same gating — just a better grid, and a
  // school without the widget deployment keeps the fallback.
  const { widgets } = usePluginWidgets("plugin_page.main");
  const marksWidget = widgets.find((w) => w.key === "marks_entry_grid");
  const MarksGrid = resolveComponentWidget(marksWidget?.component);

  const gridRows = React.useMemo(
    () =>
      studentList.map((s) => {
        const existing = (existingMarks || []).find(
          (m: { student_id: string }) => m.student_id === s.id
        );
        return {
          student_id: s.id,
          student_name: `${s.first_name} ${s.last_name}`,
          roll_number: s.roll_number,
          theory_marks: existing?.theory_marks ?? null,
          practical_marks: existing?.practical_marks ?? null,
          full_marks: totalFullMarks,
          pass_marks: totalPassMarks,
        };
      }),
    [studentList, existingMarks, totalFullMarks, totalPassMarks]
  );

  const marksGridProps: ComponentWidgetProps | null =
    marksWidget && MarksGrid
      ? {
          widget: marksWidget,
          context: {
            exam_id: examId,
            subject_id: subjectId,
            class_id: classId,
            rows: gridRows,
          },
        }
      : null;
  const entered = hasComponents
    ? Object.values(marks).filter((m: any) => componentTotals(m).any).length
    : Object.values(marks).filter((m: any) => m.theory_marks || m.practical_marks).length;
  const passCount = hasComponents
    ? Object.values(marks).filter((m: any) => {
        const { total, any, failing } = componentTotals(m);
        return any && !failing && total >= totalPassMarks;
      }).length
    : Object.values(marks).filter((m: any) => {
        const theory = parseFloat(m.theory_marks) || 0;
        const practical = parseFloat(m.practical_marks) || 0;
        return isPassingResolvedMarksConfig(marksConfig, theory, practical);
      }).length;
  const effectiveFullMarks = hasComponents ? componentsFullMarks : totalFullMarks;
  const effectivePassMarks = hasComponents ? componentsPassMarks : totalPassMarks;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={
          <Link href="/dashboard/exams">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        }
        title="Marks Entry"
        subtitle="Enter subject-wise marks • NEB auto-grading"
        actions={
          <>
            <Link href="/dashboard/exams">
              <Button variant="outline">Manage Exams</Button>
            </Link>
            {examId && subjectId && (
              <Button variant="outline" onClick={() => setComponentsOpen(true)}>
                <Layers className="h-4 w-4 mr-2" /> Components
                {hasComponents && (
                  <Badge variant="secondary" className="ml-2">{components.length}</Badge>
                )}
              </Button>
            )}
            {examId && classId && subjectId && (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" /> {saveMutation.isPending ? "Saving..." : "Save All Marks"}
              </Button>
            )}
          </>
        }
      />
      <AOSPageBody className="space-y-4">
        {/* Filters */}
        <FilterCommandBar>
          <div className="space-y-1 w-full md:w-56">
            <Label className="text-xs">Exam</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
              <SelectContent>
                {(exams || []).map((e: { id: string; name: string; exam_type: string }) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-full md:w-48">
            <Label className="text-xs">Class</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {(classes || []).map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-full md:w-56">
            <Label className="text-xs">Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {(subjects || []).map((s: { id: string; name: string; code?: string }) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterCommandBar>

        {examId && classId && subjectId && (
          <div className="win11-card grid grid-cols-2 gap-4 p-4 md:grid-cols-5">
            <div>
              <p className="text-xs text-[color:var(--w11-text-secondary)]">Config Source</p>
              <p className="text-sm font-medium">
                {usesSubjectPracticalConfig
                  ? "Subject theory + practical settings"
                  : selectedSubject
                    ? "Subject settings"
                    : "Exam defaults"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[color:var(--w11-text-secondary)]">Full Marks</p>
              <p className="text-sm font-medium">{effectiveFullMarks}</p>
            </div>
            <div>
              <p className="text-xs text-[color:var(--w11-text-secondary)]">Pass Marks</p>
              <p className="text-sm font-medium">{effectivePassMarks}</p>
            </div>
            <div>
              <p className="text-xs text-[color:var(--w11-text-secondary)]">Components</p>
              <p className="text-sm font-medium">
                {hasComponents
                  ? components.map((c) => c.name).join(" + ")
                  : "None (theory/practical)"}
              </p>
              {hasComponents && (
                <p className="text-[10px] text-[color:var(--w11-text-secondary)]">
                  Σ {componentsFullMarks} of {effectiveFullMarks} full marks
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-[color:var(--w11-text-secondary)]">Selected Subject</p>
              <p className="text-sm font-medium">{selectedSubject?.name || "Using exam defaults"}</p>
            </div>
          </div>
        )}

        {/* Stats Bar */}
        {examId && classId && subjectId && (
          <StatGrid className="mb-0">
            <KpiCard label="Total Students" value={studentList.length} />
            <KpiCard label="Marks Entered" value={entered} denominator={`/ ${studentList.length}`} color={W11_WARNING} />
            <KpiCard label="Pass" value={passCount} color={W11_SUCCESS} />
            <KpiCard label="Fail / NG" value={entered - passCount} color={W11_ERROR} />
          </StatGrid>
        )}

        {/* Marks Table — the plugin-carried keyboard grid when served */}
        {examId && classId && subjectId && (
          <DataPanel
            title={
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> {selectedSubject?.name || "Marks"} ({studentList.length} students)
              </span>
            }
            bodyClassName="p-0"
          >
            {studentsError ? (
              <div className="flex flex-col items-center py-12 space-y-3">
                <p className="text-sm text-[#c42b1c]">Failed to load students. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetchStudents()}>Retry</Button>
              </div>
            ) : studentsLoading ? (
              <PageLoader />
            ) : studentList.length === 0 ? (
              <p className="text-center py-12 text-[color:var(--w11-text-secondary)]">No students found in this class.</p>
            ) : hasComponents ? (
              /* Component mode (A-32): one input column per defined mark
                 component — theory/practical are hidden; the total is the
                 client-side sum of component scores. */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Roll</TableHead>
                    <TableHead>Student Name</TableHead>
                    {components.map((c) => (
                      <TableHead key={c.id} className="w-24">
                        {c.name} ({c.max_mark})
                        {c.pass_mark != null && (
                          <span className="block text-[10px] font-normal text-[color:var(--w11-text-secondary)]">
                            pass {c.pass_mark}
                          </span>
                        )}
                      </TableHead>
                    ))}
                    <TableHead className="w-20">Total</TableHead>
                    <TableHead className="w-16">%</TableHead>
                    <TableHead className="w-20">Grade</TableHead>
                    <TableHead className="w-16">GPA</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentList.map((s: Student) => {
                    const m = marks[s.id];
                    const { total, any, failing } = componentTotals(m);
                    const pct = effectiveFullMarks > 0 ? (total / effectiveFullMarks) * 100 : 0;
                    const gradePreview = pct > 0 ? nebGrade(pct) : null;
                    const isPass = any && !failing && total >= effectivePassMarks;
                    const g = any
                      ? isPass && gradePreview
                        ? gradePreview
                        : { grade: "NG", gpa: 0.0, color: W11_ERROR }
                      : null;

                    return (
                      <TableRow key={s.id} className={!any ? "opacity-60" : ""}>
                        <TableCell className="text-center font-mono text-xs">{s.roll_number}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{s.first_name} {s.last_name}</p>
                          <p className="text-[10px] text-[color:var(--w11-text-secondary)]">{s.student_id}</p>
                        </TableCell>
                        {components.map((c) => {
                          const val = m?.components?.[c.id] ?? "";
                          const over = val !== "" && (parseFloat(val) || 0) > Number(c.max_mark);
                          const belowPass =
                            c.pass_mark != null && val !== "" && (parseFloat(val) || 0) < Number(c.pass_mark);
                          return (
                            <TableCell key={c.id}>
                              <Input
                                type="number"
                                min="0"
                                max={c.max_mark}
                                value={val}
                                onChange={(e) => updateComponentScore(s.id, c.id, e.target.value)}
                                placeholder="0"
                                className={`w-20 h-8 text-sm ${over || belowPass ? "!border-[#c42b1c]" : ""}`}
                              />
                            </TableCell>
                          );
                        })}
                        <TableCell className="font-semibold text-sm">{any ? total : "—"}</TableCell>
                        <TableCell className="text-sm">{any ? `${pct.toFixed(1)}%` : "—"}</TableCell>
                        <TableCell>
                          {g ? (
                            <span
                              className="px-2 py-0.5 rounded text-xs font-bold"
                              style={{
                                color: g.color,
                                background: `color-mix(in srgb, ${g.color} 12%, transparent)`,
                              }}
                            >
                              {g.grade}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{g ? g.gpa.toFixed(1) : "—"}</TableCell>
                        <TableCell>
                          {any && (
                            isPass ? (
                              <CheckCircle2 className="h-4 w-4" style={{ color: W11_SUCCESS }} />
                            ) : (
                              <XCircle className="h-4 w-4" style={{ color: W11_ERROR }} />
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : marksGridProps && MarksGrid ? (
              /* The exams plugin's marks_entry_grid: Enter/↓ navigation,
                 Excel-paste, per-cell validation and its own Save — replaces
                 the fallback display table entirely. */
              <MarksGrid {...marksGridProps} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Roll</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="w-28">Theory ({theoryFullMarks})</TableHead>
                    {hasPractical && <TableHead className="w-28">Practical ({practicalFullMarks})</TableHead>}
                    <TableHead className="w-20">Total</TableHead>
                    <TableHead className="w-16">%</TableHead>
                    <TableHead className="w-20">Grade</TableHead>
                    <TableHead className="w-16">GPA</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentList.map((s: Student) => {
                    const m = marks[s.id] || { theory_marks: "", practical_marks: "" };
                    const theory = parseFloat(m.theory_marks) || 0;
                    const practical = parseFloat(m.practical_marks) || 0;
                    const total = theory + practical;
                    const pct = totalFullMarks > 0 ? (total / totalFullMarks) * 100 : 0;
                    const gradePreview = pct > 0 ? nebGrade(pct) : null;
                    const isPass = isPassingResolvedMarksConfig(marksConfig, theory, practical);
                    const g = total > 0
                      ? isPass
                        ? gradePreview
                        : { grade: "NG", gpa: 0.0, color: W11_ERROR }
                      : null;

                    return (
                      <TableRow key={s.id} className={!m.theory_marks && !m.practical_marks ? "opacity-60" : ""}>
                        <TableCell className="text-center font-mono text-xs">{s.roll_number}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{s.first_name} {s.last_name}</p>
                          <p className="text-[10px] text-[color:var(--w11-text-secondary)]">{s.student_id}</p>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={theoryFullMarks}
                            value={m.theory_marks}
                            onChange={(e) => updateMark(s.id, "theory_marks", e.target.value)}
                            placeholder="0"
                            className={`w-24 h-8 text-sm ${total > 0 && !isPass ? "!border-[#c42b1c]" : ""}`}
                          />
                        </TableCell>
                        {hasPractical && (
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={practicalFullMarks}
                              value={m.practical_marks}
                              onChange={(e) => updateMark(s.id, "practical_marks", e.target.value)}
                              placeholder="0"
                              className="w-24 h-8 text-sm"
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-semibold text-sm">{total > 0 ? total : "—"}</TableCell>
                        <TableCell className="text-sm">{total > 0 ? `${pct.toFixed(1)}%` : "—"}</TableCell>
                        <TableCell>
                          {g ? (
                            <span
                              className="px-2 py-0.5 rounded text-xs font-bold"
                              style={{
                                color: g.color,
                                background: `color-mix(in srgb, ${g.color} 12%, transparent)`,
                              }}
                            >
                              {g.grade}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{g ? g.gpa.toFixed(1) : "—"}</TableCell>
                        <TableCell>
                          {total > 0 && (
                            isPass ? (
                              <CheckCircle2 className="h-4 w-4" style={{ color: W11_SUCCESS }} />
                            ) : (
                              <XCircle className="h-4 w-4" style={{ color: W11_ERROR }} />
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </DataPanel>
        )}

        {/* Components manager — define/edit the mark distribution for this
            exam+subject (name, max mark, pass mark, order). */}
        <ComponentsManagerDialog
          open={componentsOpen}
          onOpenChange={setComponentsOpen}
          examId={examId}
          subjectId={subjectId}
          subjectName={selectedSubject?.name || ""}
          defs={components}
          fallbackFullMarks={totalFullMarks}
        />
      </AOSPageBody>
    </AOSPage>
  );
}

/** Editable distribution editor: Σ max marks vs the subject's full marks. */
function ComponentsManagerDialog({
  open,
  onOpenChange,
  examId,
  subjectId,
  subjectName,
  defs,
  fallbackFullMarks,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  examId: string;
  subjectId: string;
  subjectName: string;
  defs: MarkComponentDef[];
  fallbackFullMarks: number;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<MarkComponentDef[]>([]);

  useEffect(() => {
    if (open) {
      setRows(
        defs.length
          ? defs.map((c) => ({ ...c }))
          : [{ id: "", name: "Theory", max_mark: fallbackFullMarks, pass_mark: null, seq: 1 }],
      );
    }
  }, [open, defs, fallbackFullMarks]);

  const sumMax = rows.reduce((s, r) => s + (parseFloat(String(r.max_mark)) || 0), 0);
  const sumPass = rows.reduce(
    (s, r) => s + (r.pass_mark != null ? parseFloat(String(r.pass_mark)) || 0 : 0),
    0,
  );
  const overFull = sumMax > fallbackFullMarks + 0.01;

  const updateRow = (idx: number, patch: Partial<MarkComponentDef>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/exams/${examId}/components`, {
        subject_id: subjectId,
        components: rows.map((r, i) => ({
          name: r.name.trim(),
          max_mark: parseFloat(String(r.max_mark)) || 0,
          pass_mark: r.pass_mark != null ? parseFloat(String(r.pass_mark)) : null,
          seq: i + 1,
        })),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Component distribution saved");
      queryClient.invalidateQueries({ queryKey: ["exam-components"] });
      onOpenChange(false);
    },
    onError: (err) => {
      // 409 = marks already entered against these components; 400 = validation.
      const msg = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : "Failed to save components");
    },
  });

  const canSave =
    rows.length > 0 &&
    rows.every((r) => r.name.trim() && (parseFloat(String(r.max_mark)) || 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark Components{subjectName ? ` — ${subjectName}` : ""}</DialogTitle>
          <DialogDescription>
            Split the subject&apos;s marks into components (e.g. CQ, MCQ, Practical). The
            marks grid gets one column per component and totals are summed automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4 space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={row.name}
                  onChange={(e) => updateRow(idx, { name: e.target.value })}
                  placeholder="e.g. CQ"
                  className="h-8"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Max</Label>
                <Input
                  type="number"
                  min="0"
                  value={String(row.max_mark)}
                  onChange={(e) => updateRow(idx, { max_mark: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Pass</Label>
                <Input
                  type="number"
                  min="0"
                  value={row.pass_mark != null ? String(row.pass_mark) : ""}
                  onChange={(e) =>
                    updateRow(idx, { pass_mark: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })
                  }
                  placeholder="—"
                  className="h-8"
                />
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Order</Label>
                <Input
                  type="number"
                  min="1"
                  value={String(row.seq || idx + 1)}
                  onChange={(e) => updateRow(idx, { seq: parseInt(e.target.value, 10) || idx + 1 })}
                  className="h-8"
                />
              </div>
              <div className="col-span-1 pb-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[color:var(--w11-text-secondary)] hover:!text-[#c42b1c]"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Remove component"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { id: "", name: "", max_mark: 0, pass_mark: null, seq: prev.length + 1 },
              ])
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Add component
          </Button>
        </div>

        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={
            overFull
              ? { background: "rgba(196,43,28,.08)", borderColor: "rgba(196,43,28,.3)", color: "#c42b1c" }
              : { background: "rgba(16,124,16,.08)", borderColor: "rgba(16,124,16,.3)", color: "#107c10" }
          }
        >
          Σ component total: <span className="font-bold">{sumMax}</span> / full marks{" "}
          {fallbackFullMarks}
          {overFull
            ? " — exceeds the subject's full marks; reduce a component."
            : ` · pass total ${sumPass}`}
          {sumMax === 0 && " — set max marks for each component."}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save Distribution"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
