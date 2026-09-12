"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { DataTable, type Column } from "@/components/ui/data-table";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  DataPanel, StatusChip, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  Plus, FileText, BarChart3, ClipboardList, Calendar, GraduationCap,
  MoreHorizontal, Pencil, Trash2, Eye, BookOpen, Trophy, Printer,
} from "lucide-react";
import { formatNepaliDate, displayBS } from "@/lib/nepali_date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Exam {
  id: string;
  name: string;
  name_nepali?: string;
  exam_type: string;
  academic_year_id?: string;
  class_id?: string;
  class_name?: string;
  start_date: string;
  end_date: string;
  start_date_bs?: string;
  end_date_bs?: string;
  total_marks?: number;
  pass_marks?: number;
  is_practical?: boolean;
  practical_marks?: number;
  status: string;
  description?: string;
}

interface AcademicYearOption {
  id: string;
  name: string;
  is_current?: boolean;
}

const EXAM_TYPES = [
  { value: "unit_test", label: "Unit Test", icon: "📝" },
  { value: "terminal", label: "Terminal Exam", icon: "📋" },
  { value: "annual", label: "Annual Exam", icon: "🏆" },
  { value: "pre_board", label: "Pre-Board", icon: "📚" },
  { value: "board_trial", label: "Board Trial", icon: "📄" },
  { value: "see_mock", label: "SEE Mock", icon: "🎯" },
  { value: "class_test", label: "Class Test", icon: "✏️" },
];

// Exam status → display label + StatusChip tone key (page-kit auto-map
// covers completed/published; ongoing needs the warning tone, so it rides
// the "pending" key with an explicit label).
const STATUS_CONFIG: Record<string, { tone: string; label: string }> = {
  draft: { tone: "draft", label: "Draft" },
  scheduled: { tone: "scheduled", label: "Scheduled" },
  ongoing: { tone: "pending", label: "Ongoing" },
  completed: { tone: "completed", label: "Completed" },
  result_published: { tone: "published", label: "Results Published" },
};

/** Fluent status palette (same values the 11.css win11-chip tones use). */
const W11_SUCCESS = "#107c10";
const W11_WARNING = "#d83b01";

export default function ExamsPage() {
  return <ExamsContent />;
}

/** Row actions dropdown — extracted so DataTable cells can render it.
 *  Edit/status/delete mutations stay in ExamsContent and arrive as props. */
