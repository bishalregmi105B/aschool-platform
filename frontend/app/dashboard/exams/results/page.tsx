"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { usePluginEnabled } from "@/lib/plugin-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  Trophy,
  TrendingUp,
  AlertTriangle,
  FileText,
  X,
  Palette,
  Download,
  TableIcon,
  ChevronRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface SubjectResult {
  subject_id: string;
  subject_name: string;
  theory_marks: number;
  practical_marks: number;
  obtained_marks: number;
  full_marks: number;
  pass_marks: number;
  grade: string;
  gpa: number;
  pass: boolean;
}

interface StudentResult {
  student_id: string;
  student_name: string;
  roll_number: number;
  class_name: string;
  total_marks: number;
  total_obtained: number;
  percentage: number;
  grade: string;
  gpa: number;
  rank: number;
  status: string;
  subject_results?: SubjectResult[];
}

interface GradeSheetSubject {
  id: string;
  name: string;
  full_marks: number;
}

interface GradeSheetRow {
  student_id: string;
  student_name: string;
  roll_number: number;
  subject_marks: Array<{
    subject_id: string;
    obtained: number;
    full_marks: number;
    grade: string;
    pass: boolean;
    absent: boolean;
  }>;
  total_obtained: number;
  percentage: number;
  status: string;
  rank: number;
}

interface GradeSheet {
  exam_name: string;
  class_name: string;
  subjects: GradeSheetSubject[];
  rows: GradeSheetRow[];
  total_full_marks: number;
}

interface StudentMarksheet {
  exam_name: string;
  student_name: string;
  roll_number: number;
  class_name: string;
  section_name: string;
  school_name: string;
  subjects: SubjectResult[];
  total_obtained: number;
  total_full: number;
  percentage: number;
  failed_subjects: number;
  status: string;
  ai_remarks?: string;
  rank_in_class?: number;
  overall_grade?: string;
  overall_gpa?: number;
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  return (
    <PluginGate slug="exams">
      <ResultsContent />
    </PluginGate>
  );
}

type ActiveTab = "results" | "gradesheet";

