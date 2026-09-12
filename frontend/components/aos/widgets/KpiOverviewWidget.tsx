"use client";

import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  Users,
  DollarSign,
  ClipboardList,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { ThemedBarChart, ThemedLineChart } from "@/components/ui/charts";
import { SkeletonStat } from "@/components/ui/skeleton";
import { DataPanel, KpiCard, StatGrid, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { WidgetError, type AOSWidgetProps } from "./shared";

interface TrendPoint {
  [key: string]: string | number | null | undefined;
}

interface AnalyticsOverviewData {
  total_students: number;
  total_teachers: number;
  total_staff: number;
  fee_collection_this_month: number;
  attendance_today_percent: number;
  upcoming_events: number;
  pending_fee_amount: number;
  attendance_summary?: {
    best_class?: string | null;
    worst_class?: string | null;
    by_class?: Array<{ class_name: string; percentage: number }>;
  };
  fee_summary?: {
    by_month?: Array<{ month: string; collected: number; pending: number }>;
  };
  exam_summary?: {
    top_subject?: string | null;
    by_subject?: Array<{ subject: string; average: number }>;
  };
}

/** Shared overview fetch — other widgets (e.g. today-schedule) reuse the key. */
export const KPI_OVERVIEW_QUERY_KEY = ["aos-widget", "kpi-overview"] as const;

export function useAnalyticsOverview(enabled = true) {
  return useQuery({
    queryKey: KPI_OVERVIEW_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<ApiResponse<AnalyticsOverviewData>>("/analytics/overview");
      return res.data.data;
    },
    enabled,
    retry: 1,
  });
}

/**
 * kpi-overview — the school's headline numbers from /analytics/overview,
 * plus the overview payload's richer halves (fee trend, attendance by class,
 * subject averages) as real charts. Each chart hides itself when its series
 * is empty instead of showing a hollow frame.
 */
export default function KpiOverviewWidget({ compact = false }: AOSWidgetProps) {
  const { data, isLoading, isError, refetch } = useAnalyticsOverview();

  if (isLoading) {
    return (
      <StatGrid min={compact ? 140 : 150} className="mb-0">
        {Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </StatGrid>
    );
  }

  if (isError) {
    return (
      <DataPanel>
        <WidgetError
          title="Couldn't load the school overview"
          body="The KPI totals are unavailable right now. Try again in a moment."
          onRetry={() => refetch()}
        />
      </DataPanel>
    );
  }

  if (!data) {
    return (
      <DataPanel>
        <AOSEmptyState
          icon={<GraduationCap className="h-6 w-6" />}
          title="No overview data yet"
          description="School totals appear once students and classes are set up."
        />
      </DataPanel>
    );
  }

  // Compact (flyout) variant: the four numbers that matter, no charts.
  if (compact) {
    return (
      <StatGrid min={140} className="mb-0">
        <KpiCard
          label="Students"
          value={data.total_students}
          icon={<GraduationCap className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          color="var(--w11-accent)"
        />
        <KpiCard
          label="Teachers & Staff"
          value={data.total_teachers + data.total_staff}
          icon={<Users className="h-4 w-4" style={{ color: "#107c10" }} />}
          color="#107c10"
        />
        <KpiCard
          label="Fees (Month)"
          value={formatCurrency(data.fee_collection_this_month)}
          icon={<DollarSign className="h-4 w-4" style={{ color: "#d83b01" }} />}
          color="#d83b01"
        />
        <KpiCard
          label="Attendance"
          value={`${data.attendance_today_percent}%`}
          icon={<ClipboardList className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          color="var(--w11-accent)"
        />
      </StatGrid>
    );
  }

  const feeByMonth = data.fee_summary?.by_month ?? [];
  const attendanceByClass = data.attendance_summary?.by_class ?? [];
  const subjectAverages = data.exam_summary?.by_subject ?? [];

  return (
    <div className="flex flex-col gap-3">
      <StatGrid min={150} className="mb-0">
        <KpiCard
          label="Total Students"
          value={data.total_students}
          icon={<GraduationCap className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          color="var(--w11-accent)"
        />
        <KpiCard
          label="Teachers & Staff"
          value={data.total_teachers + data.total_staff}
          icon={<Users className="h-4 w-4" style={{ color: "#107c10" }} />}
          color="#107c10"
        />
        <KpiCard
          label="Fee Collection (Month)"
          value={formatCurrency(data.fee_collection_this_month)}
          icon={<DollarSign className="h-4 w-4" style={{ color: "#d83b01" }} />}
          color="#d83b01"
        />
        <KpiCard
          label="Attendance Today"
          value={`${data.attendance_today_percent}%`}
          icon={<ClipboardList className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          color="var(--w11-accent)"
        />
        <KpiCard
          label="Pending Fees"
          value={formatCurrency(data.pending_fee_amount)}
          icon={<TrendingUp className="h-4 w-4" style={{ color: "#c42b1c" }} />}
          color="#c42b1c"
        />
        <KpiCard
          label="Upcoming Events"
          value={data.upcoming_events}
          icon={<Calendar className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          color="var(--w11-accent)"
        />
      </StatGrid>

      {feeByMonth.length > 0 && (
        <DataPanel
          title="Fee Collection Trend"
          actions={
            <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              Collected vs pending, last months
            </span>
          }
          bodyClassName="px-2 pb-3 pt-0"
        >
          <ThemedLineChart
            data={feeByMonth as unknown as TrendPoint[]}
            xKey="month"
            lines={[
              { key: "collected", name: "Collected", ne: "संकलित" },
              { key: "pending", name: "Pending", ne: "बाँकी" },
            ]}
          />
        </DataPanel>
      )}

      {attendanceByClass.length > 0 && (
        <DataPanel
          title="Attendance by Class"
          actions={
            <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              Best: {data.attendance_summary?.best_class ?? "—"}
              {data.attendance_summary?.worst_class
                ? ` · Needs attention: ${data.attendance_summary.worst_class}`
                : ""}
            </span>
          }
          bodyClassName="px-2 pb-3 pt-0"
        >
          <ThemedBarChart
            data={attendanceByClass.map((c) => ({
              class_name: c.class_name,
              percentage: c.percentage,
            }))}
            xKey="class_name"
            bars={[{ key: "percentage", name: "Attendance %", ne: "उपस्थिति %" }]}
          />
        </DataPanel>
      )}

      {subjectAverages.length > 0 && (
        <DataPanel
          title="Subject Averages"
          actions={
            <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              Latest exam · avg score per subject
              {data.exam_summary?.top_subject ? ` · top: ${data.exam_summary.top_subject}` : ""}
            </span>
          }
          bodyClassName="px-2 pb-3 pt-0"
        >
          <ThemedBarChart
            data={subjectAverages.map((s) => ({ subject: s.subject, average: s.average }))}
            xKey="subject"
            bars={[{ key: "average", name: "Average score", ne: "औसत अंक" }]}
            height={240}
          />
        </DataPanel>
      )}
    </div>
  );
}
