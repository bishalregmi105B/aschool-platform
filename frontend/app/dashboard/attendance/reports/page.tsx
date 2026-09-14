"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AppGate } from "@/lib/apps";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/aos/kit/page-kit";
import { Button } from "@/components/ui/button";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  StatGrid,
  KpiCard,
} from "@/components/aos/kit/page-kit";
import { Download, Users, Calendar, TrendingUp, BarChart3 } from "lucide-react";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";

export default function AttendanceReportsPage() {
  return <AppGate slug="attendance"><ReportsContent /></AppGate>;
}

function ReportsContent() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isTeacher = user?.role === "teacher";
  // Report scope in the URL (?class=&month=) — a month view is a shareable
  // artifact, not transient UI state.
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/attendance/reports";
  const classId = routeParams.get("class") ?? "";
  const month = routeParams.get("month") ?? new Date().toISOString().slice(0, 7);
  function setScope(patch: Record<string, string>) {
    const next = new URLSearchParams(routeParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    navigate(`${pathname}?${next.toString()}`);
  }

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

  const { data, isLoading, isError, refetch: queryClientRefetch } = useQuery({
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

  function refetchReport() {
    void queryClientRefetch();
  }
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
    { key: "student_name", label: t("Student", "विद्यार्थी"), sortable: true, value: (s) => s.student_name || "", render: (s) => <span className="font-medium">{s.student_name}</span> },
    { key: "present", label: t("Present", "हाजिर"), align: "right", sortable: true, value: (s) => s.present || 0, render: (s) => <span style={{ color: "#107c10" }}>{s.present || 0}</span> },
    { key: "absent", label: t("Absent", "अनुपस्थित"), align: "right", sortable: true, value: (s) => s.absent || 0, render: (s) => <span style={{ color: "#c42b1c" }}>{s.absent || 0}</span> },
    { key: "late", label: t("Late", "ढिला"), align: "right", sortable: true, value: (s) => s.late || 0, render: (s) => <span style={{ color: "#d83b01" }}>{s.late || 0}</span> },
    { key: "leave", label: t("Leave", "बिदा"), align: "right", value: (s) => s.leave || 0 },
    {
      key: "percentage",
      label: t("Attendance %", "उपस्थिति %"),
      align: "right",
      sortable: true,
      value: (s) => s.percentage || 0,
      render: (s) => (
        <StatusChip
          status={(s.percentage || 0) >= 75 ? "active" : "at_risk"}
          label={`${s.percentage?.toFixed?.(1) ?? s.percentage ?? 0}%`}
        />
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Attendance Reports", "उपस्थिति प्रतिवेदन")}
        subtitle={t("Monthly attendance analytics and student-wise reports", "मासिक उपस्थिति विश्लेषण")}
        actions={
          <Button variant="outline" onClick={exportCSV} disabled={students.length === 0}>
            <Download className="h-4 w-4 mr-2" /> {t("Export CSV", "CSV निर्यात")}
          </Button>
        }
      />
      <AOSPageBody>
        <FilterCommandBar>
          <AdvancedSelect
            value={classId}
            onChange={(v) => setScope({ class: v || "" })}
            clearable
            placeholder={t("All classes", "सबै कक्षा")}
            options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
          />
          <AdvancedSelect
            className="w-44"
            value={month}
            onChange={(v) => setScope({ month: v })}
            options={MONTH_OPTIONS}
          />
        </FilterCommandBar>

        <StatGrid min={180}>
          <KpiCard
            label={t("Working Days", "कार्यदिन")}
            value={summary.working_days || "—"}
            icon={<Calendar className="h-5 w-5" style={{ color: "var(--w11-text-tertiary)" }} />}
          />
          <KpiCard
            label={t("Avg Attendance", "औसत उपस्थिति")}
            value={summary.avg_attendance ? `${summary.avg_attendance}%` : (summary.attendance_rate ? `${summary.attendance_rate}%` : "—")}
            color="#107c10"
            icon={<TrendingUp className="h-5 w-5" style={{ color: "#107c10", opacity: 0.6 }} />}
          />
          <KpiCard
            label={t("Total Students", "कुल विद्यार्थी")}
            value={summary.total_students || students.length || "—"}
            icon={<Users className="h-5 w-5" style={{ color: "var(--w11-text-tertiary)" }} />}
          />
          <KpiCard
            label={t("Below 75%", "७५% भन्दा कम")}
            value={summary.below_threshold || students.filter((s: any) => (s.percentage || 0) < 75).length}
            color="#c42b1c"
            icon={<Users className="h-5 w-5" style={{ color: "#c42b1c", opacity: 0.6 }} />}
          />
        </StatGrid>

        <DataPanel title={t("Student-wise Attendance", "विद्यार्थीगत उपस्थिति")} bodyClassName="p-0">
          {isLoading ? (
            <div className="p-4"><SkeletonTable rows={8} columns={6} /></div>
          ) : isError ? (
            <ErrorState
              body={t("Failed to load the attendance report.", "प्रतिवेदन लोड हुन सकेन।")}
              onRetry={refetchReport}
            />
          ) : students.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Calendar}
              title={t("No attendance recorded for this scope", "यस अवधिमा उपस्थिति छैन")}
              body={t("Mark attendance for the class/date range — the report fills itself.", "उपस्थिति टिप्नुहोस् — प्रतिवेदन आफैँ भरिन्छ।")}
              action={{ label: t("Mark attendance", "उपस्थिति टिप्नुहोस्"), href: "/dashboard/attendance" }}
            />
          ) : (
          <DataTable
            columns={REPORT_COLUMNS}
            rows={students}
            rowKey={(s: any) => s.student_id || s.student_name || Math.random().toString(36).slice(2)}
            searchable
            searchPlaceholder={t("Search students…", "विद्यार्थी खोज्नुहोस्…")}
            exportFileName={`attendance-${month}`}
          />
          )}
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
