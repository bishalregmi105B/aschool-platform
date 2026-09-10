"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, ClipboardList, FileBarChart, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { displayBS } from "@/lib/nepali_date";

interface Exam {
  id: string;
  name: string;
  name_nepali?: string | null;
  exam_type?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_date_bs?: string | null;
  end_date_bs?: string | null;
  total_marks?: number | null;
  pass_marks?: number | null;
  is_practical?: boolean;
  status?: string;
  description?: string | null;
}

interface ExamSubject {
  id: string;
  name: string;
  code?: string;
  has_practical: boolean;
  full_marks: number;
  pass_marks: number;
  practical_full_marks?: number;
  total_full_marks?: number;
  total_pass_marks?: number;
}

interface StudentResult {
  student_id: string;
  student_name: string;
  percentage: number;
  grade?: string | null;
  gpa?: number | null;
  status?: string;
}

const STATUS_TONE: Record<string, string> = {
  scheduled: "secondary",
  ongoing: "default",
  completed: "outline",
  published: "default",
  cancelled: "destructive",
};

export default function ExamDetailPage() {
  const params = useParams();
  const examId = params.id as string;

  const { data: exam, isLoading, error } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const resp = await api.get(`/exams/${examId}`);
      return resp.data.data as Exam;
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["exam-subjects", examId],
    queryFn: async () => {
      const resp = await api.get(`/exams/${examId}/subjects`);
      return (resp.data.data ?? []) as ExamSubject[];
    },
  });

  const { data: results } = useQuery({
    queryKey: ["exam-results", examId, exam?.class_id],
    enabled: Boolean(exam?.class_id),
    queryFn: async () => {
      const resp = await api.get(`/exams/${examId}/results`, {
        params: { class_id: exam?.class_id },
      });
      return (resp.data.data ?? []) as StudentResult[];
    },
  });

  if (isLoading) return <PageLoader />;
  if (error || !exam) {
    return (
      <ErrorState
        title="Exam not found"
        body="This exam may have been deleted or belongs to another school."
        onRetry={() => window.location.reload()}
      />
    );
  }

  const totalFull = subjects?.reduce((sum, s) => sum + (s.total_full_marks ?? s.full_marks ?? 0), 0);
  const summary = results && results.length > 0
    ? {
        appeared: results.length,
        passed: results.filter((r) => r.status === "pass" || (r.percentage ?? 0) >= (exam.pass_marks ?? 0)).length,
        average: Math.round(
          results.reduce((sum, r) => sum + (r.percentage ?? 0), 0) / results.length
        ),
        highest: Math.max(...results.map((r) => r.percentage ?? 0)),
      }
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/exams">
            <Button variant="ghost" size="icon" aria-label="Back to exams">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{exam.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[exam.exam_type, exam.class_name].filter(Boolean).join(" · ") || "Exam"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {exam.status && (
            <Badge variant={(STATUS_TONE[exam.status] as "default") ?? "secondary"}>
              {exam.status}
            </Badge>
          )}
          <Link href={`/dashboard/exams/marks?exam_id=${examId}`}>
            <Button size="sm">
              <ClipboardList className="mr-1 h-4 w-4" /> Enter marks
            </Button>
          </Link>
          <Link href={`/dashboard/exams/results?exam_id=${examId}`}>
            <Button size="sm" variant="outline">
              <FileBarChart className="mr-1 h-4 w-4" /> Results
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Window</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {displayBS(exam.start_date_bs || exam.start_date) || "—"}
              {" → "}
              {displayBS(exam.end_date_bs || exam.end_date) || "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marks</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              Full {exam.total_marks ?? totalFull ?? "—"} · Pass {exam.pass_marks ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subjects</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{subjects?.length ?? 0} mapped</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Results</CardTitle>
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summary ? (
              <p className="text-sm font-medium">
                {summary.appeared} students · avg {summary.average}% · high {summary.highest}%
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No marks entered yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exam subjects</CardTitle>
        </CardHeader>
        <CardContent>
          {subjects && subjects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Full marks</TableHead>
                  <TableHead className="text-right">Pass marks</TableHead>
                  <TableHead>Practical</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.code || "—"}</TableCell>
                    <TableCell className="text-right">{s.total_full_marks ?? s.full_marks}</TableCell>
                    <TableCell className="text-right">{s.total_pass_marks ?? s.pass_marks}</TableCell>
                    <TableCell>
                      {s.has_practical ? (
                        <Badge variant="outline" className="text-xs">
                          {s.practical_full_marks ? `${s.practical_full_marks} marks` : "Yes"}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              size="sm"
              title="No subjects mapped"
              body="Map subjects to this exam from the exam editor."
            />
          )}
        </CardContent>
      </Card>

      {results && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top performers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.slice(0, 10).map((r, i) => (
                  <TableRow key={r.student_id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.student_name}</TableCell>
                    <TableCell className="text-right">{r.percentage}%</TableCell>
                    <TableCell>{r.grade || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "pass" ? "default" : "destructive"}>
                        {r.status || "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
