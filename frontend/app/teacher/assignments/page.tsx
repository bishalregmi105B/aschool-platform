"use client";

/**
 * Teacher → Assignments (scoped, 44.1).
 *
 * Previously a re-export of the ADMIN assignments hub (school-wide list,
 * AI-grading console, class pickers for every teacher). This version shows
 * only MY assignments via GET /teacher/assignments, creates through
 * POST /teacher/assignments (validated + class-scoped server-side), and
 * opens a per-assignment submission sheet with the grade form — all
 * endpoints already used by the mobile teacher app.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Plus } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { displayBS } from "@/lib/nepali_date";
import { DataPanel, StatusChip } from "@/components/aos/kit/page-kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { BSDateInput } from "@/components/ui/bs-date-input";

type MyAssignment = {
  id: string;
  title: string;
  description?: string | null;
  subject: string;
  subject_id?: string | null;
  class_name: string;
  class_id?: string | null;
  due_date?: string | null;
  status: string;
  submitted_count: number;
  total_students: number;
};

type Submission = {
  id: string;
  student_name?: string | null;
  roll_number?: number | null;
  content?: string | null;
  file_url?: string | null;
  max_marks?: number | null;
  marks?: number | null;
  feedback?: string | null;
  submitted_at?: string | null;
  status?: string | null;
};

export default function TeacherAssignmentsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [openFor, setOpenFor] = useState<MyAssignment | null>(null);

  const list = useQuery({
    queryKey: ["teacher-assignments"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<MyAssignment[]>>("/teacher/assignments");
      return res.data.data || [];
    },
  });

  const columns: Column<MyAssignment>[] = [
    {
      key: "title",
      label: "Assignment",
      render: (r) => (
        <span>
          <span className="block font-medium" style={{ color: "var(--w11-text-primary)" }}>{r.title}</span>
          <span className="block text-xs" style={{ color: "var(--w11-text-secondary)" }}>{r.subject || "—"}</span>
        </span>
      ),
      value: (r) => r.title,
    },
    { key: "class_name", label: "Class", render: (r) => r.class_name || "—" },
    {
      key: "due_date",
      label: "Due",
      render: (r) => <span className="text-sm tabular-nums">{r.due_date ? displayBS(r.due_date.slice(0, 10)) : "—"}</span>,
    },
    {
      key: "progress",
      label: "Submissions",
      align: "center",
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: "var(--w11-border-default)" }}>
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.round((r.submitted_count / Math.max(1, r.total_students)) * 100))}%`,
                background: "var(--w11-accent)",
              }}
            />
          </span>
          <span className="text-xs tabular-nums" style={{ color: "var(--w11-text-secondary)" }}>
            {r.submitted_count}/{r.total_students}
          </span>
        </span>
      ),
      value: (r) => r.submitted_count,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusChip status={r.status === "past" ? "absent" : r.status} label={r.status === "past" ? "Closed" : "Open"} />,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      noExport: true,
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setOpenFor(r)}>
          View submissions
        </Button>
      ),
    },
  ];

  const rows = list.data || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>My Assignments</h1>
          <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
            {rows.length} assignment{rows.length === 1 ? "" : "s"} across your classes.
          </p>
        </div>
        <Button className="h-11" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New assignment
        </Button>
      </div>

      <DataPanel>
        {list.isLoading ? (
          <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} loading />
        ) : list.isError ? (
          <ErrorState title="Couldn't load assignments" onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No assignments yet"
            body="Create your first assignment — students see it instantly in their portal and app."
            action={{ label: "New assignment", onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            searchable
            searchPlaceholder="Search assignments…"
            exportFileName="my-assignments"
          />
        )}
      </DataPanel>

      <CreateAssignmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          qc.invalidateQueries({ queryKey: ["teacher-assignments"] });
          qc.invalidateQueries({ queryKey: ["teacher-dashboard"] });
        }}
      />

      <SubmissionsDialog assignment={openFor} onClose={() => setOpenFor(null)} />
    </div>
  );
}

/* ── Create dialog ─────────────────────────────────────────────────────── */

function CreateAssignmentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [totalMarks, setTotalMarks] = useState("10");

  const classes = useQuery({
    queryKey: ["teacher-my-classes"],
    queryFn: async () => (await api.get("/teacher/my-classes")).data.data as { id: string; name: string }[],
    enabled: open,
  });

  const subjects = useQuery({
    queryKey: ["teacher-subjects", classId],
    enabled: Boolean(classId),
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ id: string; name: string }[]>>(`/academics/subjects?class_id=${classId}`);
      return res.data.data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post("/teacher/assignments", {
          title: title.trim(),
          description: description.trim() || undefined,
          class_id: classId,
          subject_id: subjectId,
          due_date: dueDate ? `${dueDate}T23:59:59` : undefined,
          total_marks: parseFloat(totalMarks) || 10,
        })
      ).data,
    onSuccess: () => {
      toast.success("Assignment published to your class.");
      setTitle("");
      setDescription("");
      setClassId("");
      setSubjectId("");
      setDueDate("");
      onCreated();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : "Couldn't create the assignment.");
    },
  });

  const valid = title.trim().length > 1 && classId && subjectId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New assignment</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="a-title">Title *</Label>
            <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 5 exercises" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-desc">Instructions</Label>
            <Textarea id="a-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What to do, where to write, how to submit…" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Class *</Label>
              <AdvancedSelect
                value={classId}
                onChange={(v) => {
                  setClassId(v);
                  setSubjectId("");
                }}
                placeholder="Your classes…"
                options={(classes.data || []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <AdvancedSelect
                value={subjectId}
                onChange={setSubjectId}
                placeholder={classId ? "Subject…" : "Pick a class first"}
                disabled={!classId}
                loading={subjects.isLoading}
                options={(subjects.data || []).map((s) => ({ value: s.id, label: s.name }))}
                searchable
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <BSDateInput value={dueDate} onChange={(v) => setDueDate(v || "")} emit="ad" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-marks">Total marks</Label>
              <Input id="a-marks" inputMode="decimal" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value.replace(/[^\d.]/g, ""))} className="h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || create.isPending}>
              {create.isPending ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Submissions + grading dialog ──────────────────────────────────────── */

function SubmissionsDialog({ assignment, onClose }: { assignment: MyAssignment | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [grading, setGrading] = useState<Submission | null>(null);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");

  const submissions = useQuery({
    queryKey: ["teacher-submissions", assignment?.id],
    enabled: Boolean(assignment),
    queryFn: async () => {
      const res = await api.get<ApiResponse<Submission[]>>(`/assignments/${assignment!.id}/submissions?per_page=100`);
      return res.data.data || [];
    },
  });

  const grade = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/assignments/${assignment!.id}/submissions/${grading!.id}/grade`, {
          marks: parseFloat(marks) || 0,
          feedback: feedback.trim() || undefined,
        })
      ).data,
    onSuccess: () => {
      toast.success("Grade saved — the student sees it right away.");
      setGrading(null);
      qc.invalidateQueries({ queryKey: ["teacher-submissions", assignment?.id] });
      qc.invalidateQueries({ queryKey: ["teacher-assignments"] });
    },
    onError: () => toast.error("Couldn't save the grade."),
  });

  const subs = submissions.data || [];

  return (
    <Dialog
      open={Boolean(assignment)}
      onOpenChange={(o) => {
        if (!o) {
          setGrading(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assignment?.title} · submissions</DialogTitle>
        </DialogHeader>
        {assignment && (
          <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            {assignment.class_name} · {assignment.subject} — {subs.length} submitted of {assignment.total_students}
          </p>
        )}
        {submissions.isLoading ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>Loading…</p>
        ) : subs.length === 0 ? (
          <EmptyState size="sm" title="No submissions yet" body="Students submit from their portal or the mobile app." />
        ) : (
          <ul className="divide-y">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                    {s.roll_number ? `${s.roll_number}. ` : ""}
                    {s.student_name || "Student"}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                    {s.content ? s.content.slice(0, 80) : s.file_url ? "File attached" : "—"}
                    {s.submitted_at ? ` · ${displayBS(String(s.submitted_at).slice(0, 10))}` : ""}
                  </p>
                </div>
                {s.marks != null ? (
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--w11-success, #107c10)" }}>
                    {s.marks}/{s.max_marks ?? "—"}
                  </span>
                ) : null}
                <Button
                  size="sm"
                  variant={s.marks != null ? "outline" : "default"}
                  onClick={() => {
                    setGrading(s);
                    setMarks(s.marks != null ? String(s.marks) : "");
                    setFeedback(s.feedback || "");
                  }}
                >
                  {s.marks != null ? "Re-grade" : "Grade"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {grading && (
          <div className="mt-4 rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--w11-border-default)" }}>
            <p className="text-sm font-semibold">
              Grade: {grading.student_name || "Student"}{" "}
              <span className="font-normal text-muted-foreground">(max {grading.max_marks ?? "—"})</span>
            </p>
            {grading.content && (
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--w11-subtle,rgba(0,0,0,0.04))] p-3 text-xs">
                {grading.content}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Marks</Label>
                <Input inputMode="decimal" value={marks} onChange={(e) => setMarks(e.target.value.replace(/[^\d.]/g, ""))} className="h-11" />
              </div>
              <div className="space-y-1">
                <Label>Feedback</Label>
                <Input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Optional note to the student" className="h-11" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setGrading(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={grade.isPending || marks === ""} onClick={() => grade.mutate()}>
                {grade.isPending ? "Saving…" : "Save grade"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
