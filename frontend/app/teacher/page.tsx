"use client";

/**
 * Teacher → Today (A7-tailored, 44.1).
 *
 * The focal point is the period timeline ("what am I teaching RIGHT NOW"),
 * not KPI wallpaper. Data: GET /teacher/dashboard (today_classes, stats,
 * recent_notices) + GET /teacher/my-classes — both teacher-scoped server-side.
 *
 * Research notes: dashboard-first screens work when the top card answers
 * "what now" (task-first M1/A7 grammar in the plan); KPIs are supporting
 * readouts, zero-data honesty (never fake counters) per Part 19.3.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api, type ApiResponse } from "@/lib/api";
import { displayBS } from "@/lib/nepali_date";
import {
  CalendarDays,
  ClipboardCheck,
  BookOpen,
  Users,
  Bell,
  Clock,
} from "lucide-react";
import Link from "next/link";
import {
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { ErrorState } from "@/components/ui/empty-state";

type Slot = {
  id?: string;
  period?: string;
  period_number?: number;
  subject?: string;
  class_name?: string;
  section_name?: string;
  time?: string;
  is_break?: boolean;
  attendance_marked?: boolean;
};

type SubmissionToGrade = {
  submission_id: string;
  assignment_id: string;
  assignment_title: string;
  student_id: string;
  student_name: string;
  submitted_at?: string | null;
  is_late?: boolean;
};

type TeacherDashboard = {
  today_classes: Slot[];
  stats: { classes_today?: number; pending_attendance?: number; pending_assignments?: number; submissions_to_grade?: number };
  submissions_to_grade?: SubmissionToGrade[];
  recent_notices: { id: string; title: string; date?: string | null }[];
};

type MyClass = {
  id: string;
  name: string;
  short: string;
  student_count: number;
  attendance_marked: boolean;
};

function slotMinutes(time?: string): [number, number] | null {
  // Backend renders "HH:MM - HH:MM"; return [start, end] in minutes.
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec((time || "").trim());
  if (!m) return null;
  return [
    Number(m[1]) * 60 + Number(m[2]),
    Number(m[3]) * 60 + Number(m[4]),
  ];
}

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const dash = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TeacherDashboard>>("/teacher/dashboard");
      return res.data.data;
    },
  });
  const classes = useQuery({
    queryKey: ["teacher-my-classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<MyClass[]>>("/teacher/my-classes");
      return res.data.data || [];
    },
  });

  if (dash.isLoading) return <AOSModuleLoadingState label="Loading your day…" />;
  if (dash.isError) return <ErrorState title="Couldn't load your day" onRetry={() => dash.refetch()} />;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const slots = dash.data?.today_classes || [];
  const stats = dash.data?.stats || {};
  const notices = dash.data?.recent_notices || [];
  const myClasses = classes.data || [];

  return (
    <div className="space-y-4">
      {/* Header: where am I + BS date signature */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
            Good day, {user?.full_name?.split(" ")[0] || "Teacher"} 👋
          </h1>
          <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
            Here&apos;s your day at a glance
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: "var(--w11-subtle,rgba(0,0,0,0.05))", color: "var(--w11-text-secondary)" }}
        >
          {displayBS(now.toISOString().slice(0, 10))}
        </span>
      </div>

      <StatGrid min={170}>
        <KpiCard label="Periods Today" value={String(stats.classes_today ?? slots.length)} icon={<CalendarDays className="h-5 w-5" />} />
        <Link href="/teacher/attendance" className="block">
          <KpiCard label="Attendance Pending" value={String(stats.pending_attendance ?? 0)} icon={<ClipboardCheck className="h-5 w-5" />} />
        </Link>
        <Link href="/teacher/assignments" className="block">
          <KpiCard label="My Assignments" value={String(stats.pending_assignments ?? 0)} icon={<BookOpen className="h-5 w-5" />} />
        </Link>
        <KpiCard label="My Classes" value={String(myClasses.length)} icon={<Users className="h-5 w-5" />} />
      </StatGrid>

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4 items-start">
        {/* FOCAL: today's period timeline */}
        <DataPanel
          title={
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4" /> Today&apos;s Periods
            </span>
          }
          actions={
            slots.length > 0 ? (
              <Link href="/teacher/timetable" className="text-xs font-medium text-[var(--w11-accent)] hover:underline">
                Full week →
              </Link>
            ) : undefined
          }
        >
          {slots.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>
              No periods scheduled today. If this is unexpected, ask the office to publish the timetable.
            </div>
          ) : (
            <ol className="divide-y" style={{ borderColor: "var(--w11-border-subtle)" }}>
              {slots.map((s, i) => {
                const range = slotMinutes(s.time);
                const live = range ? nowMin >= range[0] && nowMin < range[1] : false;
                const done = range ? nowMin >= range[1] : false;
                return (
                  <li key={s.id || i} className="flex items-center gap-3 py-3">
                    <span
                      className="w-12 shrink-0 text-xs font-semibold tabular-nums"
                      style={{ color: live ? "var(--w11-accent)" : "var(--w11-text-secondary)" }}
                    >
                      P{s.period || s.period_number || i + 1}
                    </span>
                    <span className="w-28 shrink-0 text-xs tabular-nums" style={{ color: "var(--w11-text-secondary)" }}>
                      {s.time || "—"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-medium ${s.is_break ? "italic" : ""}`}
                        style={{ color: "var(--w11-text-primary)" }}
                      >
                        {s.subject || (s.is_break ? "Break" : "—")}
                      </span>
                      <span className="block text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                        {s.class_name}
                        {s.section_name ? ` · ${s.section_name}` : ""}
                      </span>
                    </span>
                    {live && (
                      <span
                        className="hidden rounded-full px-2 py-0.5 text-[10px] font-bold uppercase sm:block"
                        style={{ background: "var(--w11-accent)", color: "var(--w11-accent-text)" }}
                      >
                        Now
                      </span>
                    )}
                    {!s.is_break &&
                      (s.attendance_marked ? (
                        <StatusChip status="present" label="Marked" />
                      ) : done ? null : (
                        <Link
                          href="/teacher/attendance"
                          className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold min-h-[32px] inline-flex items-center"
                          style={{ borderColor: "var(--w11-accent)", color: "var(--w11-accent)" }}
                        >
                          Mark
                        </Link>
                      ))}
                  </li>
                );
              })}
            </ol>
          )}
        </DataPanel>

        <div className="space-y-4">
          {/* Inline action queue: grading lives where the teacher already is */}
          <DataPanel
            title={
              <span className="inline-flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" /> To Grade
                {(dash.data?.submissions_to_grade?.length ?? 0) > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: "var(--w11-accent)", color: "var(--w11-accent-text)" }}
                  >
                    {dash.data!.submissions_to_grade!.length}
                  </span>
                )}
              </span>
            }
            actions={
              (dash.data?.submissions_to_grade?.length ?? 0) > 0 ? (
                <Link href="/teacher/assignments" className="text-xs font-medium text-[var(--w11-accent)] hover:underline">
                  Grade all →
                </Link>
              ) : undefined
            }
          >
            {(dash.data?.submissions_to_grade?.length ?? 0) === 0 ? (
              <div className="px-2 py-6 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                Nothing waiting — you&apos;re all caught up. ✅
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--w11-border-subtle)" }}>
                {dash.data!.submissions_to_grade!.slice(0, 5).map((sub) => (
                  <li key={sub.submission_id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                        {sub.student_name}
                      </span>
                      <span className="block truncate text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                        {sub.assignment_title}
                        {sub.is_late ? " · late" : ""}
                        {sub.submitted_at ? ` · ${displayBS(sub.submitted_at.slice(0, 10))}` : ""}
                      </span>
                    </span>
                    <Link
                      href={`/teacher/assignments?assignment_id=${encodeURIComponent(sub.assignment_id)}`}
                      className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold min-h-[32px] inline-flex items-center shrink-0"
                      style={{ borderColor: "var(--w11-accent)", color: "var(--w11-accent)" }}
                    >
                      Grade
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>

          <DataPanel
            title={
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" /> My Classes
              </span>
            }
          >
            {myClasses.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                You have no classes assigned yet. The office assigns classes under Academics → Class Teachers.
              </div>
            ) : (
              <ul className="space-y-2">
                {myClasses.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/teacher/attendance?class_id=${encodeURIComponent(c.id)}`}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-[var(--w11-control-hover)] min-h-[44px]"
                      style={{ borderColor: "var(--w11-border-default)" }}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold"
                        style={{ background: "var(--w11-subtle,rgba(0,0,0,0.05))", color: "var(--w11-text-primary)" }}
                      >
                        {c.short}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>{c.name}</span>
                        <span className="block text-xs" style={{ color: "var(--w11-text-secondary)" }}>{c.student_count} students</span>
                      </span>
                      {c.attendance_marked ? (
                        <StatusChip status="present" label="Marked" />
                      ) : (
                        <StatusChip status="pending" label="To mark" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>

          <DataPanel
            title={
              <span className="inline-flex items-center gap-2">
                <Bell className="h-4 w-4" /> Recent Notices
              </span>
            }
            actions={
              <Link href="/teacher/notices" className="text-xs font-medium text-[var(--w11-accent)] hover:underline">
                All →
              </Link>
            }
          >
            {notices.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>No recent notices.</div>
            ) : (
              <ul className="space-y-1">
                {notices.slice(0, 5).map((n) => (
                  <li key={n.id} className="border-b py-2 last:border-0" style={{ borderColor: "var(--w11-border-subtle)" }}>
                    <p className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>{n.title}</p>
                    <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                      {n.date ? displayBS(n.date) : "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>
        </div>
      </div>
    </div>
  );
}
