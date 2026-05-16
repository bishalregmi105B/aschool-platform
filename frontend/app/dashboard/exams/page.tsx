"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus, FileText, BarChart3, ClipboardList, Calendar, GraduationCap,
  MoreHorizontal, Pencil, Trash2, Eye, BookOpen, Trophy, Printer,
} from "lucide-react";

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

const STATUS_CONFIG: Record<string, { variant: "default"|"secondary"|"destructive"|"outline"|"success"|"warning"; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  scheduled: { variant: "outline", label: "Scheduled" },
  ongoing: { variant: "warning", label: "Ongoing" },
  completed: { variant: "default", label: "Completed" },
  result_published: { variant: "success", label: "Results Published" },
};

export default function ExamsPage() {
  return <ExamsContent />;
}

function ExamsContent() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editExam, setEditExam] = useState<Exam | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [academicYearFilter, setAcademicYearFilter] = useState("all");
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

  const { data: exams, isLoading } = useQuery({
    queryKey: ["exams", academicYearFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "200" });
      if (academicYearFilter !== "all") {
        params.set("academic_year_id", academicYearFilter);
      }
      const res = await api.get<ApiResponse<Exam[]>>(`/exams?${params.toString()}`);
      return res.data.data || [];
    },
  });

  const { data: academicYears } = useQuery<AcademicYearOption[]>({
    queryKey: ["academic-years"],
    queryFn: async () => {
      const res = await api.get("/academics/academic-years");
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

  function displayExamDate(bsDate?: string, adDate?: string) {
    return bsDate || adDate || "—";
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
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.put(`/exams/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Status updated");
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
      subject_ids: [],
    });
    setCreateOpen(true);
  }

  if (isLoading) return <PageLoader />;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Examinations</h1>
          <p className="text-muted-foreground">Manage exams, marks entry, results & report cards (NEB grading)</p>
        </div>
        <Button onClick={() => { resetForm(); setEditExam(null); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Create Exam
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Exams", value: stats.total, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Scheduled", value: stats.scheduled, icon: Calendar, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Ongoing", value: stats.ongoing, icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Completed", value: stats.completed, icon: Trophy, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${s.bg}`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/dashboard/exams/marks">
          <Card className="hover:border-primary hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Marks Entry</p>
                <p className="text-[10px] text-muted-foreground">Enter subject marks</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/exams/results">
          <Card className="hover:border-primary hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">View Results</p>
                <p className="text-[10px] text-muted-foreground">NEB graded results</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/exams/report-cards">
          <Card className="hover:border-primary hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium">Report Cards</p>
                <p className="text-[10px] text-muted-foreground">AI-generated reports</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/exams/schedule">
          <Card className="hover:border-primary hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">Exam Schedule</p>
                <p className="text-[10px] text-muted-foreground">Subject-wise timetable</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Filters + Exam List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Exams</CardTitle>
            <div className="flex gap-2">
              <Select value={academicYearFilter} onValueChange={setAcademicYearFilter}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {(academicYears || []).map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name}{year.is_current ? " (Current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {EXAM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {(classes || []).map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam Name</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No exams found. Create your first exam.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((exam) => {
                  const sc = STATUS_CONFIG[exam.status] || STATUS_CONFIG.scheduled;
                  const et = EXAM_TYPES.find((t: any) => t.value === exam.exam_type);
                  return (
                    <TableRow key={exam.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{exam.name}</p>
                          {exam.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs">{exam.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {exam.academic_year_id
                            ? academicYearById.get(exam.academic_year_id)?.name || "—"
                            : "Current"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{et?.icon} {et?.label || exam.exam_type}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{exam.class_name || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p>
                            {displayExamDate(exam.start_date_bs, exam.start_date)}
                          </p>
                          <p className="text-muted-foreground">
                            to {displayExamDate(exam.end_date_bs, exam.end_date)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p>Full: {exam.total_marks || "—"}</p>
                          <p className="text-muted-foreground">Pass: {exam.pass_marks || "35"}</p>
                          {exam.is_practical && (
                            <p className="text-blue-600">Practical: {exam.practical_marks}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sc.variant as any} className="capitalize">
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(exam)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
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
                            {exam.status === "scheduled" && (
                              <DropdownMenuItem onClick={() => statusMutation.mutate({ id: exam.id, status: "ongoing" })}>
                                <Eye className="h-4 w-4 mr-2" /> Mark Ongoing
                              </DropdownMenuItem>
                            )}
                            {exam.status === "ongoing" && (
                              <DropdownMenuItem onClick={() => statusMutation.mutate({ id: exam.id, status: "completed" })}>
                                <Trophy className="h-4 w-4 mr-2" /> Mark Completed
                              </DropdownMenuItem>
                            )}
                            {exam.status === "completed" && (
                              <DropdownMenuItem onClick={() => statusMutation.mutate({ id: exam.id, status: "result_published" })}>
                                <BarChart3 className="h-4 w-4 mr-2" /> Publish Results
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (confirm("Delete this exam?")) deleteMutation.mutate(exam.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* NEB Grading Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4" /> Nepal NEB Grading Scale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {[
              { grade: "A+", pct: "90-100%", gpa: "4.0", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
              { grade: "A", pct: "80-89%", gpa: "3.6", color: "bg-green-100 text-green-800 border-green-300" },
              { grade: "B+", pct: "70-79%", gpa: "3.2", color: "bg-blue-100 text-blue-800 border-blue-300" },
              { grade: "B", pct: "60-69%", gpa: "2.8", color: "bg-sky-100 text-sky-800 border-sky-300" },
              { grade: "C+", pct: "50-59%", gpa: "2.4", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
              { grade: "C", pct: "40-49%", gpa: "2.0", color: "bg-orange-100 text-orange-800 border-orange-300" },
              { grade: "D", pct: "35-39%", gpa: "1.6", color: "bg-amber-100 text-amber-800 border-amber-300" },
              { grade: "NG", pct: "<35%", gpa: "0.0", color: "bg-red-100 text-red-800 border-red-300" },
            ].map((g) => (
              <div key={g.grade} className={`p-2 rounded-lg border text-center ${g.color}`}>
                <p className="text-lg font-bold">{g.grade}</p>
                <p className="text-[10px]">{g.pct}</p>
                <p className="text-[10px] font-medium">GPA {g.gpa}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                  <span className="ml-2 text-xs text-muted-foreground">(marks config per subject from Academic setup)</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-3 rounded-lg border bg-muted/30">
                  {(subjectsForClass || []).length === 0 ? (
                    <p className="col-span-2 text-xs text-muted-foreground text-center py-4">
                      No subjects found for this class. Add subjects in Academic Setup.
                    </p>
                  ) : (
                    (subjectsForClass || []).map((sub: { id: string; name: string; has_practical?: boolean; full_marks?: number; pass_marks?: number }) => (
                      <label
                        key={sub.id}
                        className={`flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-background border transition-colors ${
                          formData.subject_ids.includes(sub.id) ? "border-primary bg-primary/5" : "border-transparent"
                        }`}
                      >
                        <Checkbox
                          checked={formData.subject_ids.includes(sub.id)}
                          onCheckedChange={() => toggleSubjectId(sub.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium leading-none">{sub.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
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
                <Input
                  value={formData.start_date_bs}
                  onChange={(e) => setFormData({ ...formData, start_date_bs: e.target.value })}
                  placeholder="2082-06-15"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date (BS)</Label>
                <Input
                  value={formData.end_date_bs}
                  onChange={(e) => setFormData({ ...formData, end_date_bs: e.target.value })}
                  placeholder="2082-06-30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Full Marks <span className="text-xs text-muted-foreground">(overridden per subject)</span></Label>
                <Input
                  type="number"
                  value={formData.total_marks}
                  onChange={(e) => setFormData({ ...formData, total_marks: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Default Pass Marks <span className="text-xs text-muted-foreground">(NEB: 35%)</span></Label>
                <Input
                  type="number"
                  value={formData.pass_marks}
                  onChange={(e) => setFormData({ ...formData, pass_marks: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <Checkbox
                id="is_practical"
                checked={formData.is_practical}
                onCheckedChange={(checked) => setFormData({ ...formData, is_practical: !!checked })}
              />
              <div className="flex-1">
                <label htmlFor="is_practical" className="text-sm font-medium cursor-pointer">
                  Has Practical Component
                </label>
                <p className="text-[10px] text-muted-foreground">NEB: Theory must be ≥35%, Practical must be ≥40%</p>
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
    </div>
  );
}
