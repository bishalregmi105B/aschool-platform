"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Clock,
  UserX,
  Save,
  Loader2,
  Users,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { BSDateInput } from "@/components/ui/bs-date-input";

// ── Types ──────────────────────────────────────────────────────────────────
type AttendanceStatus = "present" | "absent" | "late" | "leave";

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  icon: typeof CheckCircle2;
  cls: string;
  btn: string;
}> = [
  {
    value: "present",
    label: "Present",
    icon: CheckCircle2,
    cls: "bg-green-100 text-green-800",
    btn: "bg-green-500 text-white hover:bg-green-600",
  },
  {
    value: "absent",
    label: "Absent",
    icon: XCircle,
    cls: "bg-red-100 text-red-800",
    btn: "bg-red-500 text-white hover:bg-red-600",
  },
  {
    value: "late",
    label: "Late",
    icon: Clock,
    cls: "bg-yellow-100 text-yellow-800",
    btn: "bg-yellow-500 text-white hover:bg-yellow-600",
  },
  {
    value: "leave",
    label: "Leave",
    icon: UserX,
    cls: "bg-blue-100 text-blue-700",
    btn: "bg-blue-500 text-white hover:bg-blue-600",
  },
];

export default function AttendancePage() {
  return (
    <PluginGate slug="attendance">
      <AttendanceContent />
    </PluginGate>
  );
}

function AttendanceContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";

  // ── Filter state ──────────────────────────────────────────────────────────
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [classId, setClassId] = useState("none");
  const [sectionId, setSectionId] = useState("all");
  const [activeTab, setActiveTab] = useState<"mark" | "view">("mark");

  // ── Records state for mark mode ───────────────────────────────────────────
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // ── Classes & sections ────────────────────────────────────────────────────
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

  const selectedClass = (classes || []).find((c: any) => c.id === classId);
  const sections: any[] = selectedClass?.sections || [];

  // ── Students ──────────────────────────────────────────────────────────────
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students-class", classId, sectionId],
    queryFn: async () => {
      const params: Record<string, string> = {
        class_id: classId,
        per_page: "200",
      };
      if (sectionId !== "all") params.section_id = sectionId;
      const r = await api.get("/students", { params });
      return r.data?.data || [];
    },
    enabled: classId !== "none",
  });

  // ── Existing attendance ───────────────────────────────────────────────────
  const { data: existing } = useQuery({
    queryKey: ["attendance", date, classId, sectionId],
    queryFn: async () => {
      const params: Record<string, string> = { date, class_id: classId };
      if (sectionId !== "all") params.section_id = sectionId;
      const r = await api.get("/attendance/list", { params });
      return r.data?.data || [];
    },
    enabled: classId !== "none",
  });

  // Populate records from existing attendance
  useEffect(() => {
    if (existing?.length) {
      const map: Record<string, AttendanceStatus> = {};
      existing.forEach((e: any) => {
        map[e.student_id] = e.status;
      });
      setRecords(map);
      setHasChanges(false);
    }
  }, [existing, date, classId]);

  // Default all to present when new class/date selected
  useEffect(() => {
    if (students?.length && !existing?.length) {
      const map: Record<string, AttendanceStatus> = {};
      students.forEach((s: any) => {
        map[s.id] = "present";
      });
      setRecords(map);
      setHasChanges(true);
    }
  }, [students, existing]);

  const setStatus = useCallback(
    (studentId: string, status: AttendanceStatus) => {
      setRecords((prev) => ({ ...prev, [studentId]: status }));
      setHasChanges(true);
    },
    [],
  );

  const markAll = (status: AttendanceStatus) => {
    if (!students?.length) return;
    const map: Record<string, AttendanceStatus> = {};
    students.forEach((s: any) => {
      map[s.id] = status;
    });
    setRecords(map);
    setHasChanges(true);
  };

  // ── Summary ───────────────────────────────────────────────────────────────
  const studentList = students || [];
  const total = studentList.length;
  const present = studentList.filter(
    (s: any) => records[s.id] === "present",
  ).length;
  const absent = studentList.filter(
    (s: any) => records[s.id] === "absent",
  ).length;
  const late = studentList.filter((s: any) => records[s.id] === "late").length;
  const leave = studentList.filter(
    (s: any) => records[s.id] === "leave",
  ).length;
  // Matches the backend uniform late rule (/attendance/summary): a late
  // student DID attend, so the rate counts present + late.
  const percentage =
    total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const attendanceRecords = studentList.map((s: any) => ({
        student_id: s.id,
        class_id: s.class_id || classId,
        section_id:
          s.section_id || (sectionId !== "all" ? sectionId : undefined),
        status: records[s.id] || "present",
        date,
      }));
      return api.post("/attendance/mark", {
        date,
        class_id: classId,
        section_id: sectionId !== "all" ? sectionId : undefined,
        records: attendanceRecords,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setHasChanges(false);
      toast.success(
        `Attendance saved! ${present}/${total} students present (${percentage}%)`,
      );
    },
    onError: () => toast.error("Failed to save attendance"),
  });

  const isReady = classId !== "none";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground text-sm">
            Mark and track student attendance by class
          </p>
        </div>
        <Link href="/dashboard/attendance/reports">
          <Button variant="outline" size="sm" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Monthly Reports
          </Button>
        </Link>
      </div>

      {/* ── Filter Row ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Date */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                Date
              </label>
              <BSDateInput
                value={date}
                onChange={(v) => {
                  setDate(v);
                  setRecords({});
                  setHasChanges(false);
                }}
              />
            </div>

            {/* Class */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                Class
              </label>
              <Select
                value={classId}
                onValueChange={(v) => {
                  setClassId(v);
                  setSectionId("all");
                  setRecords({});
                  setHasChanges(false);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select class…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>
                    — Choose a class —
                  </SelectItem>
                  {(classes || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                Section
              </label>
              <Select
                value={sectionId}
                onValueChange={(v) => {
                  setSectionId(v);
                  setRecords({});
                  setHasChanges(false);
                }}
                disabled={classId === "none" || !sections.length}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mark all quick buttons */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                Quick Mark All
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => markAll("present")}
                  disabled={!isReady || !total}
                  className="flex-1 h-9 rounded-md bg-green-500 text-white text-xs font-medium hover:bg-green-600 disabled:opacity-40"
                >
                  ✓ All Present
                </button>
                <button
                  onClick={() => markAll("absent")}
                  disabled={!isReady || !total}
                  className="flex-1 h-9 rounded-md bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-40"
                >
                  ✗ All Absent
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      {isReady && (
        <div className="border-b flex gap-0">
          {(
            [
              { id: "mark", label: "Mark Attendance" },
              { id: "view", label: "Today's Summary" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Not selected state ─────────────────────────────────────────── */}
      {!isReady && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Select a class to get started</p>
            <p className="text-sm mt-1">
              Choose a class above to mark or view attendance
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Summary Strip ─────────────────────────────────────────────── */}
      {isReady && total > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total", value: total, cls: "" },
            { label: "Present", value: present, cls: "text-green-700" },
            { label: "Absent", value: absent, cls: "text-red-600" },
            { label: "Late", value: late, cls: "text-yellow-600" },
            {
              label: "Attendance %",
              value: `${percentage}%`,
              cls:
                percentage >= 80
                  ? "text-green-700"
                  : percentage >= 60
                    ? "text-amber-600"
                    : "text-red-600",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-muted/40 rounded-lg px-3 py-2 text-center"
            >
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Mark Attendance Tab ─────────────────────────────────────────── */}
      {isReady && activeTab === "mark" && (
        <>
          {studentsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : studentList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No students found in this class.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-14">Roll</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead className="w-[320px]">
                          Attendance Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentList.map((s: any) => {
                        const status: AttendanceStatus =
                          records[s.id] || "present";
                        const current = STATUS_OPTIONS.find(
                          (o) => o.value === status,
                        )!;

                        return (
                          <TableRow key={s.id}>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {s.roll_number || "—"}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">
                                {s.first_name} {s.last_name}
                              </p>
                              {s.student_id && (
                                <p className="text-xs text-muted-foreground">
                                  {s.student_id}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {STATUS_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() => setStatus(s.id, opt.value)}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                                      status === opt.value
                                        ? opt.btn + " shadow-sm scale-[1.02]"
                                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Save Bar */}
              <div
                className={`sticky bottom-4 flex justify-between items-center bg-background border rounded-xl shadow-lg px-4 py-3 transition-all ${
                  hasChanges ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="text-sm text-muted-foreground">
                  {present} present, {absent} absent, {late} late, {leave} on
                  leave
                </div>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="gap-2"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Attendance
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── View / Summary Tab ──────────────────────────────────────────── */}
      {isReady && activeTab === "view" && (
        <Card>
          <CardContent className="p-0">
            {studentsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : studentList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No students found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-14">Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentList.map((s: any) => {
                    const status: AttendanceStatus =
                      records[s.id] || ("pending" as any);
                    const opt = STATUS_OPTIONS.find((o) => o.value === status);
                    const StatusIcon = opt?.icon || Clock;

                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-center text-xs font-mono text-muted-foreground">
                          {s.roll_number || "—"}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {s.first_name} {s.last_name}
                        </TableCell>
                        <TableCell>
                          {opt ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${opt.cls}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {opt.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Not marked
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