function ExamRowActions({
  exam,
  isAdmin,
  onEdit,
  onStatus,
  onDelete,
}: {
  exam: any;
  isAdmin: boolean;
  onEdit: (exam: any) => void;
  onStatus: (id: string, status: string) => void;
  onDelete: (exam: any) => void;
}) {
  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isAdmin && (
            <DropdownMenuItem onClick={() => onEdit(exam)}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
          )}
          <Link href={`/dashboard/exams/marks?exam=${exam.id}`}>
            <DropdownMenuItem>
              <ClipboardList className="h-4 w-4 mr-2" /> Enter Marks
            </DropdownMenuItem>
          </Link>
          <Link href={`/dashboard/exams/results?exam=${exam.id}`}>
            <DropdownMenuItem>
              <BarChart3 className="h-4 w-4 mr-2" /> View Results
            </DropdownMenuItem>
          </Link>
          <Link href={`/dashboard/exams/report-cards?exam=${exam.id}`}>
            <DropdownMenuItem>
              <Printer className="h-4 w-4 mr-2" /> Report Cards
            </DropdownMenuItem>
          </Link>
          {isAdmin && exam.status === "scheduled" && (
            <DropdownMenuItem onClick={() => onStatus(exam.id, "ongoing")}>
              <Eye className="h-4 w-4 mr-2" /> Mark Ongoing
            </DropdownMenuItem>
          )}
          {isAdmin && exam.status === "ongoing" && (
            <DropdownMenuItem onClick={() => onStatus(exam.id, "completed")}>
              <Trophy className="h-4 w-4 mr-2" /> Mark Completed
            </DropdownMenuItem>
          )}
          {isAdmin && exam.status === "completed" && (
            <DropdownMenuItem onClick={() => onStatus(exam.id, "result_published")}>
              <BarChart3 className="h-4 w-4 mr-2" /> Publish Results
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <DropdownMenuItem className="!text-[#c42b1c]" onClick={() => onDelete(exam)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ExamsContent() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isAdmin = user?.role === "school_admin";
  const [createOpen, setCreateOpen] = useState(false);
  const [editExam, setEditExam] = useState<Exam | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [academicYearFilter, setAcademicYearFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    name_nepali: "",
    exam_type: "terminal",
    academic_year_id: "current",
    class_id: "",
    start_date_bs: "",
    end_date_bs: "",
    total_marks: "100",
    pass_marks: "35",
    is_practical: false,
    practical_marks: "25",
    description: "",
    subject_ids: [] as string[],
  });

  const { data: exams, isLoading, isError, refetch } = useQuery({
    queryKey: ["exams", academicYearFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "200" });
      if (academicYearFilter !== "all") {
        params.set("academic_year_id", academicYearFilter);
      }
      const res = await api.get<ApiResponse<Exam[]>>(`/exams?${params.toString()}`);
      return res.data.data || [];
    },
    retry: 1,
  });

  const { data: academicYears } = useQuery<AcademicYearOption[]>({
    queryKey: ["academic-years"],
    queryFn: async () => {
      const res = await api.get("/academics/years?per_page=200");
      return Array.isArray(res.data?.data)
        ? (res.data.data as AcademicYearOption[])
        : [];
    },
  });

  useEffect(() => {
    if (academicYearFilter !== "all" || !academicYears?.length) return;
    const current = academicYears.find((year) => year.is_current);
    if (current?.id) {
      setAcademicYearFilter(current.id);
    }
  }, [academicYearFilter, academicYears]);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  // Fetch subjects for selected class (for the exam creation dialog)
  const { data: subjectsForClass } = useQuery({
    queryKey: ["subjects-for-class", formData.class_id],
    queryFn: async () => {
      if (!formData.class_id) return [];
      const res = await api.get(`/academics/subjects?class_id=${formData.class_id}`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!formData.class_id && createOpen,
  });

  function toggleSubjectId(id: string) {
    setFormData((prev) => ({
      ...prev,
      subject_ids: prev.subject_ids.includes(id)
        ? prev.subject_ids.filter((s) => s !== id)
        : [...prev.subject_ids, id],
    }));
  }

  // E217: exams stored BS dates ("2082-06-15") as raw opaque strings that were
  // indistinguishable from AD. Render BS long-form ("15 Ashwin 2082", the same
  // "14 Bhadra 2083" style as the attendance picker): a stored BS string goes
  // through formatNepaliDate, an AD-only date is converted with displayBS.
  function displayExamDate(bsDate?: string, adDate?: string) {
    if (bsDate) return formatNepaliDate(bsDate);
    if (adDate) return displayBS(adDate);
    return "—";
  }

  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const body = {
        ...payload,
        total_marks: parseInt(payload.total_marks),
        pass_marks: parseInt(payload.pass_marks),
        practical_marks: payload.is_practical ? parseInt(payload.practical_marks) : 0,
        academic_year_id:
          payload.academic_year_id && payload.academic_year_id !== "current"
            ? payload.academic_year_id
            : undefined,
        class_id: payload.class_id || undefined,
        subject_ids: payload.subject_ids.length > 0 ? payload.subject_ids : undefined,
      };
      if (editExam) {
        return (await api.put(`/exams/${editExam.id}`, body)).data;
      }
      return (await api.post("/exams", body)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      setCreateOpen(false);
      setEditExam(null);
      toast.success(editExam ? "Exam updated" : "Exam created");
      resetForm();
    },
    onError: () => toast.error("Failed to save exam"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/exams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam deleted");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (status === "result_published") {
        // dedicated publish endpoint — emits results.published so students
        // and parents get notified (PUT alone does not)
        return api.post(`/exams/${id}/publish`);
      }
      return api.put(`/exams/${id}`, { status });
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success(vars.status === "result_published" ? "Results published — students and parents notified" : "Status updated");
    },
  });

  function resetForm() {
    setFormData({
      name: "", name_nepali: "", exam_type: "terminal", academic_year_id: "current", class_id: "",
      start_date_bs: "", end_date_bs: "", total_marks: "100", pass_marks: "35",
      is_practical: false, practical_marks: "25", description: "", subject_ids: [],
    });
  }

  function openEdit(exam: Exam) {
    setEditExam(exam);
    setFormData({
      name: exam.name,
      name_nepali: exam.name_nepali || "",
      exam_type: exam.exam_type,
      academic_year_id: exam.academic_year_id || "current",
      class_id: exam.class_id || "",
      start_date_bs: exam.start_date_bs || exam.start_date || "",
      end_date_bs: exam.end_date_bs || exam.end_date || "",
      total_marks: String(exam.total_marks || 100),
      pass_marks: String(exam.pass_marks || 35),
      is_practical: exam.is_practical || false,
      practical_marks: String(exam.practical_marks || 25),
      description: exam.description || "",
      subject_ids: (exam as any).subject_ids || [],
    });
    setCreateOpen(true);
  }

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          title="Examinations"
          subtitle="Manage exams, marks entry, results & report cards (NEB grading)"
        />
        <AOSPageBody>
          <div className="win11-card flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-[#c42b1c]">Failed to load exams. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  if (isLoading) return <AOSPage><AOSModuleLoadingState label="Loading exams…" /></AOSPage>;
  const allExams = exams || [];
  const academicYearById = new Map<string, AcademicYearOption>(
    (academicYears || []).map((year) => [year.id, year]),
  );
  const filtered = allExams.filter((e) => {
    if (typeFilter !== "all" && e.exam_type !== typeFilter) return false;
    if (classFilter !== "all" && e.class_id !== classFilter) return false;
    return true;
  });

  const stats = {
    total: allExams.length,
    scheduled: allExams.filter((e: any) => e.status === "scheduled").length,
    ongoing: allExams.filter((e: any) => e.status === "ongoing").length,
    completed: allExams.filter((e: any) => e.status === "completed" || e.status === "result_published").length,
  };

  const EXAM_COLUMNS: Column<any>[] = [
    {
      key: "name",
      label: "Exam Name",
      sortable: true,
      value: (e) => e.name,
      render: (e) => (
        <div>
          <p className="font-medium">{e.name}</p>
          {e.description && (
            <p className="text-xs text-[color:var(--w11-text-secondary)] truncate max-w-xs">{e.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "session",
      label: "Session",
      sortable: true,
      value: (e) => (e.academic_year_id ? academicYearById.get(e.academic_year_id)?.name ?? "" : "Current"),
      render: (e) => (
        <span className="text-xs">
          {e.academic_year_id ? academicYearById.get(e.academic_year_id)?.name || "—" : "Current"}
        </span>
      ),
    },
    {
      key: "exam_type",
      label: "Type",
      sortable: true,
      value: (e) => e.exam_type,
      render: (e) => {
        const et = EXAM_TYPES.find((t: any) => t.value === e.exam_type);
        return <span className="text-xs">{et?.icon} {et?.label || e.exam_type}</span>;
      },
    },
    { key: "class_name", label: "Class", sortable: true, value: (e) => e.class_name || "", render: (e) => <span className="text-sm">{e.class_name || "—"}</span> },
    {
      key: "dates",
      label: "Dates",
      value: (e) => e.start_date || e.start_date_bs || "",
      render: (e) => (
        <div className="text-xs">
          <p>{displayExamDate(e.start_date_bs, e.start_date)}</p>
          <p className="text-[color:var(--w11-text-secondary)]">
            to {displayExamDate(e.end_date_bs, e.end_date)}
          </p>
        </div>
      ),
    },
    {
      key: "marks",
      label: "Marks",
      align: "right",
      value: (e) => e.total_marks || 0,
      render: (e) => (
        <div className="text-xs">
          <p>Full: {e.total_marks || "—"}</p>
          <p className="text-[color:var(--w11-text-secondary)]">Pass: {e.pass_marks || "35"}</p>
          {e.is_practical && <p className="text-[color:var(--w11-accent)]">Practical: {e.practical_marks}</p>}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (e) => e.status,
      render: (e) => {
        const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.scheduled;
        return <StatusChip status={sc.tone} label={sc.label} />;
      },
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (e) => (
        <ExamRowActions
          exam={e}
          isAdmin={isAdmin}
          onEdit={(ex) => { openEdit(ex); }}
          onStatus={(id, status) => statusMutation.mutate({ id, status })}
          onDelete={(ex) => {
            void (async () => {
              const ok = await confirm({
                title: "Delete this exam?",
                body: "Marks and report cards already recorded stay in the archive.",
                confirmLabel: "Delete exam",
                tone: "danger",
              });
              if (ok) deleteMutation.mutate(ex.id);
            })();
          }}
        />
      ),
    },
  ];

  const QUICK_LINKS = [
    { href: "/dashboard/exams/marks", icon: ClipboardList, title: "Marks Entry", note: "Enter subject marks" },
    { href: "/dashboard/exams/results", icon: BarChart3, title: "View Results", note: "NEB graded results" },
    { href: "/dashboard/exams/report-cards", icon: FileText, title: "Report Cards", note: "AI-generated reports" },
    { href: "/dashboard/exams/schedule", icon: Calendar, title: "Exam Schedule", note: "Subject-wise timetable" },
  ];

  // NEB grade tiles painted with the Fluent status palette (the same
  // bg/border/text recipe the 11.css win11-chip tones use).
  const NEB_GRADES = [
    { grade: "A+", pct: "90-100%", gpa: "4.0", color: W11_SUCCESS },
    { grade: "A", pct: "80-89%", gpa: "3.6", color: W11_SUCCESS },
    { grade: "B+", pct: "70-79%", gpa: "3.2", color: "var(--w11-accent)" },
    { grade: "B", pct: "60-69%", gpa: "2.8", color: "var(--w11-accent)" },
    { grade: "C+", pct: "50-59%", gpa: "2.4", color: W11_WARNING },
    { grade: "C", pct: "40-49%", gpa: "2.0", color: W11_WARNING },
    { grade: "D", pct: "35-39%", gpa: "1.6", color: W11_WARNING },
    { grade: "NG", pct: "<35%", gpa: "0.0", color: "#c42b1c" },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        title="Examinations"
        subtitle={`${allExams.length} exams · Manage marks entry, results & report cards (NEB grading)`}
        actions={
          isAdmin ? (
            <Button onClick={() => { resetForm(); setEditExam(null); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Create Exam
            </Button>
          ) : (
            <span className="text-xs text-[color:var(--w11-text-secondary)]">Only admins can create exams</span>
          )
        }
      />
      <AOSPageBody className="space-y-4">
        {/* Stats */}
        <StatGrid className="mb-0">
          <KpiCard label="Total Exams" value={stats.total} icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Scheduled" value={stats.scheduled} icon={<Calendar className="h-5 w-5" style={{ color: "var(--w11-text-primary)" }} />} color="var(--w11-text-primary)" />
          <KpiCard label="Ongoing" value={stats.ongoing} icon={<ClipboardList className="h-5 w-5" style={{ color: W11_WARNING }} />} color={W11_WARNING} />
          <KpiCard label="Completed" value={stats.completed} icon={<Trophy className="h-5 w-5" style={{ color: W11_SUCCESS }} />} color={W11_SUCCESS} />
        </StatGrid>

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              <div className="win11-card p-4 flex items-center gap-3 cursor-pointer transition-colors hover:border-[var(--w11-accent)]">
                <l.icon className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />
                <div>
                  <p className="text-sm font-medium">{l.title}</p>
                  <p className="text-[10px] text-[color:var(--w11-text-secondary)]">{l.note}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Filters + Exam List — DataTable owns search/filters/actions */}
        <DataPanel title={`All Exams (${filtered.length})`}>
          <DataTable
            columns={EXAM_COLUMNS}
            rows={filtered}
            rowKey={(e) => e.id}
            searchable
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search exams…"
            exportFileName="exams"
            toolbar={
              <div className="flex gap-2">
                <AdvancedSelect
                  className="w-40"
                  triggerClassName="h-8 text-xs"
                  value={academicYearFilter}
                  onChange={setAcademicYearFilter}
                  clearable
                  placeholder="All Sessions"
                  options={(academicYears || []).map((year) => ({
                    value: year.id,
                    label: year.name + (year.is_current ? " (Current)" : ""),
                  }))}
                />
                <AdvancedSelect
                  className="w-36"
                  triggerClassName="h-8 text-xs"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  clearable
                  placeholder="All Types"
                  options={EXAM_TYPES.map((t: any) => ({ value: t.value, label: `${t.icon} ${t.label}` }))}
                />
                <AdvancedSelect
                  className="w-36"
                  triggerClassName="h-8 text-xs"
                  value={classFilter}
                  onChange={setClassFilter}
                  clearable
                  placeholder="All Classes"
                  options={(classes || []).map((c: { id: string; name: string }) => ({ value: c.id, label: c.name }))}
                />
              </div>
            }
            empty={{
              icon: GraduationCap,
              title: "No exams found",
              body: "Create your first exam to start recording marks.",
              action: isAdmin ? { label: "Create Exam", onClick: () => setCreateOpen(true) } : undefined,
            }}
          />
        </DataPanel>

        {/* NEB Grading Reference */}
        <DataPanel
          title={
            <span className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> Nepal NEB Grading Scale
            </span>
          }
        >
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {NEB_GRADES.map((g) => (
              <div
                key={g.grade}
                className="p-2 rounded-lg border text-center"
                style={{
                  background: `color-mix(in srgb, ${g.color} 12%, transparent)`,
                  borderColor: `color-mix(in srgb, ${g.color} 30%, transparent)`,
                  color: g.color,
                }}
              >
                <p className="text-lg font-bold">{g.grade}</p>
                <p className="text-[10px]">{g.pct}</p>
                <p className="text-[10px] font-medium">GPA {g.gpa}</p>
              </div>
            ))}
          </div>
        </DataPanel>

        {/* Create / Edit Dialog */}
        <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditExam(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editExam ? "Edit Exam" : "Create New Exam"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>Exam Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. First Terminal Exam 2082"
                  />
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>Name (Nepali)</Label>
                  <Input
                    value={formData.name_nepali}
                    onChange={(e) => setFormData({ ...formData, name_nepali: e.target.value })}
                    placeholder="e.g. प्रथम सत्र परीक्षा"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Exam Type *</Label>
                  <Select
                    value={formData.exam_type}
                    onValueChange={(v) => setFormData({ ...formData, exam_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXAM_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Academic Session</Label>
                  <Select
                    value={formData.academic_year_id}
                    onValueChange={(v) => setFormData({ ...formData, academic_year_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Use current session" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Use current active session</SelectItem>
                      {(academicYears || []).map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name}{year.is_current ? " (Current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select
                    value={formData.class_id}
                    onValueChange={(v) => setFormData({ ...formData, class_id: v, subject_ids: [] })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {(classes || []).map((c: { id: string; name: string }) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Subject selection — only when a class is picked */}
              {formData.class_id && (
                <div className="space-y-2">
                  <Label>
                    Subjects Included in this Exam
                    <span className="ml-2 text-xs text-[color:var(--w11-text-secondary)]">(marks config per subject from Academic setup)</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-3 rounded-lg border border-[var(--w11-border-default)] bg-[color:var(--w11-control-hover)]">
                    {(subjectsForClass || []).length === 0 ? (
                      <p className="col-span-2 text-xs text-[color:var(--w11-text-secondary)] text-center py-4">
                        No subjects found for this class. Add subjects in Academic Setup.
                      </p>
                    ) : (
                      (subjectsForClass || []).map((sub: { id: string; name: string; has_practical?: boolean; full_marks?: number; pass_marks?: number }) => (
                        <label
                          key={sub.id}
                          className={`flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-[color:var(--w11-control-bg)] border transition-colors ${
                            formData.subject_ids.includes(sub.id)
                              ? "border-[var(--w11-accent)] bg-[color:var(--w11-accent-light)]"
                              : "border-transparent"
                          }`}
                        >
                          <Checkbox
                            checked={formData.subject_ids.includes(sub.id)}
                            onCheckedChange={() => toggleSubjectId(sub.id)}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-medium leading-none">{sub.name}</p>
                            <p className="text-[10px] text-[color:var(--w11-text-secondary)] mt-0.5">
                              FM: {sub.full_marks ?? "—"} | PM: {sub.pass_marks ?? "—"}
                              {sub.has_practical && " | Practical"}
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  {(subjectsForClass || []).length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => setFormData({ ...formData, subject_ids: (subjectsForClass || []).map((s: { id: string }) => s.id) })}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => setFormData({ ...formData, subject_ids: [] })}
                      >
                        Clear All
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date (BS)</Label>
                  <BSDateInput
                    value={formData.start_date_bs}
                    onChange={(v) => setFormData({ ...formData, start_date_bs: v })}
                    emit="bs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date (BS)</Label>
                  <BSDateInput
                    value={formData.end_date_bs}
                    onChange={(v) => setFormData({ ...formData, end_date_bs: v })}
                    emit="bs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Full Marks <span className="text-xs text-[color:var(--w11-text-secondary)]">(overridden per subject)</span></Label>
                  <Input
                    type="number"
                    value={formData.total_marks}
                    onChange={(e) => setFormData({ ...formData, total_marks: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Pass Marks <span className="text-xs text-[color:var(--w11-text-secondary)]">(NEB: 35%)</span></Label>
                  <Input
                    type="number"
                    value={formData.pass_marks}
                    onChange={(e) => setFormData({ ...formData, pass_marks: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--w11-border-default)] bg-[color:var(--w11-control-hover)]">
                <Checkbox
                  id="is_practical"
                  checked={formData.is_practical}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_practical: !!checked })}
                />
                <div className="flex-1">
                  <label htmlFor="is_practical" className="text-sm font-medium cursor-pointer">
                    Has Practical Component
                  </label>
                  <p className="text-[10px] text-[color:var(--w11-text-secondary)]">NEB: Theory must be ≥35%, Practical must be ≥40%</p>
                </div>
                {formData.is_practical && (
                  <div className="w-24">
                    <Input
                      type="number"
                      value={formData.practical_marks}
                      onChange={(e) => setFormData({ ...formData, practical_marks: e.target.value })}
                      placeholder="Practical marks"
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Description / Instructions</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional exam instructions..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); setEditExam(null); }}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending || !formData.name}
              >
                {createMutation.isPending ? "Saving..." : editExam ? "Update Exam" : "Create Exam"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
