"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, DependencyMissingEmptyState } from "@/components/ui/empty-state";
import { BSDateInput, BSMonthInput } from "@/components/ui/bs-date-input";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import {
  BookOpen, Save, Printer, CalendarOff, Loader2, CheckCheck,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────
type SubjectStatus = "present" | "absent" | "late" | "half_day" | "leave";

const STATUS_OPTIONS: Array<{
  value: SubjectStatus;
  short: string;
  label: string;
  hex: string;
  chip: string;
}> = [
  {
    value: "present", short: "P", label: "Present",
    hex: "#107c10", chip: "success",
  },
  {
    value: "absent", short: "A", label: "Absent",
    hex: "#c42b1c", chip: "error",
  },
  {
    value: "late", short: "L", label: "Late",
    hex: "#d83b01", chip: "warning",
  },
  {
    value: "half_day", short: "H", label: "Half Day",
    hex: "#986f0b", chip: "warning",
  },
  {
    value: "leave", short: "Leave", label: "Leave",
    hex: "#0067c0", chip: "accent",
  },
];

export default function SubjectAttendancePage() {
  return (
    <PluginGate slug="attendance">
      <SubjectAttendanceContent />
    </PluginGate>
  );
}

function SubjectAttendanceContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdmin = user?.role === "school_admin" || user?.role === "superadmin";
  const confirm = useConfirm();

  // ── Filters — URL-backed scope (?date=&class=&section=&subject=) ─────────
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/attendance/subject";
  function setScope(patch: Record<string, string>) {
    const next = new URLSearchParams(routeParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    }
    navigate(`${pathname}?${next.toString()}`);
  }
  const date = routeParams.get("date") || new Date().toISOString().split("T")[0];
  const classId = routeParams.get("class") ?? "";
  const sectionId = routeParams.get("section") || "all";
  const subjectId = routeParams.get("subject") ?? "";
  const [registerMonth, setRegisterMonth] = useState<string | null>(null);
  const [holidayOpen, setHolidayOpen] = useState(false);

  // ── Records for mark mode ─────────────────────────────────────────────────
  const [records, setRecords] = useState<Record<string, SubjectStatus>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const selectedClass = (classes || []).find(
    (c: { id: string; sections?: Array<{ id: string; name: string }> }) => c.id === classId,
  );
  const sections = selectedClass?.sections || [];

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects", classId],
    queryFn: async () => {
      const res = await api.get(`/academics/subjects?class_id=${classId}`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!classId,
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students-class", classId, sectionId],
    queryFn: async () => {
      const params: Record<string, string> = { class_id: classId, per_page: "200" };
      if (sectionId !== "all") params.section_id = sectionId;
      const res = await api.get("/students", { params });
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!classId,
    retry: 1,
  });

  const isReady = !!classId && !!subjectId;

  // Existing register rows for this class+subject+date
  const existing = useQuery({
    queryKey: ["subject-attendance", classId, subjectId, date],
    queryFn: async () => {
      const res = await api.get("/attendance/subject/list", {
        params: { class_id: classId, subject_id: subjectId, date },
      });
      return (res.data?.data?.records || []) as Array<{
        student_id: string;
        status: SubjectStatus;
        remarks?: string | null;
      }>;
    },
    enabled: isReady,
    retry: 1,
  });

  useEffect(() => {
    const rows = existing.data || [];
    if (rows.length) {
      const next: Record<string, SubjectStatus> = {};
      const nextRemarks: Record<string, string> = {};
      for (const r of rows) {
        next[r.student_id] = r.status;
        if (r.remarks) nextRemarks[r.student_id] = r.remarks;
      }
      setRecords(next);
      setRemarks(nextRemarks);
      setHasChanges(false);
    } else {
      setRecords({});
      setRemarks({});
      setHasChanges(false);
    }
  }, [existing.data]);

  const setStatus = useCallback((studentId: string, status: SubjectStatus) => {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
    setHasChanges(true);
  }, []);

  const markAll = (status: SubjectStatus) => {
    if (!students?.length) return;
    const map: Record<string, SubjectStatus> = {};
    (students as Array<{ id: string }>).forEach((s) => {
      map[s.id] = status;
    });
    setRecords(map);
    setHasChanges(true);
  };

  const studentList = students || [];
  const marked = studentList.filter((s: { id: string }) => records[s.id]);
  const count = (status: SubjectStatus) =>
    studentList.filter((s: { id: string }) => records[s.id] === status).length;
  const unmarkedCount = studentList.length - marked.length;

  // ── Save (POST /attendance/subject/mark) ──────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = studentList
        .filter((s: { id: string }) => records[s.id])
        .map((s: { id: string }) => ({
          student_id: s.id,
          status: records[s.id],
          remarks: remarks[s.id] || undefined,
        }));
      const res = await api.post("/attendance/subject/mark", {
        class_id: classId,
        subject_id: subjectId,
        section_id: sectionId !== "all" ? sectionId : undefined,
        date,
        entries,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        `Subject attendance saved — ${data?.data?.marked ?? 0} students marked.`,
      );
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["subject-attendance"] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : "Failed to save subject attendance");
    },
  });

  // ── Monthly register print twin ───────────────────────────────────────────
  const [printing, setPrinting] = useState(false);
  const openRegisterPrint = async () => {
    if (!classId) return;
    setPrinting(true);
    try {
      const params = new URLSearchParams({ class_id: classId });
      if (sectionId !== "all") params.set("section_id", sectionId);
      if (registerMonth) params.set("month_bs", registerMonth);
      const res = await api.get(`/attendance/register/print?${params.toString()}`, {
        responseType: "text",
        transformResponse: [(d) => d],
      });
      const html = typeof res.data === "string" ? res.data : "";
      if (!html) {
        toast.error("No printable content returned");
        return;
      }
      const w = window.open("", "_blank");
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
      } else {
        toast.error("Popup blocked — allow popups for this site");
      }
    } catch {
      toast.error("Failed to open the register print view");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Subject Attendance", "विषय उपस्थिति")}
        subtitle={t("Mark period-wise attendance per class, subject and date", "कक्षा-विषयअनुसार अवधिगत उपस्थिति")}
        actions={
          <>
            {isAdmin && (
              <Button variant="outline" onClick={() => setHolidayOpen(true)}>
                <CalendarOff className="h-4 w-4 mr-2" /> {t("Mark Holiday", "विदा")}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={!classId || printing}
              onClick={openRegisterPrint}
            >
              {printing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              {t("Register Print", "रजिस्टर प्रिन्ट")}
            </Button>
          </>
        }
      />
      <AOSPageBody>
        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <FilterCommandBar>
          <div className="space-y-1">
            <Label className="text-xs text-[color:var(--w11-text-secondary)] font-medium">{t("Date", "मिति")}</Label>
            <BSDateInput
              value={date}
              onChange={(v) => {
                setScope({ date: v });
                setHasChanges(false);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[color:var(--w11-text-secondary)] font-medium">{t("Class", "कक्षा")}</Label>
            <Select
              value={classId}
              onValueChange={(v) => {
                setScope({ class: v, subject: "", section: "" });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select class…" />
              </SelectTrigger>
              <SelectContent>
                {(classes || []).map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[color:var(--w11-text-secondary)] font-medium">{t("Section", "सेक्सन")}</Label>
            <Select
              value={sectionId}
              onValueChange={(v) => setScope({ section: v })}
              disabled={!classId || !sections.length}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={t("All sections", "सबै सेक्सन")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Sections", "सबै सेक्सन")}</SelectItem>
                {sections.map((s: { id: string; name: string }) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[color:var(--w11-text-secondary)] font-medium">{t("Subject", "विषय")}</Label>
            <Select value={subjectId} onValueChange={(v) => setScope({ subject: v })} disabled={!classId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select subject…" />
              </SelectTrigger>
              <SelectContent>
                {(subjects || []).map((s: { id: string; name: string; code?: string }) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[color:var(--w11-text-secondary)] font-medium">
              {t("Register month (print)", "रजिस्टर महिना (प्रिन्ट)")}
            </Label>
            <BSMonthInput
              value={registerMonth ?? undefined}
              onChange={setRegisterMonth}
            />
          </div>
        </FilterCommandBar>

        {!classId || !subjectId ? (
          (classes || []).length === 0 && !classId ? (
            <div className="win11-card">
              <DependencyMissingEmptyState
                icon={BookOpen}
                title={t("No classes yet", "अझै कक्षा छैन")}
                body={t("Subject attendance needs a class with mapped subjects.", "कक्षा र विषय चाहिन्छ।")}
                prerequisiteName={t("Classes", "कक्षा")}
                setupHref="/dashboard/academics"
                setupLabel={t("Create your first class →", "पहिलो कक्षा बनाउनुहोस् →")}
              />
            </div>
          ) : (
          <div className="win11-card">
            <EmptyState
              icon={BookOpen}
              title={t("Select a class and subject", "कक्षा र विषय छान्नुहोस्")}
              body={
                subjectsLoading
                  ? t("Loading subjects…", "विषय लोड हुँदै…")
                  : t("Choose a class, subject and date to mark attendance.", "कक्षा, विषय र मिति छान्नुहोस्।")
              }
            />
          </div>
          )
        ) : (
          <>
            {/* Summary strip */}
            {studentList.length > 0 && (
              <StatGrid min={110}>
                <KpiCard label="Total" value={studentList.length} />
                <KpiCard label="Present" value={count("present")} color="#107c10" />
                <KpiCard label="Absent" value={count("absent")} color="#c42b1c" />
                <KpiCard label="Late" value={count("late")} color="#d83b01" />
                <KpiCard label="Half Day" value={count("half_day")} color="#986f0b" />
                <KpiCard
                  label="Unmarked"
                  value={unmarkedCount}
                  color={unmarkedCount > 0 ? "#d83b01" : "var(--w11-text-tertiary)"}
                />
              </StatGrid>
            )}

            <DataPanel bodyClassName="p-0">
              {studentsLoading ? (
                <SkeletonTable rows={8} columns={4} />
              ) : existing.isError ? (
                <ErrorState
                  body="Failed to load the register for this date. Please try again."
                  onRetry={() => existing.refetch()}
                  size="sm"
                />
              ) : studentList.length === 0 ? (
                <EmptyState
                  size="sm"
                  title="No students found"
                  body="This class has no active students to mark."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">{t("Roll", "रोल")}</TableHead>
                      <TableHead>{t("Student Name", "नाम")}</TableHead>
                      <TableHead className="w-[340px]">{t("Status", "अवस्था")}</TableHead>
                      <TableHead className="w-56">{t("Remarks", "टिप्पणी")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentList.map((s: { id: string; roll_number?: number; first_name: string; last_name: string; student_id?: string }) => {
                      const status = records[s.id];
                      return (
                        <TableRow
                          key={s.id}
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
                              <p className="text-xs text-[color:var(--w11-text-secondary)]">{s.student_id}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {STATUS_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => setStatus(s.id, opt.value)}
                                  title={opt.label}
                                  className={`flex-1 py-1.5 rounded-[var(--w11-radius-md)] text-xs font-medium border transition-all ${
                                    status === opt.value
                                      ? "text-white shadow-sm scale-[1.02] border-transparent"
                                      : "border-[var(--w11-border-default)] text-[color:var(--w11-text-secondary)] hover:bg-[var(--w11-control-hover)]"
                                  }`}
                                  style={status === opt.value ? { background: opt.hex } : undefined}
                                >
                                  {opt.short}
                                </button>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={remarks[s.id] || ""}
                              onChange={(e) => {
                                setRemarks((prev) => ({ ...prev, [s.id]: e.target.value }));
                                setHasChanges(true);
                              }}
                              placeholder="Optional"
                              className="h-8 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </DataPanel>

            {/* Save bar */}
            {studentList.length > 0 && (
              <div
                className="win11-card sticky bottom-4 flex flex-wrap gap-3 justify-between items-center px-4 py-3 mt-4"
                style={{ boxShadow: "var(--w11-elevation-flyout)" }}
              >
                <div className="flex items-center gap-2 flex-wrap text-sm text-[color:var(--w11-text-secondary)]">
                  {STATUS_OPTIONS.map((opt) => (
                    <span key={opt.value} className={`win11-chip ${opt.chip}`}>
                      {opt.short}: {count(opt.value)}
                    </span>
                  ))}
                  {unmarkedCount > 0 && (
                    <span className="font-medium" style={{ color: "#d83b01" }}>
                      · {unmarkedCount} unmarked (saved as-is)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAll("present")}
                    disabled={!studentList.length}
                  >
                    <CheckCheck className="h-4 w-4 mr-1.5" /> {t("All Present", "सबै हाजिर")}
                  </Button>
                  <Button
                    onClick={() =>
                      confirm({
                        title: t("Save subject attendance?", "विषय उपस्थिति सेभ गर्ने?"),
                        body: t(`${marked.length} of ${studentList.length} students have a status. Unmarked students keep any previously saved status.`, `${marked.length}/${studentList.length} टिपिएको छ।`),
                        confirmLabel: t("Save", "सेभ"),
                      }).then((ok) => {
                        if (ok) saveMutation.mutate();
                      })
                    }
                    disabled={saveMutation.isPending || marked.length === 0 || !hasChanges}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {t("Save Attendance", "सुरक्षित")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </AOSPageBody>

      {/* ── Mark holiday dialog (A-33) ────────────────────────────────────── */}
      <MarkHolidayDialog
        open={holidayOpen}
        onOpenChange={setHolidayOpen}
        defaultClassId={classId}
      />
    </AOSPage>
  );
}
