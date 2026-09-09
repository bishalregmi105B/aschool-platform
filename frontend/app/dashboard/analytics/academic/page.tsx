"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { ArrowLeft, BookOpen, Trophy, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";

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
    { key: "risk_level", label: "Risk Level", sortable: true, value: (s) => s.risk_level ?? "", render: (s) => <Badge variant="destructive">{s.risk_level || "High"}</Badge> },
  ];

  if (isLoading) return <PageLoader />;
    if (isError) {
  return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load academic analytics. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/analytics"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1"><h1 className="text-2xl font-bold">Academic Analytics</h1><p className="text-muted-foreground">Student performance analysis and trends</p></div>
        <AdvancedSelect
          value={examId}
          onChange={(v) => setExamId(v)}
          options={(exams || []).map((e: any) => ({ value: e.id, label: e.name }))}
        />
        
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><BookOpen className="h-5 w-5 text-blue-600 mb-2" /><p className="text-2xl font-bold">{analytics.total_students || 0}</p><p className="text-sm text-muted-foreground">Students</p></CardContent></Card>
        <Card><CardContent className="pt-6"><Trophy className="h-5 w-5 text-green-600 mb-2" /><p className="text-2xl font-bold text-green-600">{analytics.pass_rate ? `${analytics.pass_rate}%` : "—"}</p><p className="text-sm text-muted-foreground">Pass Rate</p></CardContent></Card>
        <Card><CardContent className="pt-6"><TrendingUp className="h-5 w-5 text-purple-600 mb-2" /><p className="text-2xl font-bold">{analytics.avg_percentage ? `${analytics.avg_percentage}%` : "—"}</p><p className="text-sm text-muted-foreground">Average Score</p></CardContent></Card>
        <Card><CardContent className="pt-6"><AlertTriangle className="h-5 w-5 text-red-600 mb-2" /><p className="text-2xl font-bold text-red-600">{atRisk.length || analytics.at_risk_count || 0}</p><p className="text-sm text-muted-foreground">At-Risk Students</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Class-wise Performance</CardTitle></CardHeader>
          <CardContent>
            {classWise.length > 0 ? (
              <div className="space-y-3">
                {classWise.map((c: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium">{c.class_name}</span><span>{c.pass_rate || c.avg_percentage}%</span></div>
                    <div className="w-full bg-gray-200 rounded-full h-3"><div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${Math.min(100, c.pass_rate || c.avg_percentage || 0)}%` }} /></div>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1"><span>Students: {c.total_students}</span><span>Passed: {c.passed}</span><span>Failed: {c.failed}</span></div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">No class data available</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Subject-wise Scores</CardTitle></CardHeader>
          <CardContent>
            {subjectWise.length > 0 ? (
              <div className="space-y-3">
                {subjectWise.map((s: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium">{s.subject_name}</span><span>Avg: {s.avg_score}%</span></div>
                    <div className="w-full bg-gray-200 rounded-full h-3"><div className={`h-3 rounded-full ${(s.avg_score || 0) >= 60 ? "bg-green-600" : (s.avg_score || 0) >= 40 ? "bg-yellow-600" : "bg-red-600"}`} style={{ width: `${Math.min(100, s.avg_score || 0)}%` }} /></div>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1"><span>Highest: {s.highest}</span><span>Lowest: {s.lowest}</span></div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">No subject data available</p>}
          </CardContent>
        </Card>
      </div>

      {atRisk.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" /> At-Risk Students</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              columns={AT_RISK_COLUMNS}
              rows={atRisk}
              rowKey={(s: any) => `${s.student_name}-${s.class_name}`}
              searchable
              searchPlaceholder="Search students…"
              exportFileName="at-risk-students"
              dense
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
