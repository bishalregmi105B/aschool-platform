"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, BarChart3, Download, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";

interface ExamItem {
  id: string;
  name: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface SubjectReport {
  subject_id: string;
  subject_name?: string;
  avg_marks: number;
  max_marks: number;
  min_marks: number;
  full_marks: number;
  pass_marks: number;
  student_count: number;
  passed_count: number;
  failed_count: number;
  pass_rate: number;
}

interface ExamReport {
  exam_id: string;
  class_id?: string;
  subjects: SubjectReport[];
  total_records: number;
}

export default function ExamReportsPage() {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("all");

  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["exam-report-exams"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ExamItem[]>>("/exams?per_page=200");
      return res.data.data ?? [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["exam-report-classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ClassItem[]>>("/academics/classes?per_page=200");
      return res.data.data ?? [];
    },
  });

  const { data: report, isFetching } = useQuery({
    queryKey: ["exam-report", examId, classId],
    queryFn: async () => {
      const params: Record<string, string> = { exam_id: examId };
      if (classId !== "all") params.class_id = classId;
      const res = await api.get<ApiResponse<ExamReport>>("/reports/exams/results", { params });
      return res.data.data;
    },
    enabled: Boolean(examId),
  });

  const subjects = report?.subjects ?? [];
  const totalStudents = subjects.reduce((sum, subject) => sum + subject.student_count, 0);
  const failedStudents = subjects.reduce((sum, subject) => sum + subject.failed_count, 0);
  const weightedAverage =
    subjects.length > 0
      ? subjects.reduce((sum, subject) => {
          const percentage = subject.full_marks > 0 ? (subject.avg_marks / subject.full_marks) * 100 : 0;
          return sum + percentage * subject.student_count;
        }, 0) / Math.max(totalStudents, 1)
      : 0;
  const passRate =
    subjects.length > 0
      ? subjects.reduce((sum, subject) => sum + subject.pass_rate * subject.student_count, 0) /
        Math.max(totalStudents, 1)
      : 0;
  const highestSubject = subjects.reduce<SubjectReport | null>((best, subject) => {
    if (!best) return subject;
    return subject.avg_marks > best.avg_marks ? subject : best;
  }, null);
  const attentionSubject = subjects.reduce<SubjectReport | null>((lowest, subject) => {
    if (!lowest) return subject;
    return subject.pass_rate < lowest.pass_rate ? subject : lowest;
  }, null);
  const selectedExam = exams.find((exam) => exam.id === examId);

  const exportReport = () => {
    if (!report || subjects.length === 0) return;
    const rows = [
      ["Exam", selectedExam?.name ?? examId],
      ["Subject", "Average", "Highest", "Lowest", "Full Marks", "Pass Marks", "Students", "Passed", "Failed", "Pass Rate"],
      ...subjects.map((subject) => [
        subject.subject_name || subject.subject_id,
        subject.avg_marks.toString(),
        subject.max_marks.toString(),
        subject.min_marks.toString(),
        subject.full_marks.toString(),
        subject.pass_marks.toString(),
        subject.student_count.toString(),
        subject.passed_count.toString(),
        subject.failed_count.toString(),
        `${subject.pass_rate}%`,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `exam-report-${examId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (examsLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Exam Analytics & Reports
          </h1>
          <p className="text-muted-foreground">Comprehensive performance analysis across classes and subjects</p>
        </div>
        <Button variant="outline" onClick={exportReport} disabled={subjects.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export Report
        </Button>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 grid gap-4 md:grid-cols-2 items-end">
          <div className="space-y-2">
            <Label>Term / Exam</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
              <SelectContent>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Class Filter</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((klass) => (
                  <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!examId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select an exam to generate analytics from recorded marks.
          </CardContent>
        </Card>
      ) : isFetching ? (
        <PageLoader />
      ) : subjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No marks are recorded for this exam and class filter.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Average Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{weightedAverage.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" /> Weighted by subject entries
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Pass Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{passRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">{totalStudents} subject mark entries</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Highest Subject</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate">{highestSubject?.subject_name || "Subject"}</div>
                <p className="text-xs text-muted-foreground mt-1">Average: {highestSubject?.avg_marks ?? 0}/{highestSubject?.full_marks ?? 100}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Failed Entries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{failedStudents}</div>
                <p className="text-xs text-red-600 flex items-center mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Lowest pass rate: {attentionSubject?.subject_name || "Subject"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Subject Performance Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subjects.map((subject) => {
                const percentage = subject.full_marks > 0 ? (subject.avg_marks / subject.full_marks) * 100 : 0;
                return (
                  <div key={subject.subject_id} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium">{subject.subject_name || subject.subject_id}</span>
                      <span className="text-muted-foreground">
                        Avg {subject.avg_marks}/{subject.full_marks} • Pass {subject.pass_rate}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={percentage >= 60 ? "h-full rounded-full bg-green-600" : percentage >= 40 ? "h-full rounded-full bg-yellow-600" : "h-full rounded-full bg-red-600"}
                        style={{ width: `${Math.min(100, Math.max(2, percentage))}%` }}
                      />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Students: {subject.student_count}</span>
                      <span>Highest: {subject.max_marks}</span>
                      <span>Lowest: {subject.min_marks}</span>
                      <span>Failed: {subject.failed_count}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
