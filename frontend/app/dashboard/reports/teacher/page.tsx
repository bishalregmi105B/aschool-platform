"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Users, Download, Star, ClipboardCheck, GraduationCap, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

export default function TeacherReportsPage() {
  const { data: staff, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["teachers-report"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/design-studio/data-sources/teacher/records?limit=100");
      return res.data.data;
    },
  });

  const TEACHER_REPORT_COLUMNS: Column<any>[] = [
    { key: "name", label: "Teacher Name", sortable: true, value: (r) => r.fields?.name ?? r.name ?? "", render: (r) => <span className="font-medium">{r.fields?.name}</span> },
    { key: "designation", label: "Designation", sortable: true, value: (r) => r.fields?.designation ?? "", render: (r) => <span className="capitalize">{(r.fields?.designation || "—").replace("_", " ")}</span> },
    { key: "department", label: "Department", sortable: true, value: (r) => r.fields?.department ?? "", render: (r) => r.fields?.department || "—" },
    {
      key: "attendance",
      label: "Attendance %",
      align: "center",
      sortable: true,
      value: (r) => metricValue(r, ["attendance_pct", "attendance_percentage", "attendance"]) ?? -1,
      render: (r) => {
        const attendance = metricValue(r, ["attendance_pct", "attendance_percentage", "attendance"]);
        return attendance == null ? (
          <span className="text-[color:var(--w11-text-secondary)]">—</span>
        ) : (
          <StatusChip status={attendance > 90 ? "completed" : "pending"} label={`${attendance}%`} />
        );
      },
    },
    {
      key: "classes",
      label: "Classes Taken",
      align: "center",
      sortable: true,
      value: (r) => metricValue(r, ["classes_taken", "total_classes"]) ?? -1,
      render: (r) => metricValue(r, ["classes_taken", "total_classes"]) ?? "—",
    },
    {
      key: "rating",
      label: "Student Rating",
      align: "right",
      sortable: true,
      value: (r) => metricValue(r, ["student_rating", "rating"]) ?? -1,
      render: (r) => {
        const rating = metricValue(r, ["student_rating", "rating"]);
        return (
          <span className="inline-flex justify-end items-center gap-1">
            {rating == null ? "—" : rating} {rating != null && <Star className="h-4 w-4" style={{ color: "var(--w11-accent)", fill: "var(--w11-accent)" }} />}
          </span>
        );
      },
    },
  ];

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <AOSPage>
          <AOSPageHeader
            icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
            title="Teacher Performance Reports"
            subtitle="Analyze staff attendance, classes taken, and evaluations"
          />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load staff list. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          </AOSPageBody>
        </AOSPage>
      );
    }
  const rows = staff || [];
  const attendanceValues = rows
    .map((teacher) => metricValue(teacher, ["attendance_pct", "attendance_percentage", "attendance"]))
    .filter((value) => typeof value === "number") as number[];
  const ratingValues = rows
    .map((teacher) => metricValue(teacher, ["student_rating", "rating"]))
    .filter((value) => typeof value === "number") as number[];
  const classesTaken = rows
    .map((teacher) => metricValue(teacher, ["classes_taken", "total_classes"]))
    .filter((value) => typeof value === "number") as number[];
  const avgAttendance = average(attendanceValues);
  const avgRating = average(ratingValues);
  const totalClasses = classesTaken.reduce((sum, value) => sum + value, 0);
  const departments = groupCount(rows.map((teacher) => teacher.fields?.department || "Unassigned"));
  const attendanceBuckets = [
    { label: "90%+", count: attendanceValues.filter((value) => value >= 90).length, color: "#0f7b0f" },
    { label: "75-89%", count: attendanceValues.filter((value) => value >= 75 && value < 90).length, color: "var(--w11-accent)" },
    { label: "Below 75%", count: attendanceValues.filter((value) => value < 75).length, color: "#c42b1c" },
  ];

  const exportCsv = () => {
    const csvRows = [
      ["Teacher Name", "Designation", "Department", "Attendance", "Classes Taken", "Student Rating"],
      ...rows.map((teacher) => [
        teacher.fields.name ?? "",
        teacher.fields.designation ?? "",
        teacher.fields.department ?? "",
        metricValue(teacher, ["attendance_pct", "attendance_percentage", "attendance"]) ?? "",
        metricValue(teacher, ["classes_taken", "total_classes"]) ?? "",
        metricValue(teacher, ["student_rating", "rating"]) ?? "",
      ]),
    ];
    const csv = csvRows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "teacher-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Teacher Performance Reports"
        subtitle="Analyze staff attendance, classes taken, and evaluations"
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export Report
          </Button>
        }
      />
      <AOSPageBody>
        <StatGrid min={180}>
          <KpiCard label="Teachers" value={rows.length} icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Avg Attendance" value={avgAttendance == null ? "—" : `${avgAttendance}%`} icon={<ClipboardCheck className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Classes Taken" value={totalClasses || "—"} icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Avg Rating" value={avgRating == null ? "—" : avgRating} icon={<Star className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </StatGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DataPanel title={<span className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Attendance Distribution</span>}>
            <div className="space-y-3">
              {attendanceBuckets.map((bucket) => (
                <div key={bucket.label}>
                  <div className="flex justify-between text-sm mb-1"><span>{bucket.label}</span><span>{bucket.count}</span></div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--w11-control-hover)" }}>
                    <div className="h-full" style={{ width: `${rows.length ? (bucket.count / rows.length) * 100 : 0}%`, background: bucket.color }} />
                  </div>
                </div>
              ))}
            </div>
          </DataPanel>
          <DataPanel title="Department Mix">
            <div className="space-y-3">
              {departments.length === 0 ? (
                <p className="text-sm text-[color:var(--w11-text-secondary)]">No department data available</p>
              ) : departments.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1"><span>{item.label}</span><span>{item.count}</span></div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--w11-control-hover)" }}>
                    <div className="h-full" style={{ width: `${rows.length ? (item.count / rows.length) * 100 : 0}%`, background: "var(--w11-accent)" }} />
                  </div>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>

        <DataPanel bodyClassName="p-0 pt-0">
          <DataTable
            columns={TEACHER_REPORT_COLUMNS}
            rows={rows}
            rowKey={(r: any) => r.id ?? r.name}
            searchable
            searchPlaceholder="Search teachers…"
            exportFileName="teacher-report"
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}

function metricValue(teacher: any, keys: string[]) {
  for (const key of keys) {
    const value = teacher.fields?.[key] ?? teacher[key];
    if (value !== undefined && value !== null && value !== "") {
      const numberValue = Number(value);
      return Number.isNaN(numberValue) ? value : numberValue;
    }
  }
  return null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function groupCount(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
