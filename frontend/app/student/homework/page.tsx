"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { BookOpen, CheckCircle2, Clock3, Paperclip, Upload } from "lucide-react";

interface StudentAssignment {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  teacher?: string;
  due_date?: string;
  due_date_bs?: string;
  is_overdue?: boolean;
  marks?: number | null;
  feedback?: string | null;
  total_marks?: number | null;
}

interface StudentAssignmentsResponse {
  pending: StudentAssignment[];
  submitted: StudentAssignment[];
}

function formatDate(bsDate?: string | null, adDate?: string | null) {
  if (bsDate) return bsDate;
  return adDate ? adDate.split("T")[0] : "—";
}

export default function StudentHomeworkPage() {
  const qc = useQueryClient();
  const [submitTarget, setSubmitTarget] = useState<StudentAssignment | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNote, setSubmitNote] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["student-homework"],
    queryFn: async () => {
      const response = await api.get("/student/assignments");
      return (response.data?.data ?? {
        pending: [],
        submitted: [],
      }) as StudentAssignmentsResponse;
    },
  });

  if (isLoading) return <PageLoader />;

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Unable to load homework right now.
        </CardContent>
      </Card>
    );
  }

  const submitHomework = async () => {
    if (!submitTarget) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post(`/student/assignments/${submitTarget.id}/submit`, {
        note: submissionText.trim(),
        file_url: fileUrl.trim() || undefined,
      });
      setSubmitNote(`“${submitTarget.title}” submitted.`);
      setSubmitTarget(null);
      setSubmissionText("");
      setFileUrl("");
      setFileName("");
      await qc.invalidateQueries({ queryKey: ["student-homework"] });
      await qc.invalidateQueries({ queryKey: ["student-dashboard"] });
    } catch (e) {
      setSubmitError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Couldn't submit — try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Real file upload (R4b/H1): pick a file → POST /files/upload (multipart)
  // → the returned public URL rides the submission. Replaces the old
  // "paste a link" input.
  const handleFilePick = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setSubmitError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "homework");
      const res = await api.post("/files/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploaded = res.data?.data;
      const url = Array.isArray(uploaded)
        ? uploaded[0]?.url
        : uploaded?.url;
      if (!url) throw new Error("Upload returned no URL");
      setFileUrl(url);
      setFileName(file.name);
    } catch (e) {
      setSubmitError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (e instanceof Error ? e.message : "Upload failed — try again.")
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Homework</h1>
        <p className="text-muted-foreground">
          Review pending work, submitted tasks, and feedback.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold">{data.pending.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold">{data.submitted.length}</p>
              <p className="text-xs text-muted-foreground">Submitted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--w11-subtle,rgba(0,0,0,0.05))] text-[var(--w11-accent)] flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold">
                {data.pending.filter((assignment) => assignment.is_overdue).length}
              </p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending Homework</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pending.length > 0 ? (
              data.pending.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[assignment.subject, assignment.teacher]
                          .filter(Boolean)
                          .join(" • ") || "Assignment"}
                      </p>
                    </div>
                    <Badge
                      variant={assignment.is_overdue ? "destructive" : "outline"}
                    >
                      {assignment.is_overdue ? "Overdue" : "Pending"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {assignment.description || "No description provided."}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Due: {formatDate(assignment.due_date_bs, assignment.due_date)}</span>
                    <span>Total: {assignment.total_marks ?? "—"}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSubmitTarget(assignment);
                      setSubmitError(null);
                    }}
                  >
                    <Upload className="h-4 w-4 mr-1" /> Submit work
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No pending homework right now.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submitted Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.submitted.length > 0 ? (
              data.submitted.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[assignment.subject, assignment.teacher]
                          .filter(Boolean)
                          .join(" • ") || "Assignment"}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {assignment.marks == null ? "Submitted" : "Graded"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Due: {formatDate(assignment.due_date_bs, assignment.due_date)}</span>
                    <span>
                      Marks: {assignment.marks ?? "Pending"}
                      {assignment.total_marks != null
                        ? ` / ${assignment.total_marks}`
                        : ""}
                    </span>
                  </div>
                  {assignment.feedback ? (
                    <p className="text-sm text-muted-foreground">
                      Feedback: {assignment.feedback}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Submitted homework will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {submitNote && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{submitNote}</p>
      )}

      <Dialog open={Boolean(submitTarget)} onOpenChange={(open) => !open && setSubmitTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit — {submitTarget?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              placeholder="Write your answer or notes about your work…"
              rows={5}
            />
            {/* Real file upload — photo/document straight from the device. */}
            {fileName ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{fileName}</span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => {
                    setFileName("");
                    setFileUrl("");
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/50">
                {uploading ? (
                  <>
                    <Spinner size="sm" /> Uploading…
                  </>
                ) : (
                  <>
                    <Paperclip className="h-4 w-4" />
                    Attach a photo or document (PDF, image, doc…)
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.mp4,.zip"
                  onChange={(e) => {
                    void handleFilePick(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                  disabled={uploading}
                  aria-label="Attach homework file"
                />
              </label>
            )}
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitHomework}
              disabled={submitting || uploading || (!submissionText.trim() && !fileUrl.trim())}
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}