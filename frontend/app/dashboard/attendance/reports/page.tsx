"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Download, Users, Calendar, TrendingUp } from "lucide-react";

export default function AttendanceReportsPage() {
  return <PluginGate slug="attendance"><ReportsContent /></PluginGate>;
}

function ReportsContent() {
  const [classId, setClassId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => { const r = await api.get("/academics/classes"); return r.data?.data || []; },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["attendance-reports", classId, month],
    queryFn: async () => {
      const params: any = { month };
      if (classId) params.class_id = classId;
      const r = await api.get("/reports/attendance/summary", { params });
      return r.data?.data;
    },
  });

  const report = data || {};
  const students = report.students || [];
  const summary = report.summary || {};

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Attendance Reports</h1><p className="text-muted-foreground">Monthly attendance analytics and student-wise reports</p></div>
        <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="flex gap-4">
        <select className="border rounded-md px-3 py-2" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">All Classes</option>
          {(classes || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="month" className="border rounded-md px-3 py-2" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Working Days</p><p className="text-2xl font-bold">{summary.working_days || "—"}</p></div><Calendar className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Avg Attendance</p><p className="text-2xl font-bold text-green-600">{summary.avg_attendance ? `${summary.avg_attendance}%` : "—"}</p></div><TrendingUp className="h-8 w-8 text-green-600 opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Students</p><p className="text-2xl font-bold">{summary.total_students || students.length || "—"}</p></div><Users className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Below 75%</p><p className="text-2xl font-bold text-red-600">{summary.below_threshold || students.filter((s: any) => (s.percentage || 0) < 75).length}</p></div><Users className="h-8 w-8 text-red-600 opacity-50" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Student-wise Attendance</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Student</TableHead><TableHead>Present</TableHead><TableHead>Absent</TableHead><TableHead>Late</TableHead><TableHead>Leave</TableHead><TableHead>Attendance %</TableHead></TableRow></TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No data available</TableCell></TableRow>
              ) : students.map((s: any, i: number) => (
                <TableRow key={s.student_id || i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.student_name}</TableCell>
                  <TableCell className="text-green-600">{s.present || 0}</TableCell>
                  <TableCell className="text-red-600">{s.absent || 0}</TableCell>
                  <TableCell className="text-yellow-600">{s.late || 0}</TableCell>
                  <TableCell>{s.leave || 0}</TableCell>
                  <TableCell>
                    <Badge variant={(s.percentage || 0) >= 75 ? "default" : "destructive"}>
                      {s.percentage?.toFixed(1) || 0}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
