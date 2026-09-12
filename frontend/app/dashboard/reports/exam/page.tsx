"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { AlertTriangle, BarChart3, Download, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

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

  const { data: exams = [], isLoading: examsLoading, isError: examsError, refetch: refetchExams } = useQuery({
    queryKey: ["exam-report-exams"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ExamItem[]>>("/exams?per_page=200");
      return res.data.data ?? [];
    },
    retry: 1,
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

  if (examsError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Exam Analytics & Reports"
          subtitle="Comprehensive performance analysis across classes and subjects"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load the exam list. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetchExams()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }
  if (examsLoading) return <PageLoader />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Exam Analytics & Reports"
        subtitle="Comprehensive performance analysis across classes and subjects"
        actions={
          <Button variant="outline" onClick={exportReport} disabled={subjects.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export Report
          </Button>
        }
      />
      <AOSPageBody>
        <FilterCommandBar className="mb-0">
          <div className="space-y-2 flex-1 min-w-[220px]">
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
          <div className="space-y-2 w-64">
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
        </FilterCommandBar>

        {!examId ? (
          <DataPanel>
            <AOSEmptyState
              icon={<BarChart3 className="h-12 w-12" />}
              title="Select an exam"
              description="Select an exam to generate analytics from recorded marks."
            />
          </DataPanel>
        ) : isFetching ? (
          <PageLoader />
        ) : subjects.length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              icon={<BarChart3 className="h-12 w-12" />}
              title="No marks recorded"
              description="No marks are recorded for this exam and class filter."
            />
          </DataPanel>
        ) : (
          <>
            <StatGrid min={200} className="mb-0">
              <KpiCard
                label="Average Score"
                value={`${weightedAverage.toFixed(1)}%`}
                icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
                footnote="Weighted by subject entries"
              />
              <KpiCard label="Pass Rate" value={`${passRate.toFixed(1)}%`} footnote={`${totalStudents} subject mark entries`} />
              <KpiCard
                label="Highest Subject"
                value={highestSubject?.subject_name || "Subject"}
                footnote={`Average: ${highestSubject?.avg_marks ?? 0}/${highestSubject?.full_marks ?? 100}`}
              />
              <KpiCard
                label="Failed Entries"
                value={failedStudents}
                color="#c42b1c"
                icon={<AlertTriangle className="h-5 w-5" style={{ color: "#c42b1c" }} />}
                footnote={`Lowest pass rate: ${attentionSubject?.subject_name || "Subject"}`}
              />
            </StatGrid>

            <DataPanel title={<span className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Subject Performance Distribution</span>}>
              <div className="space-y-4">
                {subjects.map((subject) => {
                  const percentage = subject.full_marks > 0 ? (subject.avg_marks / subject.full_marks) * 100 : 0;
                  return (
                    <div key={subject.subject_id} className="space-y-2">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-medium">{subject.subject_name || subject.subject_id}</span>
                        <span className="text-[color:var(--w11-text-secondary)]">
                          Avg {subject.avg_marks}/{subject.full_marks} • Pass {subject.pass_rate}%
                        </span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--w11-control-hover)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(2, percentage))}%`,
                            background: percentage >= 60 ? "#0f7b0f" : percentage >= 40 ? "#9d5d00" : "#c42b1c",
                          }}
                        />
                      </div>
                      <div className="flex gap-4 text-xs text-[color:var(--w11-text-secondary)]">
                        <span>Students: {subject.student_count}</span>
                        <span>Highest: {subject.max_marks}</span>
                        <span>Lowest: {subject.min_marks}</span>
                        <span>Failed: {subject.failed_count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DataPanel>
          </>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
