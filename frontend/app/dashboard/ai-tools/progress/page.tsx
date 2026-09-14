"use client";

/**
 * Student Progress — GET /lms/adaptive-progress (A1 list + AI recommendations).
 * Research: at-a-glance mastery + next-action columns beat dense numbers; the
 * AI recommendation is surfaced per student because the admin's real task is
 * "who needs help" (MagicSchool/Diffit insight-list pattern).
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { useDebounced, useUrlFilters } from "@/components/ui/filter-bar";
import { ArrowLeft, TrendingUp, Brain, Search } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

interface ProgressRow {
  id: string;
  student_name?: string;
  name?: string;
  class_name?: string | null;
  level?: string | null;
  paths_assigned?: number;
  paths_completed?: number;
  avg_score?: number | null;
  ai_recommendation?: string | null;
}

export default function StudentProgressPage() {
  return <PluginGate slug="ai_suite"><ProgressContent /></PluginGate>;
}

function Header() {
  return (
    <AOSPageHeader
      icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
      title="Student Progress"
      subtitle="AI-tracked adaptive learning progress per student · विद्यार्थी प्रति प्रगति"
      actions={
        <Link href="/dashboard/ai?tab=tools">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />AI Hub · Tools</Button>
        </Link>
      }
    />
  );
}

function ProgressContent() {
  const { values, setValues, clear, activeCount } = useUrlFilters(["search", "class"]);
  const search = useDebounced(values.search);
  const classFilter = values.class;

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["adaptive-progress", classFilter, search],
    queryFn: async () => { const r = await api.get("/lms/adaptive-progress", { params: { class_name: classFilter || undefined, search: search || undefined } }); return r.data?.data ?? r.data; },
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => { const r = await api.get("/academics/classes"); return r.data?.data ?? r.data; },
  });

  const students: ProgressRow[] = Array.isArray(data) ? data : data?.students ?? [];
  const classes: any[] = Array.isArray(classesData) ? classesData : classesData?.items ?? [];

  const levelTone = (level: string | null) =>
    level === "advanced" ? "success" : level === "intermediate" ? "subtle" : level === "beginner" ? "warning" : "subtle";

  const columns: Column<ProgressRow>[] = [
    { key: "student", label: "Student", sortable: true, value: (s) => s.student_name ?? s.name ?? "", render: (s) => <span className="font-medium">{s.student_name ?? s.name ?? "—"}</span> },
    { key: "class", label: "Class", value: (s) => s.class_name ?? "" },
    {
      key: "level",
      label: "Mastery Level",
      value: (s) => s.level ?? "",
      render: (s) => <StatusChip status={levelTone(s.level ?? null) === "subtle" ? "pending" : (s.level || "pending")} label={s.level ? s.level.replace("_", " ") : "no data"} />,
    },
    { key: "paths_assigned", label: "Paths Assigned", align: "right", value: (s) => s.paths_assigned ?? 0 },
    {
      key: "paths_completed",
      label: "Paths Completed",
      align: "right",
      value: (s) => s.paths_completed ?? 0,
      render: (s) => (
        <div className="flex items-center justify-end gap-2">
          {s.paths_assigned ? s.paths_assigned > 0 && (
            <div className="h-2 w-12 rounded-full overflow-hidden" style={{ background: "var(--w11-control-hover)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.round(((s.paths_completed ?? 0) / s.paths_assigned) * 100)}%`, background: "var(--w11-accent)" }} />
            </div>
          ) : null}
          {s.paths_completed ?? 0}
        </div>
      ),
    },
    { key: "avg_score", label: "Avg Score", align: "right", sortable: true, value: (s) => s.avg_score ?? 0, render: (s) => (s.avg_score != null ? `${s.avg_score}%` : "—") },
    {
      key: "ai_recommendation",
      label: "AI Recommendation",
      value: (s) => s.ai_recommendation ?? "",
      render: (s) => (
        <span className="flex items-center gap-1 text-sm text-[color:var(--w11-text-secondary)]">
          <Brain className="h-3 w-3 shrink-0" style={{ color: "var(--w11-accent)" }} />
          <span className="max-w-[200px] truncate">{s.ai_recommendation ?? "No recommendation yet"}</span>
        </span>
      ),
    },
  ];

  if (isError) {
    return (
      <AOSPage>
        <Header />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <ErrorState title="Couldn't load student progress" onRetry={() => refetch()} />
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <Header />
      <AOSPageBody>
        <FilterCommandBar>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--w11-text-secondary)]" />
            <Input className="pl-9" placeholder="Search students…" value={values.search} onChange={(e) => setValues({ search: e.target.value })} />
          </div>
          <Select value={classFilter || "all"} onValueChange={(v) => setValues({ class: v === "all" ? "" : v })}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterCommandBar>

        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={columns}
            rows={students}
            rowKey={(s) => s.id}
            loading={isLoading}
            empty={
              activeCount
                ? {
                    icon: TrendingUp,
                    title: "No students match these filters",
                    body: "Widen the class filter or clear the search.",
                    action: { label: "Clear filters", onClick: clear },
                  }
                : {
                    icon: TrendingUp,
                    title: "No student progress data yet",
                    body: "Progress appears once adaptive paths and assessments exist.",
                  }
            }
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
