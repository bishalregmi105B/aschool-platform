"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ClipboardList } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Progress } from "@/components/ui/progress";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { DataPanel, StatusChip, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { WidgetLink, WidgetError, todayISO, type AOSWidgetProps } from "./shared";

interface ClassRow {
  id: string;
  name?: string;
}

interface ClassAttendanceSummary {
  total_students: number;
  present: number;
  absent: number;
  late: number;
  not_marked: number;
}

interface AttendanceTotals extends ClassAttendanceSummary {
  classes_covered: number;
}

/**
 * attendance-today — school-wide (or, for teachers, their class-teacher
 * classes) attendance for today, aggregated from GET /attendance/summary.
 *
 * /attendance/summary is per-class (class_id is required), so the widget
 * resolves the class list first — mirroring the attendance module's own
 * picker (/teacher/my-classes?scope=class_teacher for teachers,
 * /academics/classes otherwise) so the endpoint's teacher guard never 403s —
 * then fans out one summary per class and sums the counts. allSettled keeps
 * a single failing class from blanking the widget.
 */
export default function AttendanceTodayWidget({ compact = false, onOpenRoute }: AOSWidgetProps) {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["aos-widget", "attendance-today", isTeacher ? "teacher" : "school"],
    queryFn: async (): Promise<AttendanceTotals | null> => {
      const classRes = isTeacher
        ? await api.get<ApiResponse<ClassRow[]>>("/teacher/my-classes", {
            params: { scope: "class_teacher" },
          })
        : await api.get<ApiResponse<ClassRow[]>>("/academics/classes", {
            params: { per_page: 100 },
          });
      const classes = classRes.data?.data ?? [];
      if (classes.length === 0) return null;

      const results = await Promise.allSettled(
        classes.map((klass) =>
          api
            .get<ApiResponse<ClassAttendanceSummary>>("/attendance/summary", {
              params: { date: todayISO(), class_id: klass.id },
            })
            .then((r) => r.data.data)
        )
      );

      const totals: AttendanceTotals = {
        classes_covered: 0,
        total_students: 0,
        present: 0,
        absent: 0,
        late: 0,
        not_marked: 0,
      };
      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value) continue;
        totals.classes_covered += 1;
        totals.total_students += Number(result.value.total_students ?? 0);
        totals.present += Number(result.value.present ?? 0);
        totals.absent += Number(result.value.absent ?? 0);
        totals.late += Number(result.value.late ?? 0);
        totals.not_marked += Number(result.value.not_marked ?? 0);
      }
      return totals;
    },
    retry: 1,
  });

  const marked = data ? data.total_students - data.not_marked : 0;
  const markedPct = data && data.total_students > 0 ? Math.round((marked / data.total_students) * 100) : 0;
  // Uniform late rule: a late student DID attend (present + late).
  const attendancePct =
    data && data.total_students > 0
      ? Math.round(((data.present + data.late) / data.total_students) * 100)
      : 0;

  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
          Attendance Today
        </span>
      }
      actions={
        <WidgetLink
          href="/dashboard/attendance/mark"
          onOpenRoute={onOpenRoute}
          className="text-[11px] hover:underline"
          style={{ color: "var(--w11-accent)" }}
        >
          Mark
        </WidgetLink>
      }
    >
      {isLoading ? (
        compact ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 flex-1" />
            </div>
            <SkeletonText lines={2} />
          </div>
        )
      ) : isError ? (
        <WidgetError
          title="Couldn't load today's attendance"
          body="The attendance summary is unavailable right now."
          onRetry={() => refetch()}
        />
      ) : !data || data.total_students === 0 ? (
        <AOSEmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="Nothing to mark yet"
          description={
            isTeacher
              ? "You'll see attendance here for classes where you are the class teacher."
              : "Attendance appears once classes have students enrolled."
          }
          action={
            <WidgetLink
              href="/dashboard/attendance/mark"
              onOpenRoute={onOpenRoute}
              className="win11-chip"
              style={{ color: "var(--w11-accent)" }}
            >
              Open attendance
            </WidgetLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusChip status="present" label={`${data.present} present`} />
            <StatusChip status="absent" label={`${data.absent} absent`} />
            <StatusChip status="late" label={`${data.late} late`} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                Marked {marked} of {data.total_students} students
              </span>
              <span className="text-[11px] font-semibold" style={{ color: "var(--w11-accent)" }}>
                {attendancePct}% in attendance
              </span>
            </div>
            <Progress value={markedPct} aria-label="Attendance marked progress" />
          </div>
          {!compact && data.not_marked > 0 && (
            <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              {data.not_marked} students still unmarked across {data.classes_covered}{" "}
              {data.classes_covered === 1 ? "class" : "classes"}.
            </p>
          )}
        </div>
      )}
    </DataPanel>
  );
}
