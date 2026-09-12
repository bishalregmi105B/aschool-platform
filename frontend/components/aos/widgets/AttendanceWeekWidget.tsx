"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, ClipboardCheck } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { DataPanel, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { ThemedBarChart } from "@/components/ui/charts";
import { WidgetLink, WidgetError, type AOSWidgetProps } from "./shared";

interface DayPoint {
  date: string;
  label: string;
  rate: number | null;
  present: number;
  late: number;
  marked: number;
}

/** YYYY-MM-DD for `daysAgo` days before today. */
function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * attendance-week — daily school attendance rate for the last 7 days.
 *
 * There is no weekly endpoint, so the widget reuses /attendance/list: for each
 * day it reads the pagination `total` of three cheap count queries (all rows,
 * present, late) with per_page=1 — the uniform late rule (late students DID
 * attend) matches every other attendance surface. Teachers automatically see
 * only their own classes (the endpoint's teacher guard).
 */
export default function AttendanceWeekWidget({
  compact = false,
  onOpenRoute,
}: AOSWidgetProps) {
  // Recomputed cheaply per render; the query key depends only on the dates.
  const days = lastSevenDays();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["aos-widget", "attendance-week", days[0].date, days[days.length - 1].date],
    queryFn: async (): Promise<DayPoint[]> => {
      const countFor = async (date: string, status?: string) => {
        const res = await api.get<ApiResponse<unknown>>("/attendance/list", {
          params: { date, per_page: 1, ...(status ? { status } : {}) },
        });
        return res.data?.meta?.pagination?.total ?? 0;
      };

      const perDay = await Promise.all(
        days.map(async (day) => {
          // Three independent counts per day; a failed day drops out (null
          // rate) instead of blanking the whole chart.
          const [marked, present, late] = await Promise.all([
            countFor(day.date).catch(() => null),
            countFor(day.date, "present").catch(() => null),
            countFor(day.date, "late").catch(() => null),
          ]);
          if (marked === null || present === null || late === null || marked === 0) {
            return { ...day, rate: null as number | null, present: 0, late: 0, marked: marked ?? 0 };
          }
          const rate = Math.round(((present + late) / marked) * 100);
          return { ...day, rate, present, late, marked };
        })
      );
      return perDay;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const chartDays = (data ?? []).filter((d) => d.rate !== null);
  const avg =
    chartDays.length > 0
      ? Math.round(chartDays.reduce((sum, d) => sum + (d.rate ?? 0), 0) / chartDays.length)
      : 0;

  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <BarChart3 className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
          Attendance This Week
        </span>
      }
      actions={
        <WidgetLink
          href="/dashboard/attendance"
          onOpenRoute={onOpenRoute}
          className="text-[11px] hover:underline"
          style={{ color: "var(--w11-accent)" }}
        >
          Open
        </WidgetLink>
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-[170px] w-full" />
        </div>
      ) : isError ? (
        <WidgetError
          title="Couldn't load the weekly attendance"
          body="The attendance counts are unavailable right now."
          onRetry={() => refetch()}
        />
      ) : chartDays.length === 0 ? (
        <AOSEmptyState
          icon={<ClipboardCheck className="h-6 w-6" />}
          title="No attendance recorded"
          description="Daily rates appear once attendance has been marked this week."
          action={
            <WidgetLink
              href="/dashboard/attendance/mark"
              onOpenRoute={onOpenRoute}
              className="win11-chip"
              style={{ color: "var(--w11-accent)" }}
            >
              Mark attendance
            </WidgetLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              Last {chartDays.length} marked {chartDays.length === 1 ? "day" : "days"}
            </span>
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--w11-accent)" }}>
              {avg}% avg
            </span>
          </div>
          <div style={{ width: "100%" }}>
            <ThemedBarChart
              data={chartDays.map((d) => ({ day: d.label, rate: d.rate ?? 0 }))}
              xKey="day"
              bars={[{ key: "rate", name: "Attendance %", ne: "उपस्थिति %" }]}
              height={compact ? 140 : 180}
            />
          </div>
          {!compact && (
            <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              Share of marked students present (late counts as present), per day
            </p>
          )}
        </div>
      )}
    </DataPanel>
  );
}

/** Day list for the last 7 days (labels like "Mon 8"). */
function lastSevenDays(): DayPoint[] {
  const today = new Date();
  const days: DayPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({
      date: isoDaysAgo(i),
      label: `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()}`,
      rate: null,
      present: 0,
      late: 0,
      marked: 0,
    });
  }
  return days;
}
