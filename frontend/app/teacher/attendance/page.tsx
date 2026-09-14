"use client";

/**
 * Teacher → Attendance (scoped, 8.23 / 44.1).
 *
 * This route used to be a one-line re-export of the ADMIN attendance hub —
 * school-wide classes, module quick links, holiday dialogs — inside a plain
 * teacher frame. Replaced with a teacher-only marker: pick one of MY
 * classes, mark the roster, save. Endpoints are the same proven admin ones
 * (roster: GET /attendance/students/<class_id> is already role-gated to
 * school_admin+teacher; write: POST /attendance/mark allows teacher and
 * the server restricts writes to the teacher's assigned classes).
 *
 * Research notes: the plan's "best-in-corpus keyboard flow" for marking is
 * one-glance statuses + whole-class quick actions (All Present) behind a
 * confirm; 44px targets because this is projector-and-one-hand usage.
 */

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, UserCheck, UserX, Clock, CircleDot, Plane } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { DataPanel } from "@/components/aos/kit/page-kit";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type MyClass = { id: string; name: string; short: string; student_count: number };

type RosterStudent = {
  id: string;
  student_id?: string | null;
  roll_no: number;
  name: string;
  photo_url?: string | null;
  section_id?: string | null;
};

type Status = "present" | "absent" | "late" | "half_day" | "leave";

