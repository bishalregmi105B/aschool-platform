"use client";

/**
 * MarksGridWidget — the component-renderer target for `exams.marks_entry_grid`.
 *
 * Registered in `lib/plugin-widgets/registry.ts` as `exams/MarksGrid` and
 * declared by `modules/exams/widgets.yaml`. A marks grid needs Enter/arrow
 * navigation, per-cell full-marks validation, a live grade preview and a dirty
 * count — none of which a declarative widget spec should try to express, which
 * is exactly the case `renderer: component` exists for.
 *
 * Data still comes from the widget's declared endpoint, so gating, quota and
 * tenancy are unchanged: the host resolves `/exams/<id>/marks` and this
 * component only renders and submits.
 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import type { ComponentWidgetProps } from "@/lib/plugin-widgets/registry";

interface MarkRow {
  student_id: string;
  student_name?: string;
  roll_number?: number | string;
  theory_marks?: number | string | null;
  practical_marks?: number | string | null;
  full_marks?: number;
  pass_marks?: number;
}

interface Draft {
  theory: string;
  practical: string;
}

/** NEB bands — the same table the marks page shows, for instant feedback. */
function nebGrade(pct: number): { grade: string; gpa: number } {
  if (pct >= 90) return { grade: "A+", gpa: 4.0 };
  if (pct >= 80) return { grade: "A", gpa: 3.6 };
  if (pct >= 70) return { grade: "B+", gpa: 3.2 };
  if (pct >= 60) return { grade: "B", gpa: 2.8 };
  if (pct >= 50) return { grade: "C+", gpa: 2.4 };
  if (pct >= 40) return { grade: "C", gpa: 2.0 };
  if (pct >= 35) return { grade: "D", gpa: 1.6 };
  return { grade: "NG", gpa: 0 };
}

