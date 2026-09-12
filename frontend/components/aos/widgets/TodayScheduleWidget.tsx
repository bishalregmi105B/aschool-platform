"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Calendar, MapPin } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { displayBS } from "@/lib/nepali_date";
import { SkeletonList } from "@/components/ui/skeleton";
import { DataPanel, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { WidgetLink, WidgetError, type AOSWidgetProps } from "./shared";
import { useAnalyticsOverview } from "./KpiOverviewWidget";

interface TeacherDashboardData {
  stats?: {
    my_classes?: number;
    todays_periods?: number;
    pending_assignments?: number;
    recent_notices?: number;
  };
  schedule?: Array<{
    time: string;
    subject: string;
    class_name: string;
    room?: string | null;
  }>;
}

/**
 * today-schedule — teachers see their timetable periods for today
 * (/analytics/teacher-dashboard stats.schedule[]); admins instead see the
 * upcoming-events count from /analytics/overview (shared query key with the
 * KPI widget, so both render from a single request).
 */
export default function TodayScheduleWidget({ compact = false, onOpenRoute }: AOSWidgetProps) {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";

  const teacherQuery = useQuery({
    queryKey: ["aos-widget", "today-schedule", "teacher"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TeacherDashboardData>>(
        "/analytics/teacher-dashboard"
      );
      return res.data.data;
    },
    enabled: isTeacher,
    retry: 1,
  });

  // Admin variant reads the overview payload; teachers never need it (their
  // branch uses teacher-dashboard), so skip the request for them.
  const overviewQuery = useAnalyticsOverview(!isTeacher);

  const isLoading = isTeacher ? teacherQuery.isLoading : overviewQuery.isLoading;
  const isError = isTeacher ? teacherQuery.isError : overviewQuery.isError;
  const refetch = isTeacher ? teacherQuery.refetch : overviewQuery.refetch;

  const schedule = (teacherQuery.data?.schedule ?? []).slice(0, compact ? 3 : 6);
  const upcomingEvents = overviewQuery.data?.upcoming_events ?? 0;
  const attendanceToday = overviewQuery.data?.attendance_today_percent ?? 0;

  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
          {isTeacher ? "Today's Schedule" : "Today & Upcoming"}
        </span>
      }
      actions={
        <WidgetLink
          href={isTeacher ? "/dashboard/timetable" : "/dashboard/notices"}
          onOpenRoute={onOpenRoute}
          className="text-[11px] hover:underline"
          style={{ color: "var(--w11-accent)" }}
        >
          {isTeacher ? "Timetable" : "View notices"}
        </WidgetLink>
      }
    >
      {isLoading ? (
        <SkeletonList rows={compact ? 3 : 4} />
      ) : isError ? (
        <WidgetError
          title="Couldn't load today's schedule"
          body="The schedule data is unavailable right now."
          onRetry={() => refetch()}
        />
      ) : isTeacher ? (
        schedule.length === 0 ? (
          <AOSEmptyState
            icon={<CalendarDays className="h-6 w-6" />}
            title="No periods today"
            description="Your timetable has no slots assigned for today."
            action={
              <WidgetLink
                href="/dashboard/timetable"
                onOpenRoute={onOpenRoute}
                className="win11-chip"
                style={{ color: "var(--w11-accent)" }}
              >
                View timetable
              </WidgetLink>
            }
          />
        ) : (
          <div className="flex flex-col">
            {schedule.map((period, i) => (
              <div
                key={`${period.time}-${i}`}
                className="flex items-center gap-3 py-2 border-b border-[var(--w11-border-subtle)] last:border-0"
              >
                <span
                  className="text-[11px] font-medium tabular-nums w-[86px] shrink-0"
                  style={{ color: "var(--w11-text-secondary)" }}
                >
                  {period.time}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] font-medium truncate"
                    style={{ color: "var(--w11-text-primary)" }}
                  >
                    {period.subject}
                  </p>
                  <p
                    className="text-[11px] truncate flex items-center gap-1"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    {period.class_name}
                    {period.room && (
                      <>
                        <MapPin className="h-3 w-3 shrink-0" />
                        {period.room}
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full shrink-0"
              style={{ background: "var(--w11-accent-light)" }}
            >
              <Calendar className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />
            </div>
            <div>
              <p className="text-[24px] font-bold leading-none" style={{ color: "var(--w11-text-primary)" }}>
                {upcomingEvents}
              </p>
              <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                upcoming {upcomingEvents === 1 ? "event" : "events"} · {displayBS(new Date().toISOString())}
              </p>
            </div>
          </div>
          {!compact && (
            <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              {attendanceToday}% attendance across the school so far today.
            </p>
          )}
        </div>
      )}
    </DataPanel>
  );
}
