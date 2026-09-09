"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/ui/spinner";
import { Calendar } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  status: string;
  class_name?: string;
  start_date_bs?: string;
  end_date_bs?: string;
  start_date?: string;
  end_date?: string;
  total_marks?: number;
  pass_marks?: number;
  is_practical?: boolean;
}

interface ExamSubject {
  id: string;
  name: string;
  code?: string;
  has_practical: boolean;
  full_marks: number;
  pass_marks: number;
  practical_full_marks?: number;
  total_full_marks: number;
  total_pass_marks: number;
}

const SCHEDULE_COLUMNS: Column<ExamSubject>[] = [
  { key: "name", label: "Subject", sortable: true, value: (s) => s.name, render: (s) => <span className="font-medium">{s.name}</span> },
  { key: "code", label: "Code", sortable: true, value: (s) => s.code ?? "", render: (s) => <span className="text-muted-foreground">{s.code || "—"}</span> },
  { key: "full", label: "Full Marks", align: "right", sortable: true, value: (s) => s.total_full_marks ?? s.full_marks, render: (s) => <>{s.total_full_marks ?? s.full_marks}</> },
  { key: "pass", label: "Pass Marks", align: "right", sortable: true, value: (s) => s.total_pass_marks ?? s.pass_marks, render: (s) => <>{s.total_pass_marks ?? s.pass_marks}</> },
  {
    key: "practical",
    label: "Practical",
    value: (s) => (s.has_practical ? "yes" : "no"),
    render: (s) =>
      s.has_practical ? (
        <Badge variant="outline" className="text-xs">
          {s.practical_full_marks ? `${s.practical_full_marks} marks` : "Yes"}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
  },
];

export default function ExamSchedulePage() {
  return (
    <PluginGate slug="exams">
      <ExamScheduleContent />
    </PluginGate>
  );
}

function ExamScheduleContent() {
  const { data: exams, isLoading, isError } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const res = await api.get("/exams");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  if (isLoading) return <PageLoader />;

  if (isError)
    return (
      <div className="p-6 border border-destructive/30 bg-destructive/5 rounded-lg text-sm text-destructive text-center">
        Failed to load the exam schedule. Please refresh the page to try again.
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exam Schedule</h1>
          <p className="text-muted-foreground">View exam timetables and schedules</p>
        </div>
        <a href="/dashboard/exams" className="text-sm font-medium text-primary hover:underline">
          Create / manage exams →
        </a>
      </div>

      {(exams || []).length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground">No exams scheduled yet.</p>
          <a href="/dashboard/exams" className="text-sm font-medium text-primary hover:underline">
            Create your first exam on the Exams overview →
          </a>
        </div>
      ) : (
        (exams || []).map((exam: Exam) => (
          <ExamCard key={exam.id} exam={exam} />
        ))
      )}
    </div>
  );
}

function ExamCard({ exam }: { exam: Exam }) {
  const { data: subjects, isLoading } = useQuery({
    queryKey: ["exam-subjects-schedule", exam.id],
    queryFn: async () => {
      const res = await api.get(`/exams/${exam.id}/subjects`);
      return Array.isArray(res.data?.data) ? (res.data.data as ExamSubject[]) : [];
    },
  });

  const startBs = exam.start_date_bs;
  const endBs = exam.end_date_bs;
  const dateLabel = startBs
    ? endBs && endBs !== startBs
      ? `${displayBS(startBs)} – ${displayBS(endBs)}`
      : displayBS(startBs)
    : exam.start_date
    ? displayBS(exam.start_date)
    : "—";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {exam.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {exam.class_name && (
              <Badge variant="outline" className="capitalize">
                {exam.class_name}
              </Badge>
            )}
            <Badge
              variant={
                exam.status === "ongoing"
                  ? "warning"
                  : exam.status === "completed" || exam.status === "result_published"
                  ? "success"
                  : "secondary"
              }
              className="capitalize"
            >
              {exam.status?.replace("_", " ")}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{dateLabel}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading subjects…</p>
        ) : !subjects || subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects assigned for this exam.</p>
        ) : (
          <DataTable<ExamSubject>
            columns={SCHEDULE_COLUMNS}
            rows={subjects}
            rowKey={(s) => s.id}
            searchable
            searchPlaceholder="Search subjects…"
            exportFileName={`exam-schedule-${exam.name}`}
            empty={{ icon: Calendar, title: "No subjects assigned", body: "Add subjects to this exam to build the schedule." }}
          />
        )}
      </CardContent>
    </Card>
  );
}