export default function MarksGridWidget({
  widget,
  context,
}: ComponentWidgetProps) {
  const queryClient = useQueryClient();
  const examId = String(context?.exam_id ?? "");
  const subjectId = String(context?.subject_id ?? "");
  const classId = String(context?.class_id ?? "");
  const rows = React.useMemo<MarkRow[]>(
    () => (Array.isArray(context?.rows) ? (context?.rows as MarkRow[]) : []),
    [context]
  );

  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const inputsRef = React.useRef<Record<string, HTMLInputElement | null>>({});

  React.useEffect(() => {
    const initial: Record<string, Draft> = {};
    for (const row of rows) {
      initial[row.student_id] = {
        theory: row.theory_marks === null || row.theory_marks === undefined
          ? ""
          : String(row.theory_marks),
        practical:
          row.practical_marks === null || row.practical_marks === undefined
            ? ""
            : String(row.practical_marks),
      };
    }
    setDrafts(initial);
  }, [rows]);

  const fullMarks = rows[0]?.full_marks ?? 100;
  const passMarks = rows[0]?.pass_marks ?? 40;

  const dirtyCount = React.useMemo(() => {
    let count = 0;
    for (const row of rows) {
      const draft = drafts[row.student_id];
      if (!draft) continue;
      const originalTheory =
        row.theory_marks === null || row.theory_marks === undefined
          ? ""
          : String(row.theory_marks);
      const originalPractical =
        row.practical_marks === null || row.practical_marks === undefined
          ? ""
          : String(row.practical_marks);
      if (draft.theory !== originalTheory || draft.practical !== originalPractical) {
        count += 1;
      }
    }
    return count;
  }, [drafts, rows]);

  const setDraft = (studentId: string, field: keyof Draft, value: string) =>
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        theory: prev[studentId]?.theory ?? "",
        practical: prev[studentId]?.practical ?? "",
        [field]: value,
      },
    }));

  /** Enter / ↓ move down the column, ↑ moves up — the flow a typist expects. */
  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    field: keyof Draft
  ) => {
    const delta =
      e.key === "Enter" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = rows[index + delta];
    if (!next) return;
    inputsRef.current[`${next.student_id}:${field}`]?.focus();
    inputsRef.current[`${next.student_id}:${field}`]?.select();
  };

  const save = useMutation({
    mutationFn: async () => {
      const entries = rows
        .map((row) => {
          const draft = drafts[row.student_id];
          if (!draft || (!draft.theory && !draft.practical)) return null;
          return {
            student_id: row.student_id,
            subject_id: subjectId,
            class_id: classId,
            theory_marks: Number(draft.theory) || 0,
            practical_marks: Number(draft.practical) || 0,
            full_marks: fullMarks,
            pass_marks: passMarks,
          };
        })
        .filter(Boolean);
      const res = await api.post(`/exams/${examId}/marks`, {
        subject_id: subjectId,
        marks: entries,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        `Marks saved (${data?.data?.new ?? 0} new, ${data?.data?.updated ?? 0} updated)`
      );
      queryClient.invalidateQueries({ queryKey: ["plugin-widget-data"] });
    },
    onError: (err) =>
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Could not save marks"
      ),
  });

  if (!examId || !subjectId || rows.length === 0) {
    return (
      <EmptyState
        size="sm"
        title={widget.states?.empty?.title ?? "Pick an exam and subject"}
        body={
          widget.states?.empty?.body ??
          "Choose a class and subject to start entering marks."
        }
      />
    );
  }

  const overLimit = (value: string, limit: number) =>
    value !== "" && Number(value) > limit;

  /** Excel-paste: a TSV cell ("12<TAB>8") fills theory+practical of the row;
   *  a single value pastes natively. Spreadsheet column-paste is the fastest
   *  entry path staff know. */
  const onPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    index: number,
    field: keyof Draft
  ) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !text.includes("\t")) return;
    const cols = text.replace(/\r/g, "").split("\n")[0].split("\t");
    const theoryIdx = field === "theory" ? 0 : 1;
    const theory = cols[theoryIdx]?.trim() ?? "";
    const practical = cols[theoryIdx + 1]?.trim() ?? "";
    if (theory === "" && practical === "") return;
    e.preventDefault();
    const row = rows[index];
    if (!row) return;
    setDrafts((prev) => ({
      ...prev,
      [row.student_id]: { theory, practical },
    }));
  };

  return (
    <div className="space-y-2">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Roll</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="w-24 text-right">Theory</TableHead>
              <TableHead className="w-24 text-right">Practical</TableHead>
              <TableHead className="w-20 text-right">Total</TableHead>
              <TableHead className="w-20">Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const draft = drafts[row.student_id] ?? { theory: "", practical: "" };
              const total =
                (Number(draft.theory) || 0) + (Number(draft.practical) || 0);
              const pct = fullMarks ? (total / fullMarks) * 100 : 0;
              const { grade, gpa } = nebGrade(pct);
              const failed = total > 0 && total < passMarks;

              return (
                <TableRow key={row.student_id}>
                  <TableCell className="text-muted-foreground">
                    {row.roll_number ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.student_name ?? row.student_id}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      ref={(el) => {
                        inputsRef.current[`${row.student_id}:theory`] = el;
                      }}
                      value={draft.theory}
                      inputMode="decimal"
                      onChange={(e) => setDraft(row.student_id, "theory", e.target.value)}
                      onKeyDown={(e) => onKeyDown(e, index, "theory")}
                      onPaste={(e) => onPaste(e, index, "theory")}
                      className={cn(
                        "h-7 w-20 text-right",
                        overLimit(draft.theory, fullMarks) &&
                          "border-destructive text-destructive"
                      )}
                      aria-label={`Theory marks for ${row.student_name ?? "student"}`}
                      aria-invalid={overLimit(draft.theory, fullMarks)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      ref={(el) => {
                        inputsRef.current[`${row.student_id}:practical`] = el;
                      }}
                      value={draft.practical}
                      inputMode="decimal"
                      onChange={(e) =>
                        setDraft(row.student_id, "practical", e.target.value)
                      }
                      onKeyDown={(e) => onKeyDown(e, index, "practical")}
                      onPaste={(e) => onPaste(e, index, "practical")}
                      className="h-7 w-20 text-right"
                      aria-label={`Practical marks for ${row.student_name ?? "student"}`}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {total || "—"}
                  </TableCell>
                  <TableCell>
                    {total > 0 && (
                      <StatusPill
                        status={failed ? "fail" : "pass"}
                        label={`${grade} · ${gpa.toFixed(1)}`}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Full marks {fullMarks} · pass {passMarks} · Enter/↓ moves down the column
        </p>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <span className="text-[11px] font-medium text-amber-600">
              {dirtyCount} unsaved
            </span>
          )}
          <Button
            size="sm"
            disabled={dirtyCount === 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save marks"}
          </Button>
        </div>
      </div>
    </div>
  );
}
