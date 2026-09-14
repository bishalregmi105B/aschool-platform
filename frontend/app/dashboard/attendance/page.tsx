"use client";

import { useState, useEffect, useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AppGate } from "@/lib/apps";
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
  Printer,
  CalendarOff,
  Layers,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { DependencyMissingEmptyState, EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";
import { MarkHolidayDialog } from "@/components/attendance/mark-holiday-dialog";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  StatGrid,
  KpiCard,
  DataPanel,
} from "@/components/aos/kit/page-kit";

/**
 * Wave-A rewrite deltas (the marking interaction itself is corpus-best and
 * kept untouched per the audit's "keep" list):
 * - Date/Class/Section + the Mark/View tab now live in the window route
 *   (?date=&class=&section=&tab=) — shareable, refresh-safe, back-buttoned.
 * - Hand-rolled tab strip (plan G2) → kit <Tabs> (win11-tablist + keyboard).
 * - Quick Links panel → kit <QuickLinks>.
 * - Dependency empty state → shared DependencyMissingEmptyState; bilingual
 *   chrome via t().
 * - TODO(rewrite-wave-A): register print-twin (plan 9.5) once AOSPageHeader
 *   gains the printRef prop — no fake print button until then.
 */

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
    <AppGate slug="attendance">
      <AttendanceContent />
    </AppGate>
  );
}

function AttendanceContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useI18n();
  const isTeacher = user?.role === "teacher";
  const isAdmin = user?.role === "school_admin" || user?.role === "superadmin";

  // ── Filter state — URL-backed (window route → address bar) ────────────────
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/attendance";
  function setParams(patch: Record<string, string>) {
    const next = new URLSearchParams(routeParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== "none" && v !== "all") next.set(k, v);
      else next.delete(k);
    }
    navigate(`${pathname}?${next.toString()}`);
  }
  const date = routeParams.get("date") || new Date().toISOString().split("T")[0];
  const classId = routeParams.get("class") || "none";
  const sectionId = routeParams.get("section") || "all";
  const activeTab: "mark" | "view" = routeParams.get("tab") === "view" ? "view" : "mark";
  const [dateNonce, setDateNonce] = useState(0);
  function resetMarks() {
    setRecords({});
    setHasChanges(false);
    setDateNonce((n) => n + 1);
  }

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
    } else if (dateNonce) {
      setRecords({});
      setHasChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, date, classId, dateNonce]);

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
        t(
          `Attendance saved! ${present}/${total} students present (${percentage}%)`,
          `उपस्थिति सुरक्षित! ${present}/${total} हाजिर (${percentage}%)`
        ),
      );
    },
    onError: () => toast.error("Failed to save attendance"),
  });

  const isReady = classId !== "none";
  const confirm = useConfirm();
  // Print twin (plan 9.5): the roster panel is the print target — the
  // letterhead + generated-by footer are injected at print time.
  const rosterPrintRef = useRef<HTMLDivElement>(null);
  const selectedClassName =
    (classes || []).find((c: any) => String(c.id) === classId)?.name || "";
  const selectedSectionName =
    (classes || []).find((c: any) => String(c.id) === classId)?.sections?.find(
      (s: any) => String(s.id) === sectionId
    )?.name || "";

  const printRoster = () => {
    const target = rosterPrintRef.current;
    if (!target) return;
    const head = document.createElement("div");
    head.className = "print-only print-letterhead";
    const h = document.createElement("h2");
    h.textContent = `Attendance Register — ${selectedClassName}${selectedSectionName ? ` ${selectedSectionName}` : ""}`;
    const p = document.createElement("p");
    p.textContent = date ? `Date: ${date}` : "";
    head.append(h, p);
    const foot = document.createElement("div");
    foot.className = "print-only print-footer";
    foot.textContent = `Printed on ${new Date().toLocaleDateString()} · Generated by ASchool`;
    const cleanup = () => {
      target.classList.remove("print-area");
      head.remove();
      foot.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    target.classList.add("print-area");
    target.prepend(head);
    target.append(foot);
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 120000);
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Attendance", "उपस्थिति")}
        subtitle={t("Mark and track student attendance by class", "कक्षाअनुसार विद्यार्थी उपस्थिति")}
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
                {t("Mark Holiday", "विदा तोक्नुहोस्")}
              </Button>
            )}
            <Link href="/dashboard/attendance/reports">
              <Button variant="outline" size="sm" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                {t("Monthly Reports", "मासिक प्रतिवेदन")}
              </Button>
            </Link>
            {isReady && studentList.length > 0 && activeTab === "mark" && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={printRoster}>
                <Printer className="h-4 w-4" />
                {t("Print Register", "रजिस्टर प्रिन्ट")}
              </Button>
            )}
          </>
        }
      />
      <AOSPageBody>
        {/* ── Module dashboard — school-wide KPIs + quick links ──────────── */}
        <StatGrid min={170}>
          <KpiCard
            label={isTeacher ? t("My Classes", "मेरा कक्षा") : t("Classes", "कक्षा")}
            value={(classes || []).length}
            icon={<Users className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Sections", "सेक्सन")}
            value={(classes || []).reduce((sum: number, c: any) => sum + (c.sections?.length ?? 0), 0)}
            color="var(--w11-text-primary)"
            icon={<Layers className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
          {isAdmin && (
            <>
              <KpiCard
                label={t("Attendance Today", "आजको उपस्थिति")}
                value={overview?.summary?.today_pct != null ? `${overview.summary.today_pct}%` : "—"}
                color={
                  overview?.summary?.today_pct == null ? "var(--w11-text-primary)"
                    : overview.summary.today_pct >= 80 ? "#107c10"
                    : overview.summary.today_pct >= 60 ? "#d83b01" : "#c42b1c"
                }
                icon={<CheckCircle2 className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
              />
              <KpiCard
                label={t("This Week", "यो हप्ता")}
                value={overview?.summary?.week_pct != null ? `${overview.summary.week_pct}%` : "—"}
                color="var(--w11-text-primary)"
                icon={<BarChart3 className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
              />
              <KpiCard
                label={t("This Month", "यो महिना")}
                value={overview?.summary?.month_pct != null ? `${overview.summary.month_pct}%` : "—"}
                color="var(--w11-text-primary)"
                icon={<TrendingUp className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
              />
            </>
          )}
        </StatGrid>

        <QuickLinks
          section="Academics"
          className="mb-4"
          links={[
            { label: t("Leave Requests", "बिदा अनुरोध"), href: "/dashboard/attendance/leave-requests", icon: "ClipboardList" },
            { label: t("Subject Attendance", "विषय उपस्थिति"), href: "/dashboard/attendance/subject", icon: "BookOpenCheck" },
            { label: t("Import Attendance", "उपस्थिति आयात"), href: "/dashboard/attendance/import", icon: "Upload" },
            { label: t("Monthly Report", "मासिक प्रतिवेदन"), href: "/dashboard/attendance/reports", icon: "BarChart3" },
            { label: t("Holiday List", "विदा सूची"), href: "/dashboard/attendance/holidays", icon: "CalendarDays" },
          ]}
        />

        {/* ── Filter Row ─────────────────────────────────────────────────── */}
        <FilterCommandBar>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[color:var(--w11-text-secondary)]">
              {t("Date", "मिति")}
            </label>
            <BSDateInput
              value={date}
              onChange={(v) => {
                setParams({ date: v });
                resetMarks();
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[color:var(--w11-text-secondary)]">
              {t("Class", "कक्षा")}
            </label>
            <Select
              value={classId}
              onValueChange={(v) => {
                setParams({ class: v, section: "" });
                resetMarks();
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={t("Select class…", "कक्षा छान्नुहोस्…")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>
                  {t("— Choose a class —", "— कक्षा छान्नुहोस् —")}
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
              {t("Section", "सेक्सन")}
            </label>
            <Select
              value={sectionId}
              onValueChange={(v) => {
                setParams({ section: v });
                resetMarks();
              }}
              disabled={classId === "none" || !sections.length}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Sections", "सबै सेक्सन")}</SelectItem>
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
              {t("Quick Mark All", "सबै छिटो टिप्नुहोस्")}
            </label>
            <div className="flex gap-1">
              <Button
                size="sm"
                className="flex-1 h-9"
                onClick={() => markAll("present")}
                disabled={!isReady || !total}
              >
                {t("✓ All Present", "✓ सबै हाजिर")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 h-9"
                onClick={async () => {
                  // One mis-click here sends absence alerts to every
                  // guardian (push+SMS+in-app) — it must be confirmed.
                  const ok = await confirm({
                    title: t("Mark ALL students absent?", "सबै विद्यार्थी अनुपस्थित टिप्ने?"),
                    body: t(
                      `${total} students will be marked absent and guardians will be notified. This is rarely what you want — use it only when the whole class is genuinely out.`,
                      `${total} विद्यार्थी अनुपस्थित टिपिनेछ र अभिभावकलाई खबर जान्छ।`
                    ),
                    confirmLabel: t("Mark all absent", "सबै अनुपस्थित"),
                    tone: "danger",
                  });
                  if (ok) markAll("absent");
                }}
                disabled={!isReady || !total}
              >
                {t("✗ All Absent", "✗ सबै अनुपस्थित")}
              </Button>
            </div>
          </div>
        </FilterCommandBar>

        {/* ── Tabs (kit; G2) — selection syncs to ?tab= ──────────────────── */}
        {isReady && (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setParams({ tab: v === "mark" ? "" : v })}
            className="mb-4"
          >
            <TabsList variant="underline">
              <TabsTrigger value="mark">{t("Mark Attendance", "उपस्थिति टिप्नुहोस्")}</TabsTrigger>
              <TabsTrigger value="view">{t("Summary", "सारांश")}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* ── Not selected state ─────────────────────────────────────────── */}
        {!isReady && (
          <div className="win11-card">
            {(classes || []).length === 0 ? (
              /* Dependency-chain empty state: attendance is blocked on a
                 class existing — deep-link the unblocking step (audit 5.2a). */
              <DependencyMissingEmptyState
                icon={Users}
                title={t("No classes yet", "अझै कक्षा छैन")}
                body={t("Attendance needs at least one class. Create classes in Academics first.", "उपस्थितिको लागि कम्तीमा एक कक्षा चाहिन्छ — अकाडेमिक्समा बनाउनुहोस्।")}
                prerequisiteName={t("Classes", "कक्षा")}
                setupHref="/dashboard/academics"
                setupLabel={t("Create your first class — पहिलो कक्षा सिर्जना गर्नुहोस्", "पहिलो कक्षा सिर्जना गर्नुहोस्")}
              />
            ) : (
              <EmptyState
                icon={Users}
                title={t("Select a class to get started", "सुरु गर्न कक्षा छान्नुहोस्")}
                body={t("Choose a class above to mark or view attendance.", "माथिबाट कक्षा छान्नुहोस्।")}
              />
            )}
          </div>
        )}

        {/* ── Summary Strip ─────────────────────────────────────────────── */}
        {isReady && total > 0 && (
          <StatGrid min={120}>
            <KpiCard label={t("Total", "कुल")} value={total} />
            <KpiCard label={t("Present", "हाजिर")} value={present} color="#107c10" />
            <KpiCard label={t("Absent", "अनुपस्थित")} value={absent} color="#c42b1c" />
            <KpiCard label={t("Late", "ढिला")} value={late} color="#d83b01" />
            <KpiCard
              label={t("Attendance %", "उपस्थिति %")}
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
              <SkeletonTable rows={8} columns={3} />
            ) : studentList.length === 0 ? (
              <div className="win11-card">
                <EmptyState
                  icon={Users}
                  title={t("No students in this class", "यो कक्षामा विद्यार्थी छैनन्")}
                  body={t("Enroll students first, then mark attendance.", "पहिले विद्यार्थी भर्ना गर्नुहोस्।")}
                  action={{ label: t("Add Student", "विद्यार्थी थप्नुहोस्"), href: "/dashboard/students/new" }}
                />
              </div>
            ) : (
              <>
                <div ref={rosterPrintRef}>
                <DataPanel bodyClassName="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">{t("Roll", "रोल")}</TableHead>
                        <TableHead>{t("Student Name", "नाम")}</TableHead>
                        <TableHead className="w-[320px]">
                          {t("Attendance Status", "अवस्था")}
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
                </div>

                {/* Save Bar */}
                <div
                  className={`win11-card sticky bottom-4 flex justify-between items-center px-4 py-3 mt-4 transition-all ${
                    hasChanges ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                  style={{ boxShadow: "var(--w11-elevation-flyout)" }}
                >
                  <div className="text-sm text-[color:var(--w11-text-secondary)]">
                    {present} {t("present", "हाजिर")}, {absent} {t("absent", "अनुपस्थित")},{" "}
                    {late} {t("late", "ढिला")}, {leave} {t("on leave", "बिदामा")}
                    {unmarkedCount > 0 && (
                      <span className="ml-2 font-medium" style={{ color: "#d83b01" }}>
                        · {unmarkedCount} {t("UNMARKED", "अनटिप्दा")}
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => {
                      if (unmarkedCount > 0) {
                        toast.error(
                          t(
                            `${unmarkedCount} student${unmarkedCount === 1 ? "" : "s"} not marked yet — every student needs an explicit status before saving.`,
                            `${unmarkedCount} विद्यार्थी अझै टिपिएको छैन — सबैको अवस्था तोक्नुहोस्।`
                          ),
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
                    {t("Save Attendance", "उपस्थिति सुरक्षित")}
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
              <SkeletonTable rows={8} columns={3} />
            ) : studentList.length === 0 ? (
              <div className="py-12 text-center" style={{ color: "var(--w11-text-secondary)" }}>
                {t("No students found.", "विद्यार्थी भेटिएन।")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">{t("Roll", "रोल")}</TableHead>
                    <TableHead>{t("Student", "विद्यार्थी")}</TableHead>
                    <TableHead>{t("Status", "अवस्था")}</TableHead>
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
                              {t("Not marked", "टिपिएको छैन")}
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
