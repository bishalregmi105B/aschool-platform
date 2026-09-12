"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Download, Users, Calendar, TrendingUp } from "lucide-react";

export default function AttendanceReportsPage() {
  return <PluginGate slug="attendance"><ReportsContent /></PluginGate>;
}

function ReportsContent() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const [classId, setClassId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Last 24 months as "YYYY-MM" — replaces the native <input type="month">
  // (English-only chrome, inconsistent across browsers).
  const MONTH_OPTIONS = Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en", { month: "long", year: "numeric" });
    return { value: key, label };
  });

  const { data: classes } = useQuery({
    queryKey: ["classes", isTeacher ? "class_teacher" : "all"],
    queryFn: async () => {
      const url = isTeacher
        ? "/teacher/my-classes?scope=class_teacher"
        : "/academics/classes";
      const r = await api.get(url);
      return r.data?.data || [];
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["attendance-reports", classId, month],
    queryFn: async () => {
      // Backend expects start_date/end_date (ISO dates), not a month string.
      const [year, mon] = month.split("-");
      const lastDay = new Date(Number(year), Number(mon), 0).getDate();
      const params: any = {
        start_date: `${month}-01`,
        end_date: `${month}-${String(lastDay).padStart(2, "0")}`,
      };
      if (classId) params.class_id = classId;
      const r = await api.get("/reports/attendance/summary", { params });
      return r.data?.data;
    },
  });

  const report = data || {};
  const students = report.students || [];
  const summary = report.summary || {};

  if (isLoading) return <PageLoader />;

  if (isError)
    return (
      <div className="p-6 border border-destructive/30 bg-destructive/5 rounded-lg text-center space-y-2">
        <p className="text-sm text-destructive">Failed to load attendance report. Please try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );

  function exportCSV() {
    const rows: (string | number)[][] = [
      ["Student", "Present", "Absent", "Late", "Leave", "Attendance %"],
      ...students.map((s: any) => [
        s.student_name || s.student_id,
        s.present || 0,
        s.absent || 0,
        s.late || 0,
        s.leave || 0,
        `${(s.percentage ?? 0).toFixed ? s.percentage.toFixed(1) : s.percentage || 0}%`,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-report-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const REPORT_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (s) => s.student_name || "", render: (s) => <span className="font-medium">{s.student_name}</span> },
    { key: "present", label: "Present", align: "right", sortable: true, value: (s) => s.present || 0, render: (s) => <span className="text-green-600">{s.present || 0}</span> },
    { key: "absent", label: "Absent", align: "right", sortable: true, value: (s) => s.absent || 0, render: (s) => <span className="text-red-600">{s.absent || 0}</span> },
    { key: "late", label: "Late", align: "right", sortable: true, value: (s) => s.late || 0, render: (s) => <span className="text-yellow-600">{s.late || 0}</span> },
    { key: "leave", label: "Leave", align: "right", value: (s) => s.leave || 0 },
    {
      key: "percentage",
      label: "Attendance %",
      align: "right",
      sortable: true,
      value: (s) => s.percentage || 0,
      render: (s) => (
        <Badge variant={(s.percentage || 0) >= 75 ? "default" : "destructive"}>
          {s.percentage?.toFixed?.(1) ?? s.percentage ?? 0}%
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Attendance Reports</h1><p className="text-muted-foreground">Monthly attendance analytics and student-wise reports</p></div>
        <Button variant="outline" onClick={exportCSV} disabled={students.length === 0}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="flex gap-4">
        <AdvancedSelect
          value={classId}
          onChange={(v) => setClassId(v)}
          options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
        />
        <AdvancedSelect
          className="w-44"
          value={month}
          onChange={(v) => setMonth(v)}
          options={MONTH_OPTIONS}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Working Days</p><p className="text-2xl font-bold">{summary.working_days || "—"}</p></div><Calendar className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Avg Attendance</p><p className="text-2xl font-bold text-green-600">{summary.avg_attendance ? `${summary.avg_attendance}%` : (summary.attendance_rate ? `${summary.attendance_rate}%` : "—")}</p></div><TrendingUp className="h-8 w-8 text-green-600 opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Students</p><p className="text-2xl font-bold">{summary.total_students || students.length || "—"}</p></div><Users className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Below 75%</p><p className="text-2xl font-bold text-red-600">{summary.below_threshold || students.filter((s: any) => (s.percentage || 0) < 75).length}</p></div><Users className="h-8 w-8 text-red-600 opacity-50" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Student-wise Attendance</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={REPORT_COLUMNS}
            rows={students}
            rowKey={(s: any) => s.student_id || s.student_name || Math.random().toString(36).slice(2)}
            searchable
            searchPlaceholder="Search students…"
            exportFileName={`attendance-${month}`}
            empty={{ icon: Users, title: "No data available", body: "Pick a class and month with recorded attendance." }}
          />
        </CardContent>
      </Card>
    </div>
  );
}