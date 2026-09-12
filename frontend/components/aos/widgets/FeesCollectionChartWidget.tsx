"use client";

import { DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DataPanel, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { ThemedLineChart } from "@/components/ui/charts";
import { useAnalyticsOverview } from "./KpiOverviewWidget";
import { WidgetLink, WidgetError, type AOSWidgetProps } from "./shared";

interface MonthPoint {
  month: string;
  collected: number;
  pending: number;
  expected?: number;
}

/**
 * fees-collection-chart — monthly fee collections over the last 6 months
 * (line chart of collected vs pending) from /analytics/overview
 * fee_summary.by_month. Shares the kpi-overview query cache so the two
 * widgets cost one request together.
 */
export default function FeesCollectionChartWidget({
  compact = false,
  onOpenRoute,
}: AOSWidgetProps) {
  const { data, isLoading, isError, refetch } = useAnalyticsOverview();
  const byMonth: MonthPoint[] = data?.fee_summary?.by_month ?? [];

  const totalCollected = byMonth.reduce((sum, m) => sum + (Number(m.collected) || 0), 0);
  const totalExpected = byMonth.reduce((sum, m) => sum + (Number(m.expected) || 0), 0);
  const rate =
    totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
  const thisMonth = byMonth.length > 0 ? byMonth[byMonth.length - 1] : null;

  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <DollarSign className="h-4 w-4" style={{ color: "#d83b01" }} />
          Fee Collections
        </span>
      }
      actions={
        <WidgetLink
          href="/dashboard/fees"
          onOpenRoute={onOpenRoute}
          className="text-[11px] hover:underline"
          style={{ color: "var(--w11-accent)" }}
        >
          View fees
        </WidgetLink>
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
          <Skeleton className="h-[180px] w-full" />
        </div>
      ) : isError ? (
        <WidgetError
          title="Couldn't load fee collections"
          body="The monthly collection trend is unavailable right now."
          onRetry={() => refetch()}
        />
      ) : byMonth.length === 0 ? (
        <AOSEmptyState
          icon={<DollarSign className="h-6 w-6" />}
          title="No collections yet"
          description="The monthly trend appears once fee payments are recorded."
          action={
            <WidgetLink
              href="/dashboard/fees"
              onOpenRoute={onOpenRoute}
              className="win11-chip"
              style={{ color: "var(--w11-accent)" }}
            >
              Open fees
            </WidgetLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              This month:{" "}
              <span className="font-semibold tabular-nums" style={{ color: "var(--w11-text-primary)" }}>
                {formatCurrency(thisMonth?.collected ?? 0)}
              </span>
            </span>
            <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              6-month:{" "}
              <span className="font-semibold tabular-nums" style={{ color: "var(--w11-accent)" }}>
                {formatCurrency(totalCollected)}
              </span>
              {" · "}
              {rate}% of expected
            </span>
          </div>
          <div style={{ width: "100%" }}>
            <ThemedLineChart
              data={byMonth as unknown as Array<Record<string, unknown>>}
              xKey="month"
              lines={[
                { key: "collected", name: "Collected", ne: "संकलित" },
                { key: "pending", name: "Pending", ne: "बाँकी" },
              ]}
              height={compact ? 150 : 190}
            />
          </div>
          {!compact && (
            <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              <TrendingUp className="h-3 w-3 shrink-0" style={{ color: "var(--w11-accent)" }} />
              Collected vs pending amounts, last 6 months
            </p>
          )}
        </div>
      )}
    </DataPanel>
  );
}
