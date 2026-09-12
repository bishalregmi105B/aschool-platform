"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, ClipboardList, FileBarChart, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  DataPanel, StatusChip, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
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

/** Exam status → StatusChip tone key. */
const STATUS_TONE: Record<string, string> = {
  scheduled: "scheduled",
  ongoing: "pending",
  completed: "completed",
  published: "published",
  cancelled: "cancelled",
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

  if (isLoading) return <AOSPage><AOSModuleLoadingState label="Loading exam…" /></AOSPage>;
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

  const windowLabel = `${displayBS(exam.start_date_bs || exam.start_date) || "—"} → ${displayBS(exam.end_date_bs || exam.end_date) || "—"}`;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={
          <Link href="/dashboard/exams">
            <Button variant="ghost" size="icon" aria-label="Back to exams">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        }
        title={exam.name}
        subtitle={
          [exam.exam_type, exam.class_name, windowLabel].filter(Boolean).join(" · ") || "Exam"
        }
        actions={
          <>
            {exam.status && (
              <StatusChip status={STATUS_TONE[exam.status] ?? exam.status} label={exam.status} />
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
          </>
        }
      />
      <AOSPageBody className="space-y-4">
        <StatGrid className="mb-0">
          <KpiCard
            label="Subjects"
            value={subjects?.length ?? 0}
            icon={<ClipboardList className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
            footnote="mapped to this exam"
          />
          <KpiCard
            label="Full Marks"
            value={exam.total_marks ?? totalFull ?? "—"}
            icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
            footnote={`Pass marks ${exam.pass_marks ?? "—"}`}
          />
          <KpiCard
            label="Appeared"
            value={summary?.appeared ?? "—"}
            icon={<Calendar className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
            footnote={summary ? `highest ${summary.highest}%` : "No marks entered yet"}
          />
          <KpiCard
            label="Passed"
            value={summary?.passed ?? "—"}
            color="#107c10"
            footnote={summary ? `${summary.appeared} students appeared` : "No marks entered yet"}
          />
          <KpiCard
            label="Average"
            value={summary ? `${summary.average}%` : "—"}
            color={summary && summary.average >= (exam.pass_marks ?? 0) ? "#107c10" : "#d83b01"}
            footnote={summary ? `across ${summary.appeared} students` : "No marks entered yet"}
          />
        </StatGrid>

        <DataPanel title="Exam subjects">
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
                    <TableCell className="text-[color:var(--w11-text-secondary)]">{s.code || "—"}</TableCell>
                    <TableCell className="text-right">{s.total_full_marks ?? s.full_marks}</TableCell>
                    <TableCell className="text-right">{s.total_pass_marks ?? s.pass_marks}</TableCell>
                    <TableCell>
                      {s.has_practical ? (
                        <Badge variant="outline" className="text-xs">
                          {s.practical_full_marks ? `${s.practical_full_marks} marks` : "Yes"}
                        </Badge>
                      ) : (
                        <span className="text-sm text-[color:var(--w11-text-secondary)]">—</span>
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
        </DataPanel>

        {results && results.length > 0 && (
          <DataPanel title="Top performers">
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
                      <StatusChip status={r.status || "—"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
