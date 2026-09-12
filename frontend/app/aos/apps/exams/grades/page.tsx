"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoader } from "@/components/ui/spinner";
import { Star } from "lucide-react";

/** Shape returned by GET /exams/grade-table (static NEB reference). */
interface Grade {
  grade: string;
  gpa: number;
  min_pct: number;
  description?: string;
}

const GRADE_COLUMNS: Column<Grade>[] = [
  { key: "grade", label: "Grade", sortable: true, value: (g) => g.grade, render: (g) => <span className="font-bold text-lg">{g.grade}</span> },
  { key: "min_pct", label: "Min %", align: "right", sortable: true, value: (g) => g.min_pct, render: (g) => <>{g.min_pct}%</> },
  { key: "gpa", label: "Grade Point (GPA)", align: "right", sortable: true, value: (g) => g.gpa, render: (g) => <Badge>{g.gpa}</Badge> },
  { key: "description", label: "Description", value: (g) => g.description ?? "", render: (g) => g.description || "—" },
];

export default function ExamGradesPage() {
  return (
    <PluginGate slug="exams">
      <ExamGradesContent />
    </PluginGate>
  );
}

function ExamGradesContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["exam-grades"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Grade[]>>("/exams/grade-table");
      return res.data.data ?? [];
    },
    retry: 1,
  });

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <div className="space-y-6">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load the grade table. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="h-6 w-6" /> Exam Grades</h1>
        <p className="text-muted-foreground">
          Nepal NEB grading scale — used automatically for marks entry, results and report cards
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            NEB Grading Scale (Letter Grade Directive 2078)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable<Grade>
            columns={GRADE_COLUMNS}
            rows={data || []}
            rowKey={(g) => g.grade}
            searchable
            searchPlaceholder="Search grades…"
            exportFileName="neb-grade-scale"
            empty={{ icon: Star, title: "Grade table unavailable", body: "The backend grade reference returned nothing." }}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Grades and GPA are computed with this scale automatically — theory marks must be ≥ the
        pass threshold and practical marks ≥ 40% where a practical component exists.
      </p>
    </div>
  );
}
