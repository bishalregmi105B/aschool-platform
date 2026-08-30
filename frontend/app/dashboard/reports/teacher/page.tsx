"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Download, Star, ClipboardCheck, GraduationCap, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function TeacherReportsPage() {
  const { data: staff, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["teachers-report"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/design-studio/data-sources/teacher/records?limit=100");
      return res.data.data;
    },
  });

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load staff list. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
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
    { label: "90%+", count: attendanceValues.filter((value) => value >= 90).length, color: "bg-emerald-600" },
    { label: "75-89%", count: attendanceValues.filter((value) => value >= 75 && value < 90).length, color: "bg-blue-600" },
    { label: "Below 75%", count: attendanceValues.filter((value) => value < 75).length, color: "bg-red-600" },
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Teacher Performance Reports
          </h1>
          <p className="text-muted-foreground">Analyze staff attendance, classes taken, and evaluations</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><Users className="h-5 w-5 text-blue-600 mb-2" /><p className="text-2xl font-bold">{rows.length}</p><p className="text-sm text-muted-foreground">Teachers</p></CardContent></Card>
        <Card><CardContent className="pt-6"><ClipboardCheck className="h-5 w-5 text-emerald-600 mb-2" /><p className="text-2xl font-bold">{avgAttendance == null ? "—" : `${avgAttendance}%`}</p><p className="text-sm text-muted-foreground">Avg Attendance</p></CardContent></Card>
        <Card><CardContent className="pt-6"><GraduationCap className="h-5 w-5 text-purple-600 mb-2" /><p className="text-2xl font-bold">{totalClasses || "—"}</p><p className="text-sm text-muted-foreground">Classes Taken</p></CardContent></Card>
        <Card><CardContent className="pt-6"><Star className="h-5 w-5 text-yellow-500 mb-2" /><p className="text-2xl font-bold">{avgRating == null ? "—" : avgRating}</p><p className="text-sm text-muted-foreground">Avg Rating</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Attendance Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {attendanceBuckets.map((bucket) => (
              <div key={bucket.label}>
                <div className="flex justify-between text-sm mb-1"><span>{bucket.label}</span><span>{bucket.count}</span></div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${bucket.color}`} style={{ width: `${rows.length ? (bucket.count / rows.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Department Mix</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {departments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No department data available</p>
            ) : departments.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1"><span>{item.label}</span><span>{item.count}</span></div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-slate-700" style={{ width: `${rows.length ? (item.count / rows.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-center">Attendance %</TableHead>
                <TableHead className="text-center">Classes Taken</TableHead>
                <TableHead className="text-right">Student Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((teacher) => {
                const attendance = metricValue(teacher, ["attendance_pct", "attendance_percentage", "attendance"]);
                const classes = metricValue(teacher, ["classes_taken", "total_classes"]);
                const rating = metricValue(teacher, ["student_rating", "rating"]);

                return (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">{teacher.fields.name}</TableCell>
                    <TableCell className="capitalize">{(teacher.fields.designation || "—").replace("_", " ")}</TableCell>
                    <TableCell>{teacher.fields.department || "—"}</TableCell>
                    <TableCell className="text-center">
                      {attendance == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={attendance > 90 ? "success" : "secondary"}>{attendance}%</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{classes ?? "—"}</TableCell>
                    <TableCell className="text-right flex justify-end items-center gap-1">
                      {rating == null ? "—" : rating} {rating != null && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
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
