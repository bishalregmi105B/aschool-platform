"use client";

import { useState, useEffect, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PluginGate } from "@/lib/plugins";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  CalendarOff,
  Layers,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { ICON_MAP } from "@/lib/icon-map";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { MarkHolidayDialog } from "@/components/attendance/mark-holiday-dialog";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  StatGrid,
  KpiCard,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

/** Module dashboard quick links — mirrors the attendance plugin manifest
 * (backend/app/plugins/modules/attendance/manifest.yaml ui.nav.subitems). */
const QUICK_LINKS: Array<{ label: string; href: string; icon: string }> = [
  { label: "Leave Requests", href: "/dashboard/attendance/leave-requests", icon: "ClipboardList" },
  { label: "Subject Attendance", href: "/dashboard/attendance/subject", icon: "BookOpenCheck" },
  { label: "Import Attendance", href: "/dashboard/attendance/import", icon: "Upload" },
  { label: "Monthly Report", href: "/dashboard/attendance/reports", icon: "BarChart3" },
  { label: "Holiday List", href: "/dashboard/attendance/holidays", icon: "CalendarDays" },
];

// ── Types ──────────────────────────────────────────────────────────────────
type AttendanceStatus = "present" | "absent" | "late" | "leave";

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  icon: typeof CheckCircle2;
  hex: string;
  chip: string;
}> = [
  {
    value: "present",
    label: "Present",
    icon: CheckCircle2,
    hex: "#107c10",
    chip: "success",
  },
  {
    value: "absent",
    label: "Absent",
    icon: XCircle,
    hex: "#c42b1c",
    chip: "error",
  },
  {
    value: "late",
    label: "Late",
    icon: Clock,
    hex: "#d83b01",
    chip: "warning",
  },
  {
    value: "leave",
    label: "Leave",
    icon: UserX,
    hex: "#0067c0",
    chip: "accent",
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
  const isAdmin = user?.role === "school_admin" || user?.role === "superadmin";

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
  const [holidayOpen, setHolidayOpen] = useState(false);

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

  // ── School-wide overview (admins) — today/week/month rates for the KPI row
  const { data: overview } = useQuery({
    queryKey: ["attendance", "school-overview"],
    queryFn: async () => {
      const r = await api.get("/attendance/school-overview");
      return r.data?.data;
    },
    enabled: isAdmin,
    staleTime: 60_000,
    retry: 1,
  });

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

  // A fresh roster starts with NO status anywhere — the old silent
  // all-present default fabricated attendance for students the teacher
  // never saw. Save refuses until every student is marked explicitly.
  useEffect(() => {
    if (students?.length && !existing?.length) {
      setRecords({});
      setHasChanges(false);
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
  const unmarkedCount = studentList.filter((s: any) => !records[s.id]).length;

  /** Row keyboard marking: with a row focused, P/A/L/E (or 1-4) set the
   *  status and jump to the next row — the typist flow, no mouse needed. */
  const onRowKeyDown = useCallback(
    (e: ReactKeyboardEvent, index: number) => {
      const key = e.key.toLowerCase();
      const byKey: Record<string, AttendanceStatus> = {
        p: "present", "1": "present",
        a: "absent", "2": "absent",
        l: "late", "3": "late",
        e: "leave", "4": "leave",
      };
      const status = byKey[key];
      const rows = document.querySelectorAll<HTMLElement>("[data-att-row]");
      if (status && studentList[index]) {
        e.preventDefault();
        setStatus(studentList[index].id, status);
        rows[index + 1]?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        rows[index + (e.key === "ArrowDown" ? 1 : -1)]?.focus();
      }
    },
    [setStatus, studentList],
  );
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
        // Save is gated on unmarkedCount === 0; the record map always has a
        // real status when this runs (no silent present-default).
        status: records[s.id],
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
  const confirm = useConfirm();

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Attendance"
        subtitle="Mark and track student attendance by class"
        actions={
          <>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setHolidayOpen(true)}
              >
                <CalendarOff className="h-4 w-4" />
                Mark Holiday
              </Button>
            )}
            <Link href="/dashboard/attendance/reports">
              <Button variant="outline" size="sm" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Monthly Reports
              </Button>
            </Link>
          </>
        }
      />
      <AOSPageBody>
        {/* ── Module dashboard — school-wide KPIs + quick links ──────────── */}
        <StatGrid min={170}>
          <KpiCard
            label={isTeacher ? "My Classes" : "Classes"}
            value={(classes || []).length}
            icon={<Users className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Sections"
            value={(classes || []).reduce((sum: number, c: any) => sum + (c.sections?.length ?? 0), 0)}
            color="var(--w11-text-primary)"
            icon={<Layers className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
          {isAdmin && (
            <>
              <KpiCard
                label="Attendance Today"
                value={overview?.summary?.today_pct != null ? `${overview.summary.today_pct}%` : "—"}
                color={
                  overview?.summary?.today_pct == null ? "var(--w11-text-primary)"
                    : overview.summary.today_pct >= 80 ? "#107c10"
                    : overview.summary.today_pct >= 60 ? "#d83b01" : "#c42b1c"
                }
                icon={<CheckCircle2 className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
              />
              <KpiCard
                label="This Week"
                value={overview?.summary?.week_pct != null ? `${overview.summary.week_pct}%` : "—"}
                color="var(--w11-text-primary)"
                icon={<BarChart3 className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
              />
              <KpiCard
                label="This Month"
                value={overview?.summary?.month_pct != null ? `${overview.summary.month_pct}%` : "—"}
                color="var(--w11-text-primary)"
                icon={<TrendingUp className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
              />
            </>
          )}
        </StatGrid>

        <DataPanel title="Attendance Quick Links" bodyClassName="p-3" className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {QUICK_LINKS.map((l) => {
              const Icon = ICON_MAP[l.icon] ?? ChevronRight;
              return (
                <Link key={l.href} href={l.href} className="block h-full">
                  <div
                    className="win11-card flex items-center gap-3 p-3 h-full transition-colors hover:border-[var(--w11-accent)]"
                    style={{ cursor: "pointer", margin: 0 }}
                  >
                    <div
                      className="flex items-center justify-center text-white shrink-0"
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        background: SECTION_GRADIENTS.Academics,
                        boxShadow: "0 8px 16px -4px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.35)",
                      }}
                    >
                      <Icon size={22} strokeWidth={2.2} />
                    </div>
                    <span
                      className="text-[13px] font-semibold leading-tight"
                      style={{ color: "var(--w11-text-primary)" }}
                    >
                      {l.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </DataPanel>

        {/* ── Filter Row ─────────────────────────────────────────────────── */}
        <FilterCommandBar>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[color:var(--w11-text-secondary)]">
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

          <div className="space-y-1">
            <label className="text-xs font-medium text-[color:var(--w11-text-secondary)]">
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

          <div className="space-y-1">
            <label className="text-xs font-medium text-[color:var(--w11-text-secondary)]">
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
          <div className="space-y-1 ml-auto">
            <label className="text-xs font-medium text-[color:var(--w11-text-secondary)]">
              Quick Mark All
            </label>
            <div className="flex gap-1">
              <Button
                size="sm"
                className="flex-1 h-9"
                onClick={() => markAll("present")}
                disabled={!isReady || !total}
              >
                ✓ All Present
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 h-9"
                onClick={async () => {
                  // One mis-click here sends absence alerts to every
                  // guardian (push+SMS+in-app) — it must be confirmed.
                  const ok = await confirm({
                    title: "Mark ALL students absent?",
                    body: `${total} students will be marked absent and guardians will be notified. This is rarely what you want — use it only when the whole class is genuinely out.`,
                    confirmLabel: "Mark all absent",
                    tone: "danger",
                  });
                  if (ok) markAll("absent");
                }}
                disabled={!isReady || !total}
              >
                ✗ All Absent
              </Button>
            </div>
          </div>
        </FilterCommandBar>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        {isReady && (
          <div className="flex gap-1 mb-4 border-b border-[var(--w11-border-subtle)]">
            {(
              [
                { id: "mark", label: "Mark Attendance" },
                { id: "view", label: "Today's Summary" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-[var(--w11-accent)] text-[color:var(--w11-text-primary)]"
                    : "border-transparent text-[color:var(--w11-text-secondary)] hover:text-[color:var(--w11-text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Not selected state ─────────────────────────────────────────── */}
        {!isReady && (
          <div className="win11-card">
            <AOSEmptyState
              icon={<Users className="h-12 w-12" />}
              title="Select a class to get started"
              description="Choose a class above to mark or view attendance"
            />
          </div>
        )}

        {/* ── Summary Strip ─────────────────────────────────────────────── */}
        {isReady && total > 0 && (
          <StatGrid min={120}>
            <KpiCard label="Total" value={total} />
            <KpiCard label="Present" value={present} color="#107c10" />
            <KpiCard label="Absent" value={absent} color="#c42b1c" />
            <KpiCard label="Late" value={late} color="#d83b01" />
            <KpiCard
              label="Attendance %"
              value={`${percentage}%`}
              color={
                percentage >= 80 ? "#107c10" : percentage >= 60 ? "#d83b01" : "#c42b1c"
              }
            />
          </StatGrid>
        )}

        {/* ── Mark Attendance Tab ─────────────────────────────────────────── */}
        {isReady && activeTab === "mark" && (
          <>
            {studentsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[color:var(--w11-text-secondary)]" />
              </div>
            ) : studentList.length === 0 ? (
              <div className="win11-card">
                <AOSEmptyState
                  title="No students found"
                  description="No students found in this class."
                />
              </div>
            ) : (
              <>
                <DataPanel bodyClassName="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Roll</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead className="w-[320px]">
                          Attendance Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentList.map((s: any, index: number) => {
                        const status: AttendanceStatus | undefined =
                          records[s.id];

                        return (
                          <TableRow
                            key={s.id}
                            data-att-row
                            tabIndex={0}
                            onKeyDown={(e) => onRowKeyDown(e, index)}
                            className={`focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w11-accent)]`}
                            style={!status ? { background: "rgba(216,59,1,0.05)" } : undefined}
                          >
                            <TableCell className="text-center font-mono text-xs text-[color:var(--w11-text-secondary)]">
                              {s.roll_number || "—"}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">
                                {s.first_name} {s.last_name}
                              </p>
                              {s.student_id && (
                                <p className="text-xs text-[color:var(--w11-text-secondary)]">
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
                                    className={`flex-1 py-1.5 rounded-[var(--w11-radius-md)] text-xs font-medium border transition-all ${
                                      status === opt.value
                                        ? "text-white shadow-sm scale-[1.02] border-transparent"
                                        : "border-[var(--w11-border-default)] text-[color:var(--w11-text-secondary)] hover:bg-[var(--w11-control-hover)]"
                                    }`}
                                    style={status === opt.value ? { background: opt.hex } : undefined}
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
                </DataPanel>

                {/* Save Bar */}
                <div
                  className={`win11-card sticky bottom-4 flex justify-between items-center px-4 py-3 mt-4 transition-all ${
                    hasChanges ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                  style={{ boxShadow: "var(--w11-elevation-flyout)" }}
                >
                  <div className="text-sm text-[color:var(--w11-text-secondary)]">
                    {present} present, {absent} absent, {late} late, {leave} on
                    leave
                    {unmarkedCount > 0 && (
                      <span className="ml-2 font-medium" style={{ color: "#d83b01" }}>
                        · {unmarkedCount} UNMARKED
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => {
                      if (unmarkedCount > 0) {
                        toast.error(
                          `${unmarkedCount} student${unmarkedCount === 1 ? "" : "s"} not marked yet — every student needs an explicit status before saving.`,
                        );
                        return;
                      }
                      saveMutation.mutate();
                    }}
                    disabled={saveMutation.isPending || unmarkedCount > 0}
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
          <DataPanel bodyClassName="p-0">
            {studentsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[color:var(--w11-text-secondary)]" />
              </div>
            ) : studentList.length === 0 ? (
              <div className="py-12 text-center text-[color:var(--w11-text-secondary)]">
                No students found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
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
                        <TableCell className="text-center text-xs font-mono text-[color:var(--w11-text-secondary)]">
                          {s.roll_number || "—"}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {s.first_name} {s.last_name}
                        </TableCell>
                        <TableCell>
                          {opt ? (
                            <span className={`win11-chip ${opt.chip}`}>
                              <StatusIcon className="h-3 w-3" />
                              {opt.label}
                            </span>
                          ) : (
                            <span className="text-xs text-[color:var(--w11-text-secondary)]">
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
          </DataPanel>
        )}
      </AOSPageBody>

      {/* Mark holiday (A-33) — whole school or per class, with a note */}
      <MarkHolidayDialog
        open={holidayOpen}
        onOpenChange={setHolidayOpen}
        defaultClassId={classId !== "none" ? classId : undefined}
      />
    </AOSPage>
  );
}
