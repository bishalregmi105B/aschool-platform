"use client";

/**
 * Teacher → Marks (scoped, 8.23 / 44.1).
 *
 * Was a one-line re-export of the ADMIN marks grid (school-wide exam +
 * class pickers inside a plain frame). Now teacher-scoped: the exam picker
 * is limited to exams of classes assigned to me, the subject picker to that
 * exam's subjects, and every save goes through POST /exams/<id>/marks —
 * the same endpoint the admin grid uses, already role-gated to
 * school_admin+teacher with server-side subject/class allow-lists.
 *
 * Research notes: mark entry grids must keep the row context visible while
 * typing (roll+name pinned), gate Save on "nothing left invalid", and never
 * pretend success when the server locked the book (marks lock after result
 * publish → surface the server's error message verbatim).
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Save } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { DataPanel } from "@/components/aos/kit/page-kit";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Badge } from "@/components/ui/badge";

type Exam = { id: string; name: string; class_id?: string | null; class_name?: string | null; status?: string };
type Subject = { id: string; name: string; code?: string; has_practical?: boolean; total_full_marks?: number };
type MarkRow = {
  student_id: string;
  name: string;
  roll_no: number;
  theory_marks: number | null;
  practical_marks: number | null;
  full_marks: number | null;
  pass_marks: number | null;
  has_practical: boolean;
  theory_full_marks: number;
  practical_full_marks: number | null;
  grade: string | null;
};
type Entry = { theory: string; practical: string };

export default function TeacherMarksPage() {
  const qc = useQueryClient();
  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  const classes = useQuery({
    queryKey: ["teacher-my-classes"],
    queryFn: async () => (await api.get("/teacher/my-classes")).data.data as { id: string; name: string }[],
  });

  const exams = useQuery({
    queryKey: ["teacher-marks-exams"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Exam[] | { items?: Exam[] }>>("/exams?per_page=200");
      const p = res.data.data;
      return Array.isArray(p) ? p : p?.items || [];
    },
  });

  const myClassIds = useMemo(() => new Set((classes.data || []).map((c) => c.id)), [classes.data]);
  const myExams = useMemo(() => {
    const all = exams.data || [];
    // Keep exams whose target class is one of mine; unscoped (school-wide)
    // exams stay visible so a subject teacher is not locked out.
    return all.filter((e) => !e.class_id || myClassIds.has(e.class_id));
  }, [exams.data, myClassIds]);

  const subjects = useQuery({
    queryKey: ["teacher-marks-subjects", examId],
    enabled: Boolean(examId),
    queryFn: async () => {
      const res = await api.get<ApiResponse<Subject[]>>(`/exams/${examId}/subjects`);
      return res.data.data || [];
    },
  });

  const exam = myExams.find((e) => e.id === examId);

  const rows = useQuery({
    queryKey: ["teacher-marks-grid", examId, subjectId],
    enabled: Boolean(examId && subjectId),
    queryFn: async () => {
      const res = await api.get<ApiResponse<MarkRow[]>>(
        `/exams/${examId}/marks?subject_id=${subjectId}${exam?.class_id ? `&class_id=${exam.class_id}` : ""}&per_page=200`,
      );
      return res.data.data || [];
    },
  });

  const dirtyEntries = Object.entries(entries).filter(([, v]) => v.theory !== "" || v.practical !== "");

  const save = useMutation({
    mutationFn: async () => {
      const subject = subjects.data?.find((s) => s.id === subjectId);
      const payloadRows = (rows.data || [])
        .filter((r) => entries[r.student_id] && (entries[r.student_id].theory !== "" || entries[r.student_id].practical !== ""))
        .map((r) => ({
          student_id: r.student_id,
          subject_id: subjectId,
          class_id: exam?.class_id ?? undefined,
          theory_marks: parseFloat(entries[r.student_id].theory) || 0,
          practical_marks: parseFloat(entries[r.student_id].practical) || 0,
          full_marks: r.full_marks ?? subject?.total_full_marks ?? undefined,
          pass_marks: r.pass_marks ?? undefined,
        }));
      const res = await api.post(`/exams/${examId}/marks`, { subject_id: subjectId, marks: payloadRows });
      return res.data;
    },
    onSuccess: (data: { data?: { new?: number; updated?: number } }) => {
      toast.success(`Marks saved — ${data?.data?.new ?? 0} new, ${data?.data?.updated ?? 0} updated.`);
      setEntries({});
      qc.invalidateQueries({ queryKey: ["teacher-marks-grid"] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : "Couldn't save marks.");
    },
  });

  const setField = (id: string, field: keyof Entry, value: string) => {
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return; // digits + single dot only
    setEntries((prev) => {
      const cur = prev[id] ?? { theory: "", practical: "" };
      return { ...prev, [id]: { ...cur, [field]: value } };
    });
  };

  const inputClass =
    "h-11 w-24 rounded-lg border bg-white px-3 text-sm text-center font-semibold tabular-nums focus:outline-none focus:ring-2";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>Enter Marks</h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          Choose the exam and subject, type marks, then save. Grades are computed by the school&apos;s scale.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--w11-text-secondary)" }}>Exam</label>
          <AdvancedSelect
            value={examId}
            onChange={(v) => {
              setExamId(v);
              setSubjectId("");
              setEntries({});
            }}
            placeholder="Select an exam…"
            options={myExams.map((e) => ({ value: e.id, label: `${e.name}${e.class_name ? ` · ${e.class_name}` : ""}` }))}
            searchable
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--w11-text-secondary)" }}>Subject</label>
          <AdvancedSelect
            value={subjectId}
            onChange={(v) => {
              setSubjectId(v);
              setEntries({});
            }}
            placeholder={examId ? "Select a subject…" : "Pick an exam first"}
            disabled={!examId}
            options={(subjects.data || []).map((s) => ({ value: s.id, label: s.name }))}
            searchable
          />
        </div>
      </div>

      {!examId ? (
        <EmptyState
          icon={ClipboardList}
          size="md"
          title="Pick an exam to start"
          body="Only exams scheduled for your classes (and school-wide exams) are listed."
        />
      ) : (
        <DataPanel
          title={subjectId && rows.data ? `${rows.data.length} students` : undefined}
          actions={
            <Button
              size="sm"
              disabled={!dirtyEntries.length || save.isPending}
              onClick={() => save.mutate()}
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              {save.isPending ? "Saving…" : dirtyEntries.length ? `Save (${dirtyEntries.length})` : "Save"}
            </Button>
          }
        >
          {!subjectId ? (
            <p className="px-2 py-6 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>
              Choose a subject to load the roster.
            </p>
          ) : rows.isLoading ? (
            <SkeletonTable rows={6} />
          ) : rows.isError ? (
            <ErrorState title="Couldn't load marks" onRetry={() => rows.refetch()} />
          ) : rows.data?.length === 0 ? (
            <EmptyState
              size="sm"
              title="No students to grade"
              body="This class has no active students, or your subject assignment doesn't cover it."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ color: "var(--w11-text-secondary)" }}>
                    <th className="py-2 pr-2 font-medium w-12">Roll</th>
                    <th className="py-2 pr-2 font-medium">Student</th>
                    <th className="py-2 px-2 font-medium text-center">
                      Theory
                      {rows.data?.[0]?.theory_full_marks != null && (
                        <span className="block text-[10px] font-normal">/ {rows.data[0].theory_full_marks}</span>
                      )}
                    </th>
                    {rows.data?.[0]?.has_practical && (
                      <th className="py-2 px-2 font-medium text-center">
                        Practical
                        {rows.data[0].practical_full_marks != null && (
                          <span className="block text-[10px] font-normal">/ {rows.data[0].practical_full_marks}</span>
                        )}
                      </th>
                    )}
                    <th className="py-2 pl-2 font-medium text-center w-20">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.data?.map((r) => (
                    <tr key={r.student_id} className="border-b last:border-0" style={{ borderColor: "var(--w11-border-subtle)" }}>
                      <td className="py-1.5 pr-2 tabular-nums" style={{ color: "var(--w11-text-secondary)" }}>{r.roll_no || "—"}</td>
                      <td className="py-1.5 pr-2 font-medium" style={{ color: "var(--w11-text-primary)" }}>{r.name}</td>
                      <td className="py-1.5 px-2 text-center">
                        <input
                          inputMode="decimal"
                          aria-label={`Theory marks for ${r.name}`}
                          className={inputClass}
                          style={{ borderColor: "var(--w11-border-default)" }}
                          value={entries[r.student_id]?.theory ?? (r.theory_marks != null ? String(r.theory_marks) : "")}
                          onChange={(e) => setField(r.student_id, "theory", e.target.value)}
                        />
                      </td>
                      {r.has_practical && (
                        <td className="py-1.5 px-2 text-center">
                          <input
                            inputMode="decimal"
                            aria-label={`Practical marks for ${r.name}`}
                            className={inputClass}
                            style={{ borderColor: "var(--w11-border-default)" }}
                            value={entries[r.student_id]?.practical ?? (r.practical_marks != null ? String(r.practical_marks) : "")}
                            onChange={(e) => setField(r.student_id, "practical", e.target.value)}
                          />
                        </td>
                      )}
                      <td className="py-1.5 pl-2 text-center">
                        {r.grade ? <Badge variant="outline">{r.grade}</Badge> : <span style={{ color: "var(--w11-text-disabled, rgba(0,0,0,.25))" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataPanel>
      )}
    </div>
  );
}