const STATUSES: { value: Status; label: string; short: string; icon: typeof UserCheck; tone: string }[] = [
  { value: "present", label: "Present", short: "P", icon: UserCheck, tone: "var(--w11-success, #107c10)" },
  { value: "absent", label: "Absent", short: "A", icon: UserX, tone: "var(--w11-danger, #c42b1c)" },
  { value: "late", label: "Late", short: "L", icon: Clock, tone: "#eaa300" },
  { value: "half_day", label: "Half day", short: "H", icon: CircleDot, tone: "#8764b8" },
  { value: "leave", label: "Leave", short: "V", icon: Plane, tone: "var(--w11-accent)" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherAttendancePage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const params = useSearchParams();
  const [date, setDate] = useState(todayISO());
  const [classId, setClassId] = useState<string>(params.get("class_id") || "");
  const [records, setRecords] = useState<Record<string, Status>>({});

  const classes = useQuery({
    queryKey: ["teacher-my-classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<MyClass[]>>("/teacher/my-classes");
      return res.data.data || [];
    },
  });

  const selectedClass = classId || classes.data?.[0]?.id || "";
  const roster = useQuery({
    queryKey: ["teacher-attendance-roster", selectedClass],
    enabled: Boolean(selectedClass),
    queryFn: async () => {
      const res = await api.get<ApiResponse<RosterStudent[]>>(`/attendance/students/${selectedClass}`);
      return res.data.data || [];
    },
  });

  // Reset the working sheet when class/date changes (no stale cross-class rows).
  const contextKey = `${selectedClass}|${date}`;
  const [lastKey, setLastKey] = useState(contextKey);
  if (lastKey !== contextKey) {
    setLastKey(contextKey);
    setRecords({});
  }

  const students = roster.data || [];
  const marked = students.filter((s) => records[s.id]).length;
  const allSet = students.length > 0 && marked === students.length;

  const setStatus = useCallback(
    (studentId: string, status: Status) => {
      setRecords((prev) => ({ ...prev, [studentId]: status }));
    },
    [],
  );

  const quickSet = async (status: Status) => {
    const ok = await confirm({
      title: `Mark all ${students.length} students ${status.replace("_", " ")}?`,
      body: "This fills the sheet — adjust individual rows before saving if needed.",
      confirmLabel: "Fill sheet",
    });
    if (!ok) return;
    setRecords(Object.fromEntries(students.map((s) => [s.id, status])));
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        date,
        class_id: selectedClass,
        records: students.map((s) => ({
          student_id: s.id,
          section_id: s.section_id || undefined,
          status: records[s.id],
          date,
        })),
      };
      return (await api.post("/attendance/mark", payload)).data;
    },
    onSuccess: () => {
      toast.success("Attendance saved for today's class.");
      setRecords({});
      qc.invalidateQueries({ queryKey: ["teacher-dashboard"] });
      qc.invalidateQueries({ queryKey: ["teacher-my-classes"] });
      qc.invalidateQueries({ queryKey: ["teacher-attendance-roster"] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || "Couldn't save attendance.");
    },
  });

  const presentCount = useMemo(
    () => Object.values(records).filter((r) => r === "present" || r === "late").length,
    [records],
  );

  const emptyClasses = !classes.isLoading && (classes.data?.length ?? 0) === 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>Mark Attendance</h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          Only the classes assigned to you appear here.
        </p>
      </div>

      {classes.isError ? (
        <ErrorState title="Couldn't load your classes" onRetry={() => classes.refetch()} />
      ) : emptyClasses ? (
        <EmptyState
          icon={CalendarCheck}
          variant="dependency"
          title="No classes assigned yet"
          body="Attendance marking unlocks once the office assigns you a class (Academics → Class Teachers)."
        />
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--w11-text-secondary)" }}>
                Class
              </label>
              <AdvancedSelect
                value={selectedClass}
                onChange={(v) => setClassId(v)}
                placeholder="Select a class…"
                options={(classes.data || []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--w11-text-secondary)" }}>
                Date
              </label>
              <BSDateInput value={date} onChange={(v) => v && setDate(v)} emit="ad" />
            </div>
          </div>

          <DataPanel
            title={
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                {allSet ? (
                  <span style={{ color: "var(--w11-success, #107c10)" }}>{marked}/{students.length} marked · {presentCount} present</span>
                ) : (
                  <>{marked}/{students.length} marked</>
                )}
              </span>
            }
            actions={
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => quickSet("present")} disabled={!students.length}>
                  <UserCheck className="mr-1 h-3.5 w-3.5" /> All Present
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRecords({})} disabled={!marked}>
                  Clear
                </Button>
              </div>
            }
          >
            {roster.isLoading ? (
              <SkeletonList rows={6} />
            ) : roster.isError ? (
              <ErrorState title="Couldn't load the roster" onRetry={() => roster.refetch()} />
            ) : students.length === 0 ? (
              <EmptyState
                size="sm"
                title="No active students in this class"
                body="The class exists but has no active students yet — enrollment happens in Students."
              />
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--w11-border-subtle)" }}>
                {students.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                    <span className="w-8 shrink-0 text-xs tabular-nums" style={{ color: "var(--w11-text-secondary)" }}>
                      {s.roll_no || "—"}
                    </span>
                    <Avatar name={s.name} src={s.photo_url} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                      {s.name}
                    </span>
                    <div className="flex gap-1" role="group" aria-label={`Status for ${s.name}`}>
                      {STATUSES.map((st) => {
                        const active = records[s.id] === st.value;
                        return (
                          <button
                            key={st.value}
                            type="button"
                            title={st.label}
                            aria-pressed={active}
                            onClick={() => setStatus(s.id, st.value)}
                            className={cn(
                              "grid h-11 w-11 place-items-center rounded-lg border text-xs font-bold transition-colors",
                              active
                                ? "text-white"
                                : "hover:bg-[var(--w11-control-hover)]",
                            )}
                            style={
                              active
                                ? { background: st.tone, borderColor: st.tone }
                                : { borderColor: "var(--w11-border-default)", color: "var(--w11-text-secondary)" }
                            }
                          >
                            <span className="hidden sm:inline">{st.label}</span>
                            <span className="sm:hidden">{st.short}</span>
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>

          <div className="sticky bottom-3 flex justify-end">
            <Button
              className="h-11 px-6 shadow-lg"
              disabled={!allSet || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : `Save attendance${marked ? ` (${marked})` : ""}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