function ResultsContent() {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("results");
  const [selectedStudent, setSelectedStudent] =
    useState<StudentMarksheet | null>(null);
  const [loadingMarksheet, setLoadingMarksheet] = useState<string | null>(null);

  const hasDesigner = usePluginEnabled("design_studio");

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const res = await api.get("/exams");
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

  const { data: results, isLoading: loadingResults } = useQuery({
    queryKey: ["results", examId, classId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}/results?class_id=${classId}`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!examId && !!classId,
  });

  const { data: gradeSheet, isLoading: loadingGradeSheet } = useQuery({
    queryKey: ["grade-sheet", examId, classId],
    queryFn: async () => {
      const res = await api.get(
        `/exams/${examId}/grade-sheet?class_id=${classId}`,
      );
      return res.data?.data as GradeSheet | null;
    },
    enabled: !!examId && !!classId && activeTab === "gradesheet",
  });

  const designerMarksheetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/exams/${examId}/designer-marksheet`, {
        class_id: classId,
      });
      return res.data?.data;
    },
    onSuccess: () => {
      // Redirect to designer with the generated marksheets
      window.location.href = `/dashboard/designer?source=exam&exam_id=${examId}&class_id=${classId}`;
    },
  });

  const openMarksheet = async (studentId: string) => {
    setLoadingMarksheet(studentId);
    try {
      const res = await api.get(`/exams/${examId}/marksheet/${studentId}`);
      if (res.data?.data) {
        setSelectedStudent(res.data.data as StudentMarksheet);
      }
    } finally {
      setLoadingMarksheet(null);
    }
  };

  const stats =
    results && results.length > 0
      ? {
          total: results.length,
          passed: results.filter((r: StudentResult) => r.status === "pass")
            .length,
          failed: results.filter((r: StudentResult) => r.status === "fail")
            .length,
          avgPercentage: (
            results.reduce(
              (sum: number, r: StudentResult) => sum + (r.percentage || 0),
              0,
            ) / results.length
          ).toFixed(1),
        }
      : null;

  const isReady = !!examId && !!classId;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Exam Results</h1>
          <p className="text-muted-foreground">
            Class-wise results, grade sheets and individual marksheets
          </p>
        </div>
        {isReady && hasDesigner && (
          <Button
            variant="outline"
            onClick={() => designerMarksheetMutation.mutate()}
            disabled={designerMarksheetMutation.isPending}
            className="gap-2"
          >
            <Palette className="h-4 w-4" />
            {designerMarksheetMutation.isPending
              ? "Preparing..."
              : "Generate Marksheets via Designer"}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Select Exam</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose exam" />
              </SelectTrigger>
              <SelectContent>
                {(exams || []).map((e: { id: string; name: string }) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Select Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose class" />
              </SelectTrigger>
              <SelectContent>
                {(classes || []).map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Students",
              value: stats.total,
              icon: BarChart3,
              color: "text-blue-500",
            },
            {
              label: "Passed",
              value: stats.passed,
              icon: Trophy,
              color: "text-green-500",
            },
            {
              label: "Failed",
              value: stats.failed,
              icon: AlertTriangle,
              color: "text-red-500",
            },
            {
              label: "Class Average",
              value: `${stats.avgPercentage}%`,
              icon: TrendingUp,
              color: "text-purple-500",
            },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5 flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      {isReady && (
        <>
          <div className="border-b">
            <nav className="-mb-px flex gap-0">
              {(
                [
                  { id: "results", label: "Student Results", icon: FileText },
                  { id: "gradesheet", label: "Grade Sheet", icon: TableIcon },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Results Table */}
          {activeTab === "results" && (
            <Card>
              <CardContent className="p-0">
                {loadingResults ? (
                  <div className="flex justify-center py-16">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (results || []).length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground">
                    No results found. Enter marks first.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead className="w-16">Roll</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Obtained / Total</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>GPA</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r: StudentResult) => (
                        <TableRow
                          key={r.student_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openMarksheet(r.student_id)}
                        >
                          <TableCell>
                            {r.rank <= 3 ? (
                              <Badge
                                variant={r.rank === 1 ? "default" : "secondary"}
                              >
                                #{r.rank}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                #{r.rank}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{r.roll_number}</TableCell>
                          <TableCell className="font-medium">
                            {r.student_name}
                          </TableCell>
                          <TableCell>
                            {r.total_obtained} / {r.total_marks}
                          </TableCell>
                          <TableCell>{r.percentage?.toFixed(1)}%</TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.grade}</Badge>
                          </TableCell>
                          <TableCell>{r.gpa?.toFixed(1)}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                r.status === "pass"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }
                            >
                              {r.status?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {loadingMarksheet === r.student_id ? (
                              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Grade Sheet */}
          {activeTab === "gradesheet" && (
            <div className="space-y-3">
              {hasDesigner && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => designerMarksheetMutation.mutate()}
                    disabled={designerMarksheetMutation.isPending}
                    className="gap-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export via Designer
                  </Button>
                </div>
              )}
              <Card>
                <CardContent className="p-0 overflow-auto">
                  {loadingGradeSheet ? (
                    <div className="flex justify-center py-16">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : !gradeSheet ? (
                    <p className="text-center py-12 text-muted-foreground">
                      No grade sheet data available.
                    </p>
                  ) : (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/60">
                          <th className="text-left px-3 py-2.5 font-medium border-b border-r sticky left-0 bg-muted/60 min-w-[50px]">
                            Rank
                          </th>
                          <th className="text-left px-3 py-2.5 font-medium border-b border-r sticky left-12 bg-muted/60 min-w-[50px]">
                            Roll
                          </th>
                          <th className="text-left px-3 py-2.5 font-medium border-b border-r sticky left-24 bg-muted/60 min-w-[160px]">
                            Student
                          </th>
                          {gradeSheet.subjects.map((s) => (
                            <th
                              key={s.id}
                              className="text-center px-2 py-2.5 font-medium border-b border-r min-w-[80px]"
                              title={s.name}
                            >
                              <div className="truncate max-w-[80px]">
                                {s.name.length > 6
                                  ? s.name.slice(0, 6) + "…"
                                  : s.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-normal">
                                /{s.full_marks}
                              </div>
                            </th>
                          ))}
                          <th className="text-center px-3 py-2.5 font-medium border-b border-r min-w-[80px]">
                            Total
                          </th>
                          <th className="text-center px-3 py-2.5 font-medium border-b min-w-[70px]">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {gradeSheet.rows.map((row) => (
                          <tr
                            key={row.student_id}
                            className={`hover:bg-muted/30 transition-colors ${
                              row.status === "fail" ? "bg-red-50" : ""
                            }`}
                          >
                            <td className="px-3 py-2 border-r sticky left-0 bg-inherit font-medium text-center">
                              #{row.rank}
                            </td>
                            <td className="px-3 py-2 border-r sticky left-12 bg-inherit text-center">
                              {row.roll_number}
                            </td>
                            <td className="px-3 py-2 border-r sticky left-24 bg-inherit font-medium">
                              {row.student_name}
                            </td>
                            {row.subject_marks.map((sm, idx) => (
                              <td
                                key={idx}
                                className={`px-2 py-2 border-r text-center ${
                                  sm.absent
                                    ? "text-muted-foreground"
                                    : !sm.pass
                                      ? "text-red-600 font-medium"
                                      : ""
                                }`}
                              >
                                {sm.absent ? (
                                  "—"
                                ) : (
                                  <div>
                                    <div>{sm.obtained}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {sm.grade}
                                    </div>
                                  </div>
                                )}
                              </td>
                            ))}
                            <td className="px-3 py-2 border-r text-center font-medium">
                              {row.total_obtained}/{gradeSheet.total_full_marks}
                            </td>
                            <td
                              className={`px-3 py-2 text-center font-medium ${
                                row.status === "fail"
                                  ? "text-red-600"
                                  : "text-green-700"
                              }`}
                            >
                              {row.percentage}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Student Marksheet Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold">
                  {selectedStudent.student_name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Roll #{selectedStudent.roll_number} •{" "}
                  {selectedStudent.class_name} {selectedStudent.section_name} •{" "}
                  {selectedStudent.exam_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-primary">
                    {selectedStudent.percentage}%
                  </p>
                  <p className="text-xs text-muted-foreground">Percentage</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">
                    {selectedStudent.overall_grade || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Grade</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">
                    #{selectedStudent.rank_in_class || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Rank</p>
                </div>
              </div>

              {/* Subject marks table */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-medium">
                        Subject
                      </th>
                      <th className="text-center px-3 py-2.5 font-medium">
                        Theory
                      </th>
                      <th className="text-center px-3 py-2.5 font-medium">
                        Practical
                      </th>
                      <th className="text-center px-3 py-2.5 font-medium">
                        Obtained
                      </th>
                      <th className="text-center px-3 py-2.5 font-medium">
                        Full
                      </th>
                      <th className="text-center px-3 py-2.5 font-medium">
                        Grade
                      </th>
                      <th className="text-center px-3 py-2.5 font-medium">
                        GPA
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedStudent.subjects.map((s) => (
                      <tr
                        key={s.subject_id}
                        className={`${!s.pass ? "bg-red-50" : ""}`}
                      >
                        <td className="px-3 py-2 font-medium">
                          {s.subject_name}
                          {!s.pass && (
                            <span className="ml-1 text-red-500 text-xs">
                              FAIL
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {s.theory_marks || "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {s.practical_marks || "—"}
                        </td>
                        <td className="px-3 py-2 text-center font-medium">
                          {s.obtained_marks}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {s.full_marks}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="outline" className="text-xs">
                            {s.grade}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {s.gpa?.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t font-medium">
                    <tr>
                      <td className="px-3 py-2" colSpan={3}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-center">
                        {selectedStudent.total_obtained}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {selectedStudent.total_full}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {selectedStudent.overall_grade}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {selectedStudent.overall_gpa?.toFixed(1)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* AI Remarks */}
              {selectedStudent.ai_remarks && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-primary mb-1">
                    AI Remarks
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedStudent.ai_remarks}
                  </p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="border-t px-6 py-3 flex justify-between items-center">
              <span
                className={`text-sm font-semibold ${
                  selectedStudent.status === "pass"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {selectedStudent.status === "pass" ? "✓ PASSED" : "✗ FAILED"}
                {selectedStudent.failed_subjects > 0 &&
                  ` (${selectedStudent.failed_subjects} subject${selectedStudent.failed_subjects > 1 ? "s" : ""} failed)`}
              </span>
              <div className="flex gap-2">
                {hasDesigner && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.open(
                        `/dashboard/designer?source=exam_result&exam_id=${examId}&student_id=${selectedStudent?.student_name}`,
                        "_blank",
                      );
                    }}
                    className="gap-1.5"
                  >
                    <Palette className="h-3.5 w-3.5" />
                    Open in Designer
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedStudent(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
