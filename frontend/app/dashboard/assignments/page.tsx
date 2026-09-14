"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/files/FilePicker";
import type { ManagedFile } from "@/lib/services/files.service";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
  Clock, Users, Trash2, Eye, Pencil, FolderOpen, Inbox,
} from "lucide-react";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { useI18n } from "@/lib/i18n";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";

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
  submitted_count?: number;
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
    <AppGate slug="assignments">
      <AssignmentsContent />
    </AppGate>
  );
}

function AssignmentsContent() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdmin = user?.role === "school_admin" || user?.role === "superadmin";
  const [showFilePicker, setShowFilePicker] = useState(false);
  // Wave C (plan 34-29): list becomes A1 + tabs Given / Grading / Graded,
  // with the active tab in the URL (?tab=) per the 33-2 route-tab rule.
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const tab: "given" | "grading" | "graded" =
    (["grading", "graded"].includes(routeParams.get("tab") || "")
      ? (routeParams.get("tab") as "grading" | "graded")
      : "given");
  const setTab = (v: string) => {
    const pathname = windowRoute?.pathname ?? "/dashboard/assignments";
    const next = new URLSearchParams(routeParams.toString());
    if (v === "given") next.delete("tab");
    else next.set("tab", v);
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  };

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
  // Grade form
  const [gradeForm, setGradeForm] = useState({ marks: "", feedback: "" });

  // ── Data queries ──────────────────────────────────────────────────────

  const { data: assignments, isLoading, isError, refetch } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/assignments?per_page=200");
      return (res.data.data as Assignment[]) || [];
    },
    retry: 1,
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

  // AI-grade works per SUBMISSION (backend requires submission_id)
  const aiGradeMut = useMutation({
    mutationFn: async (p: { assignmentId: string; submissionId: string }) =>
      (await api.post(`/assignments/${p.assignmentId}/ai-grade`, { submission_id: p.submissionId })).data,
    onSuccess: (_d, p) => {
      queryClient.invalidateQueries({ queryKey: ["submissions", submissionsFor?.id] });
      toast.success("AI grade suggestion applied — review and save");
    },
    onError: () => toast.error("AI grading failed for this submission"),
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

  function handleAttachmentSelect(files: ManagedFile[]) {
    const urls = files.map((f) => f.url).filter(Boolean);
    if (urls.length > 0) {
      setForm((prev) => ({ ...prev, attachment_urls: [...prev.attachment_urls, ...urls] }));
      toast.success(`${urls.length} file${urls.length === 1 ? "" : "s"} attached from the vault`);
    }
  }

  function removeAttachment(url: string) {
    setForm((prev) => ({ ...prev, attachment_urls: prev.attachment_urls.filter((u) => u !== url) }));
  }

  if (isLoading) return <PageLoader />;

  if (isError)
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title={t("Assignments", "असाइनमेन्ट")}
          subtitle={t("Create, distribute, and grade student assignments", "असाइनमेन्ट बनाउनुहोस्, बाँड्नुहोस् र जाँच गर्नुहोस्")}
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-12 text-center space-y-3">
              <p style={{ color: "#c42b1c" }}>Failed to load assignments.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );

  const allAssignments = assignments || [];
  const isGraded = (a: Assignment) => a.status === "graded" || a.status === "closed" || a.status === "past";
  const buckets = {
    given: allAssignments.filter((a) => !isGraded(a)),
    grading: allAssignments.filter((a) => !isGraded(a) && (a.submitted_count ?? 0) > 0),
    graded: allAssignments.filter(isGraded),
  };
  const tabRows = tab === "grading" ? buckets.grading : tab === "graded" ? buckets.graded : buckets.given;
  const stats = {
    total: allAssignments.length,
    active: allAssignments.filter((a) => a.status === "active").length,
    closed: allAssignments.filter((a) => a.status === "past" || a.status === "closed" || a.status === "graded").length,
  };

  const ASSIGNMENT_COLUMNS: Column<Assignment>[] = [
    {
      key: "title",
      label: t("Assignment", "असाइनमेन्ट"),
      sortable: true,
      value: (a) => a.title,
      render: (a) => (
        <div>
          <p className="font-medium">{a.title}</p>
          {a.description && (
            <p className="text-xs text-[color:var(--w11-text-secondary)] truncate max-w-xs">{a.description}</p>
          )}
          {a.attachment_urls && a.attachment_urls.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Paperclip className="h-3 w-3 text-[color:var(--w11-text-secondary)]" />
              <span className="text-xs text-[color:var(--w11-text-secondary)]">{a.attachment_urls.length} {t("file(s)", "फाइल")}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "class",
      label: t("Class / Subject", "कक्षा / विषय"),
      sortable: true,
      value: (a) => a.class_name ?? "",
      render: (a) => (
        <div>
          <p className="text-sm">{a.class_name || "—"}</p>
          {a.subject_name && <p className="text-xs text-[color:var(--w11-text-secondary)]">{a.subject_name}</p>}
        </div>
      ),
    },
    { key: "due", label: t("Due Date", "म्याद"), sortable: true, value: (a) => a.due_date_bs || a.due_date || "", render: (a) => <span className="text-sm">{displayDate(a.due_date_bs, a.due_date)}</span> },
    { key: "marks", label: t("Marks", "अंक"), align: "right", sortable: true, value: (a) => a.total_marks || 0, render: (a) => <span className="text-sm">{a.total_marks}</span> },
    { key: "status", label: t("Status", "अवस्था"), sortable: true, value: (a) => a.status, render: (a) => <StatusChip status={a.status === "graded" ? "completed" : a.status} /> },
    {
      key: "submissions",
      label: t("Submissions", "पेश भेट"),
      align: "right",
      sortable: true,
      value: (a) => a.submitted_count ?? 0,
      render: (a) => (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSubmissionsFor(a)}>
          <Users className="h-3 w-3 mr-1" />
          {a.submitted_count ?? t("View", "हेर्नुहोस्")}
        </Button>
      ),
      noExport: true,
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      align: "right",
      render: (a) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t("Edit", "सम्पादन")} onClick={() => openEdit(a)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-[#c42b1c]"
            aria-label={t("Delete", "मेटाउनुहोस्")}
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: t("Delete this assignment?", "यो असाइनमेन्ट मेटाउने?"),
                  body: t("Submissions attached to it stay in the record.", "यसमा पेस भएका उत्तरहरू रेकर्डमा रहनेछन्।"),
                  confirmLabel: t("Delete assignment", "मेटाउनुहोस्"),
                  tone: "danger",
                });
                if (ok) deleteMut.mutate(a.id);
              })();
            }}
            disabled={!isAdmin}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AOSPage>
      {/* Header */}
      <AOSPageHeader
        icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Assignments", "असाइनमेन्ट")}
        subtitle={t("Create, distribute, and grade student assignments", "असाइनमेन्ट बनाउनुहोस्, बाँड्नुहोस् र जाँच गर्नुहोस्")}
        actions={
          <Button
            onClick={() => {
              resetForm();
              setEditAssignment(null);
              setShowCreate(true);
            }}
          >
            <PlusCircle className="h-4 w-4 mr-2" /> {t("New Assignment", "नयाँ असाइनमेन्ट")}
          </Button>
        }
      />
      <AOSPageBody>
        {/* Stats */}
        <StatGrid min={180}>
          <KpiCard label={t("Total", "कुल")} value={stats.total} icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label={t("Active", "चालु")} value={stats.active} color="#9d5d00" icon={<Clock className="h-5 w-5" style={{ color: "#9d5d00" }} />} />
          <KpiCard label={t("Closed / Graded", "बन्द / जाँचिएको")} value={stats.closed} icon={<CheckCircle2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </StatGrid>

        {/* Tabs (Given / Grading / Graded) — win11-tablist, URL state */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-3">
            <TabsTrigger value="given" badge={buckets.given.length || undefined}>
              {t("Given", "दिएको")}
            </TabsTrigger>
            <TabsTrigger value="grading" badge={buckets.grading.length || undefined}>
              {t("Grading", "जाँच हुँदै")}
            </TabsTrigger>
            <TabsTrigger value="graded" badge={buckets.graded.length || undefined}>
              {t("Graded", "जाँच सकिएको")}
            </TabsTrigger>
          </TabsList>
          <DataPanel bodyClassName="p-0">
            <DataTable<Assignment>
              columns={ASSIGNMENT_COLUMNS}
              rows={tabRows}
              rowKey={(a) => a.id}
              searchable
              searchPlaceholder={t("Search assignments…", "असाइनमेन्ट खोज्नुहोस्…")}
              exportFileName={`assignments-${tab}`}
              empty={
                tab === "grading"
                  ? { icon: Inbox, title: t("Nothing waiting to grade", "जाँच बाँकी छैन"), body: t("Submissions appear here once students submit.", "विद्यार्थीले पेस गरेपछि यहाँ देखिन्छ।") }
                  : tab === "graded"
                  ? { icon: CheckCircle2, title: t("No graded assignments yet", "अझै जाँचिएको छैन"), body: t("Close or grade an assignment to see it here.", "असाइनमेन्ट बन्द/जाँच गरेपछि यहाँ देखिन्छ।") }
                  : { icon: FileText, title: t("No assignments yet", "अझै असाइनमेन्ट छैन"), body: t("Create your first assignment to distribute it to a class.", "पहिलो असाइनमेन्ट बनाउनुहोस्।"), action: { label: t("New Assignment", "नयाँ असाइनमेन्ट"), onClick: () => { resetForm(); setEditAssignment(null); setShowCreate(true); } } }
              }
            />
          </DataPanel>
        </Tabs>


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
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded" style={{ background: "var(--w11-control-bg)" }}>
                      <Paperclip className="h-3 w-3 text-[color:var(--w11-text-secondary)] flex-shrink-0" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:underline text-xs" style={{ color: "var(--w11-accent)" }}>
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
                onClick={() => setShowFilePicker(true)}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Browse Vault
              </Button>
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
              onClick={() => {
                if (!form.class_id) { toast.error("Select a class"); return; }
                if (!form.subject_id) { toast.error("Select a subject"); return; }
                createMut.mutate();
              }}
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
              <div className="text-center py-12 text-[color:var(--w11-text-secondary)]">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No submissions yet</p>
              </div>
            ) : (
              submissions.map((sub) => (
                <div key={sub.id} className="win11-card" style={{ marginBottom: 0 }}>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{sub.student_name || "Student"}</p>
                        <p className="text-xs text-[color:var(--w11-text-secondary)]">
                          Submitted: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sub.marks !== null && sub.marks !== undefined ? (
                          <span className="win11-chip accent">{sub.marks} / {submissionsFor?.total_marks}</span>
                        ) : (
                          <span className="win11-chip warning">Not graded</span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={aiGradeMut.isPending}
                          onClick={() =>
                            submissionsFor &&
                            aiGradeMut.mutate({ assignmentId: submissionsFor.id, submissionId: sub.id })
                          }
                          title="AI suggests a grade for this submission"
                        >
                          <Brain className="h-3 w-3 mr-1" /> AI
                        </Button>
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
                      <p className="text-sm p-2 rounded text-xs text-[color:var(--w11-text-secondary)]" style={{ background: "var(--w11-control-bg)" }}>
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
                            className="flex items-center gap-1 text-xs hover:underline px-2 py-1 rounded border border-[color:var(--w11-border-subtle)]"
                            style={{ color: "var(--w11-accent)" }}
                          >
                            <Download className="h-3 w-3" />
                            {url.split("/").pop() || `File ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    )}

                    {sub.feedback && (
                      <p className="text-xs italic border-l-2 border-[color:var(--w11-border-strong)] pl-2 text-[color:var(--w11-text-secondary)]">
                        {sub.feedback}
                      </p>
                    )}
                  </div>
                </div>
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
              <p className="text-xs text-[color:var(--w11-text-secondary)]">
                Max marks: {gradeModal?.assignment.total_marks}
              </p>
            </div>
            {gradeModal?.sub.content && (
              <div className="p-3 rounded text-xs max-h-28 overflow-y-auto" style={{ background: "var(--w11-control-bg)" }}>
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
                    className="flex items-center gap-1 text-xs hover:underline"
                    style={{ color: "var(--w11-accent)" }}
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

      <FilePicker
        open={showFilePicker}
        onOpenChange={setShowFilePicker}
        onSelect={handleAttachmentSelect}
        multiple
        title="Select Attachment Files"
      />
      </AOSPageBody>
    </AOSPage>
  );
}
