"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  PlusCircle, FileText, Brain, Paperclip, X, Download, CheckCircle2,
  Clock, Users, Trash2, Eye, Pencil, Upload,
} from "lucide-react";
import { BSDateInput } from "@/components/ui/bs-date-input";

interface Assignment {
  id: string;
  title: string;
  description: string;
  class_id: string;
  class_name?: string;
  section_id?: string;
  section_name?: string;
  subject_id?: string;
  subject_name?: string;
  due_date: string;
  due_date_bs?: string;
  total_marks: number;
  status: string;
  attachment_urls?: string[];
  submission_count?: number;
}

interface Submission {
  id: string;
  student_id: string;
  student_name?: string;
  content?: string;
  attachment_urls?: string[];
  marks?: number;
  feedback?: string;
  submitted_at?: string;
  status?: string;
}

function displayDate(bsDate?: string, adDate?: string) {
  return bsDate || adDate || "—";
}

export default function AssignmentsPage() {
  return (
    <PluginGate slug="assignments">
      <AssignmentsContent />
    </PluginGate>
  );
}

function AssignmentsContent() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [submissionsFor, setSubmissionsFor] = useState<Assignment | null>(null);
  const [gradeModal, setGradeModal] = useState<{ sub: Submission; assignment: Assignment } | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    class_id: "",
    section_id: "",
    subject_id: "",
    due_date: "",
    total_marks: "10",
    attachment_urls: [] as string[],
  });
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Grade form
  const [gradeForm, setGradeForm] = useState({ marks: "", feedback: "" });

  // ── Data queries ──────────────────────────────────────────────────────

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/assignments?per_page=200");
      return (res.data.data as Assignment[]) || [];
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const selectedClass = (classes || []).find((c: { id: string }) => c.id === form.class_id) as
    | { id: string; name: string; sections?: { id: string; name: string }[] }
    | undefined;

  const { data: subjectsForClass } = useQuery({
    queryKey: ["subjects-for-class", form.class_id],
    queryFn: async () => {
      if (!form.class_id) return [];
      const res = await api.get(`/academics/subjects?class_id=${form.class_id}`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!form.class_id,
  });

  const { data: submissions, isLoading: loadingSubmissions } = useQuery({
    queryKey: ["submissions", submissionsFor?.id],
    queryFn: async () => {
      if (!submissionsFor) return [];
      const res = await api.get(`/assignments/${submissionsFor.id}/submissions`);
      return (res.data?.data as Submission[]) || [];
    },
    enabled: !!submissionsFor,
  });

  // ── Mutations ──────────────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        class_id: form.class_id || undefined,
        section_id: form.section_id || undefined,
        subject_id: form.subject_id || undefined,
        due_date: form.due_date || undefined,
        total_marks: parseInt(form.total_marks) || 10,
        attachment_urls: form.attachment_urls.length > 0 ? form.attachment_urls : undefined,
      };
      if (editAssignment) {
        return (await api.put(`/assignments/${editAssignment.id}`, payload)).data;
      }
      return (await api.post("/assignments", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setShowCreate(false);
      setEditAssignment(null);
      toast.success(editAssignment ? "Assignment updated" : "Assignment created");
      resetForm();
    },
    onError: () => toast.error("Failed to save assignment"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/assignments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Assignment deleted");
    },
  });

  const gradeMut = useMutation({
    mutationFn: async () => {
      if (!gradeModal) return;
      return (
        await api.post(
          `/assignments/${gradeModal.assignment.id}/submissions/${gradeModal.sub.id}/grade`,
          {
            marks: parseFloat(gradeForm.marks),
            feedback: gradeForm.feedback || undefined,
          },
        )
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions", gradeModal?.assignment.id] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setGradeModal(null);
      toast.success("Grade saved");
    },
    onError: () => toast.error("Failed to save grade"),
  });

  const aiGradeMut = useMutation({
    mutationFn: async (id: string) => (await api.post(`/assignments/${id}/ai-grade`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("AI grading started — results will appear shortly");
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  function resetForm() {
    setForm({ title: "", description: "", class_id: "", section_id: "", subject_id: "", due_date: "", total_marks: "10", attachment_urls: [] });
  }

  function openEdit(a: Assignment) {
    setEditAssignment(a);
    setForm({
      title: a.title,
      description: a.description || "",
      class_id: a.class_id || "",
      section_id: a.section_id || "",
      subject_id: a.subject_id || "",
      due_date: a.due_date_bs || a.due_date || "",
      total_marks: String(a.total_marks || 10),
      attachment_urls: a.attachment_urls || [],
    });
    setShowCreate(true);
  }

  async function handleAttachmentUpload(file: File) {
    setUploadingAttachment(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "assignments");
      const res = await api.post("/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.data?.url || res.data?.url;
      if (url) setForm((prev) => ({ ...prev, attachment_urls: [...prev.attachment_urls, url] }));
    } catch {
      toast.error("File upload failed");
    } finally {
      setUploadingAttachment(false);
    }
  }

  function removeAttachment(url: string) {
    setForm((prev) => ({ ...prev, attachment_urls: prev.attachment_urls.filter((u) => u !== url) }));
  }

  if (isLoading) return <PageLoader />;

  const allAssignments = assignments || [];
  const stats = {
    total: allAssignments.length,
    active: allAssignments.filter((a) => a.status === "active").length,
    closed: allAssignments.filter((a) => a.status === "closed" || a.status === "graded").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-muted-foreground">Create, distribute, and grade student assignments</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setEditAssignment(null);
            setShowCreate(true);
          }}
        >
          <PlusCircle className="h-4 w-4 mr-2" /> New Assignment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Closed / Graded</p>
              <p className="text-2xl font-bold">{stats.closed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assignments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignment</TableHead>
                <TableHead>Class / Subject</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No assignments yet. Create your first assignment.
                  </TableCell>
                </TableRow>
              ) : (
                allAssignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{a.title}</p>
                        {a.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{a.description}</p>
                        )}
                        {a.attachment_urls && a.attachment_urls.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{a.attachment_urls.length} file(s)</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{a.class_name || "—"}</p>
                      {a.subject_name && (
                        <p className="text-xs text-muted-foreground">{a.subject_name}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{displayDate(a.due_date_bs, a.due_date)}</TableCell>
                    <TableCell className="text-sm">{a.total_marks}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "active" ? "default" : a.status === "graded" ? "success" : "secondary"}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setSubmissionsFor(a)}
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {a.submission_count ?? "View"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => aiGradeMut.mutate(a.id)}
                          title="AI Auto-grade"
                        >
                          <Brain className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            if (confirm("Delete this assignment?")) deleteMut.mutate(a.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Create / Edit Dialog ── */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) { setShowCreate(false); setEditAssignment(null); }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editAssignment ? "Edit Assignment" : "Create Assignment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Assignment title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description / Instructions</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Describe the assignment task..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select
                  value={form.class_id}
                  onValueChange={(v) => setForm({ ...form, class_id: v, section_id: "", subject_id: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {(classes || []).map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={form.section_id} onValueChange={(v) => setForm({ ...form, section_id: v })}>
                  <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
                  <SelectContent>
                    {(selectedClass?.sections || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {(subjectsForClass || []).map((s: { id: string; name: string }) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Marks</Label>
                <Input
                  type="number"
                  value={form.total_marks}
                  onChange={(e) => setForm({ ...form, total_marks: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date (BS)</Label>
                <BSDateInput value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Attachments (Reference Files)</Label>
              {form.attachment_urls.length > 0 && (
                <div className="space-y-1">
                  {form.attachment_urls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                      <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline text-xs">
                        {url.split("/").pop() || url}
                      </a>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => removeAttachment(url)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAttachment}
              >
                {uploadingAttachment ? (
                  <Spinner className="mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {uploadingAttachment ? "Uploading…" : "Attach File"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAttachmentUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowCreate(false); setEditAssignment(null); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.title}
            >
              {createMut.isPending ? "Saving…" : editAssignment ? "Update" : "Create Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Submissions Dialog ── */}
      <Dialog open={!!submissionsFor} onOpenChange={(open) => !open && setSubmissionsFor(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-base">
              Submissions — {submissionsFor?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] space-y-3 pr-1">
            {loadingSubmissions ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : !submissions || submissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No submissions yet</p>
              </div>
            ) : (
              submissions.map((sub) => (
                <Card key={sub.id} className="border">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{sub.student_name || "Student"}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sub.marks !== null && sub.marks !== undefined ? (
                          <Badge variant="default">{sub.marks} / {submissionsFor?.total_marks}</Badge>
                        ) : (
                          <Badge variant="secondary">Not graded</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setGradeForm({ marks: String(sub.marks ?? ""), feedback: sub.feedback ?? "" });
                            setGradeModal({ sub, assignment: submissionsFor! });
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Grade
                        </Button>
                      </div>
                    </div>

                    {sub.content && (
                      <p className="text-sm text-muted-foreground bg-muted p-2 rounded text-xs">
                        {sub.content}
                      </p>
                    )}

                    {sub.attachment_urls && sub.attachment_urls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {sub.attachment_urls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline bg-primary/5 px-2 py-1 rounded border border-primary/20"
                          >
                            <Download className="h-3 w-3" />
                            {url.split("/").pop() || `File ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    )}

                    {sub.feedback && (
                      <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2">
                        {sub.feedback}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Grade Dialog ── */}
      <Dialog open={!!gradeModal} onOpenChange={(open) => !open && setGradeModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{gradeModal?.sub.student_name}</p>
              <p className="text-xs text-muted-foreground">
                Max marks: {gradeModal?.assignment.total_marks}
              </p>
            </div>
            {gradeModal?.sub.content && (
              <div className="p-3 bg-muted rounded text-xs max-h-28 overflow-y-auto">
                {gradeModal.sub.content}
              </div>
            )}
            {gradeModal?.sub.attachment_urls && gradeModal.sub.attachment_urls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {gradeModal.sub.attachment_urls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Eye className="h-3 w-3" /> View File {i + 1}
                  </a>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label>Marks *</Label>
              <Input
                type="number"
                value={gradeForm.marks}
                onChange={(e) => setGradeForm({ ...gradeForm, marks: e.target.value })}
                placeholder={`0 – ${gradeModal?.assignment.total_marks}`}
                max={gradeModal?.assignment.total_marks}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Feedback / Comments</Label>
              <Textarea
                value={gradeForm.feedback}
                onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                rows={3}
                placeholder="Optional written feedback for the student..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeModal(null)}>Cancel</Button>
            <Button
              onClick={() => gradeMut.mutate()}
              disabled={gradeMut.isPending || !gradeForm.marks}
            >
              {gradeMut.isPending ? "Saving…" : "Save Grade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
