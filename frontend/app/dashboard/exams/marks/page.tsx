"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  isPassingResolvedMarksConfig,
  resolveExamMarkConfig,
  type MarksConfigExam,
  type MarksConfigSubject,
} from "@/lib/exam-mark-config";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PageLoader } from "@/components/ui/spinner";
import { Save, ClipboardList, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

/** NEB grading — client-side for instant feedback */
function nebGrade(pct: number): { grade: string; gpa: number; color: string } {
  if (pct >= 90) return { grade: "A+", gpa: 4.0, color: "text-emerald-700 bg-emerald-50" };
  if (pct >= 80) return { grade: "A",  gpa: 3.6, color: "text-green-700 bg-green-50" };
  if (pct >= 70) return { grade: "B+", gpa: 3.2, color: "text-blue-700 bg-blue-50" };
  if (pct >= 60) return { grade: "B",  gpa: 2.8, color: "text-sky-700 bg-sky-50" };
  if (pct >= 50) return { grade: "C+", gpa: 2.4, color: "text-yellow-700 bg-yellow-50" };
  if (pct >= 40) return { grade: "C",  gpa: 2.0, color: "text-orange-700 bg-orange-50" };
  if (pct >= 35) return { grade: "D",  gpa: 1.6, color: "text-amber-700 bg-amber-50" };
  return { grade: "NG", gpa: 0.0, color: "text-red-700 bg-red-50" };
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
  const searchParams = useSearchParams();
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

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students-class", classId],
    queryFn: async () => {
      const res = await api.get(`/students?class_id=${classId}&per_page=200`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!classId,
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

  // Populate marks from existing data
  useEffect(() => {
    if (existingMarks && existingMarks.length > 0) {
      const loaded: Record<string, MarkEntry> = {};
      for (const m of existingMarks) {
        loaded[m.student_id] = {
          student_id: m.student_id,
          theory_marks: String(m.theory_marks || ""),
          practical_marks: String(m.practical_marks || ""),
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
      const entries = Object.entries(marks)
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
    onError: () => toast.error("Failed to save marks"),
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

  // Stats
  const studentList: Student[] = students || [];
  const entered = Object.values(marks).filter((m: any) => m.theory_marks || m.practical_marks).length;
  const passCount = Object.values(marks).filter((m: any) => {
    const theory = parseFloat(m.theory_marks) || 0;
    const practical = parseFloat(m.practical_marks) || 0;
    return isPassingResolvedMarksConfig(marksConfig, theory, practical);
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/exams">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Marks Entry</h1>
            <p className="text-muted-foreground">Enter subject-wise marks • NEB auto-grading</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/exams">
            <Button variant="outline">Manage Exams</Button>
          </Link>
          {examId && classId && subjectId && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" /> {saveMutation.isPending ? "Saving..." : "Save All Marks"}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ClipboardList className="h-4 w-4" /> Select Exam, Class & Subject
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Exam</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
              <SelectContent>
                {(exams || []).map((e: { id: string; name: string; exam_type: string }) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {(classes || []).map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
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
        </CardContent>
      </Card>

      {examId && classId && subjectId && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-4 md:grid-cols-5">
            <div>
              <p className="text-xs text-muted-foreground">Config Source</p>
              <p className="text-sm font-medium">
                {usesSubjectPracticalConfig
                  ? "Subject theory + practical settings"
                  : selectedSubject
                    ? "Subject settings"
                    : "Exam defaults"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Full Marks</p>
              <p className="text-sm font-medium">{totalFullMarks}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pass Marks</p>
              <p className="text-sm font-medium">{totalPassMarks}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Practical</p>
              <p className="text-sm font-medium">
                {hasPractical ? `${theoryFullMarks} theory / ${practicalFullMarks} practical` : "No practical"}
              </p>
              {hasPractical && usesSubjectPracticalConfig && (
                <p className="text-[10px] text-muted-foreground">
                  Pass: {theoryPassMarks ?? 0} theory + {practicalPassMarks ?? 0} practical
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Selected Subject</p>
              <p className="text-sm font-medium">{selectedSubject?.name || "Using exam defaults"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Bar */}
      {examId && classId && subjectId && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 bg-blue-50 dark:bg-blue-950/30">
            <p className="text-[10px] text-blue-600">Total Students</p>
            <p className="text-lg font-bold text-blue-700">{studentList.length}</p>
          </div>
          <div className="rounded-lg border p-3 bg-amber-50 dark:bg-amber-950/30">
            <p className="text-[10px] text-amber-600">Marks Entered</p>
            <p className="text-lg font-bold text-amber-700">{entered} / {studentList.length}</p>
          </div>
          <div className="rounded-lg border p-3 bg-emerald-50 dark:bg-emerald-950/30">
            <p className="text-[10px] text-emerald-600">Pass</p>
            <p className="text-lg font-bold text-emerald-700">{passCount}</p>
          </div>
          <div className="rounded-lg border p-3 bg-red-50 dark:bg-red-950/30">
            <p className="text-[10px] text-red-600">Fail / NG</p>
            <p className="text-lg font-bold text-red-700">{entered - passCount}</p>
          </div>
        </div>
      )}

      {/* Marks Table */}
      {examId && classId && subjectId && (
        <Card>
          <CardContent className="p-0">
            {studentsLoading ? (
              <PageLoader />
            ) : studentList.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No students found in this class.</p>
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
                        : { grade: "NG", gpa: 0.0, color: "text-red-700 bg-red-50" }
                      : null;

                    return (
                      <TableRow key={s.id} className={!m.theory_marks && !m.practical_marks ? "opacity-60" : ""}>
                        <TableCell className="text-center font-mono text-xs">{s.roll_number}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{s.first_name} {s.last_name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.student_id}</p>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={theoryFullMarks}
                            value={m.theory_marks}
                            onChange={(e) => updateMark(s.id, "theory_marks", e.target.value)}
                            placeholder="0"
                            className={`w-24 h-8 text-sm ${total > 0 && !isPass ? "border-red-400" : ""}`}
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
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${g.color}`}>
                              {g.grade}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{g ? g.gpa.toFixed(1) : "—"}</TableCell>
                        <TableCell>
                          {total > 0 && (
                            isPass ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
