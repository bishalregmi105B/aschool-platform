"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
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

  if (isLoading) return <AOSPage><AOSModuleLoadingState label="Loading grade table…" /></AOSPage>;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          title="Exam Grades"
          subtitle="Nepal NEB grading scale — used automatically for marks entry, results and report cards"
        />
        <AOSPageBody>
          <div className="win11-card flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-[#c42b1c]">Failed to load the grade table. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Star className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Exam Grades"
        subtitle={`${(data || []).length} grades · Nepal NEB grading scale — used automatically for marks entry, results and report cards`}
      />
      <AOSPageBody className="space-y-4">
        <DataPanel title="NEB Grading Scale (Letter Grade Directive 2078)">
          <DataTable<Grade>
            columns={GRADE_COLUMNS}
            rows={data || []}
            rowKey={(g) => g.grade}
            searchable
            searchPlaceholder="Search grades…"
            exportFileName="neb-grade-scale"
            empty={{ icon: Star, title: "Grade table unavailable", body: "The backend grade reference returned nothing." }}
          />
        </DataPanel>

        <p className="text-xs text-[color:var(--w11-text-secondary)]">
          Grades and GPA are computed with this scale automatically — theory marks must be ≥ the
          pass threshold and practical marks ≥ 40% where a practical component exists.
        </p>
      </AOSPageBody>
    </AOSPage>
  );
}
