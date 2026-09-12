"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { ArrowLeft, BookOpen, Trophy, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

export default function AcademicAnalyticsPage() {
  const [examId, setExamId] = useState("");

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => { const r = await api.get("/exams"); return r.data?.data || []; },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["academic-analytics", examId],
    queryFn: async () => { const r = await api.get("/analytics/academic", { params: { exam_id: examId || undefined } }); return r.data?.data; },
  });

  const analytics = data || {};
  const classWise = analytics.class_wise || [];
  const subjectWise = analytics.subject_wise || [];
  const atRisk = analytics.at_risk_students || [];

  const AT_RISK_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (s) => s.student_name ?? "", render: (s) => <span className="font-medium">{s.student_name}</span> },
    { key: "class_name", label: "Class", sortable: true, value: (s) => s.class_name ?? "" },
    { key: "avg_percentage", label: "Average", align: "right", sortable: true, value: (s) => s.avg_percentage ?? 0, render: (s) => <>{s.avg_percentage}%</> },
    { key: "failed_subjects", label: "Failed Subjects", align: "right", sortable: true, value: (s) => s.failed_subjects ?? 0 },
    { key: "risk_level", label: "Risk Level", sortable: true, value: (s) => s.risk_level ?? "", render: (s) => <StatusChip status="failed" label={s.risk_level || "High"} /> },
  ];

  if (isLoading) return <PageLoader />;
    if (isError) {
  return (
        <AOSPage>
          <AOSPageHeader
            icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
            title="Academic Analytics"
            subtitle="Student performance analysis and trends"
          />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load academic analytics. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          </AOSPageBody>
        </AOSPage>
      );
    }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Academic Analytics"
        subtitle="Student performance analysis and trends"
        actions={
          <>
            <Link href="/dashboard/analytics">
              <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <AdvancedSelect
              value={examId}
              onChange={(v) => setExamId(v)}
              options={(exams || []).map((e: any) => ({ value: e.id, label: e.name }))}
            />
          </>
        }
      />
      <AOSPageBody>
        <StatGrid min={180}>
          <KpiCard label="Students" value={analytics.total_students || 0} icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Pass Rate" value={analytics.pass_rate ? `${analytics.pass_rate}%` : "—"} icon={<Trophy className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Average Score" value={analytics.avg_percentage ? `${analytics.avg_percentage}%` : "—"} icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="At-Risk Students" value={atRisk.length || analytics.at_risk_count || 0} color="#c42b1c" icon={<AlertTriangle className="h-5 w-5" style={{ color: "#c42b1c" }} />} />
        </StatGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DataPanel title="Class-wise Performance">
            {classWise.length > 0 ? (
              <div className="space-y-3">
                {classWise.map((c: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium">{c.class_name}</span><span>{c.pass_rate || c.avg_percentage}%</span></div>
                    <div className="w-full rounded-full h-3" style={{ background: "var(--w11-control-hover)" }}><div className="h-3 rounded-full transition-all" style={{ width: `${Math.min(100, c.pass_rate || c.avg_percentage || 0)}%`, background: "var(--w11-accent)" }} /></div>
                    <div className="flex gap-4 text-xs mt-1 text-[color:var(--w11-text-secondary)]"><span>Students: {c.total_students}</span><span>Passed: {c.passed}</span><span>Failed: {c.failed}</span></div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-8 text-[color:var(--w11-text-secondary)]">No class data available</p>}
          </DataPanel>

          <DataPanel title="Subject-wise Scores">
            {subjectWise.length > 0 ? (
              <div className="space-y-3">
                {subjectWise.map((s: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium">{s.subject_name}</span><span>Avg: {s.avg_score}%</span></div>
                    <div className="w-full rounded-full h-3" style={{ background: "var(--w11-control-hover)" }}><div className="h-3 rounded-full" style={{ width: `${Math.min(100, s.avg_score || 0)}%`, background: (s.avg_score || 0) >= 60 ? "#0f7b0f" : (s.avg_score || 0) >= 40 ? "#9d5d00" : "#c42b1c" }} /></div>
                    <div className="flex gap-4 text-xs mt-1 text-[color:var(--w11-text-secondary)]"><span>Highest: {s.highest}</span><span>Lowest: {s.lowest}</span></div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-8 text-[color:var(--w11-text-secondary)]">No subject data available</p>}
          </DataPanel>
        </div>

        {atRisk.length > 0 && (
          <DataPanel
            title={<span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" style={{ color: "#c42b1c" }} /> At-Risk Students</span>}
          >
            <DataTable
              columns={AT_RISK_COLUMNS}
              rows={atRisk}
              rowKey={(s: any) => `${s.student_name}-${s.class_name}`}
              searchable
              searchPlaceholder="Search students…"
              exportFileName="at-risk-students"
              dense
            />
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
