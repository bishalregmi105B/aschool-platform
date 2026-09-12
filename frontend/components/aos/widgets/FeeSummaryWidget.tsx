"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, Receipt } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { DataPanel, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { WidgetLink, WidgetError, type AOSWidgetProps } from "./shared";

interface FeeSummaryData {
  total_expected: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate: number;
  student_count: number;
}

/** SVG ring showing the collection rate (0-100). */
function RateRing({ rate, size = 88 }: { rate: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, rate));
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Collection rate ${clamped}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--w11-border-default)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--w11-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] font-bold leading-none" style={{ color: "var(--w11-accent)" }}>
          {clamped}%
        </span>
        <span className="text-[9px] font-semibold uppercase" style={{ color: "var(--w11-text-secondary)" }}>
          collected
        </span>
      </div>
    </div>
  );
}

function MoneyRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
        {label}
      </span>
      <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

/**
 * fee-summary — collection health from /fees/summary: collection rate ring,
 * expected vs collected, and the outstanding balance.
 */
export default function FeeSummaryWidget({ compact = false, onOpenRoute }: AOSWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["aos-widget", "fee-summary"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<FeeSummaryData>>("/fees/summary");
      return res.data.data;
    },
    retry: 1,
  });

  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <DollarSign className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
          Fee Collection
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
        <div className="flex items-center gap-4">
          <Skeleton className="h-[88px] w-[88px] shrink-0 rounded-full" />
          <div className="flex-1">
            <SkeletonText lines={3} />
          </div>
        </div>
      ) : isError ? (
        <WidgetError
          title="Couldn't load fee summary"
          body="The fee totals are unavailable right now."
          onRetry={() => refetch()}
        />
      ) : !data || data.total_expected === 0 ? (
        <AOSEmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="No fee records yet"
          description="Collection stats appear once fee structures are assigned to students."
          action={
            <WidgetLink
              href="/dashboard/fees"
              onOpenRoute={onOpenRoute}
              className="win11-chip"
              style={{ color: "var(--w11-accent)" }}
            >
              Set up fees
            </WidgetLink>
          }
        />
      ) : (
        <div className={compact ? "flex items-center gap-4" : "flex flex-col gap-3"}>
          <div className={compact ? "" : "flex items-center justify-between gap-4"}>
            <RateRing rate={data.collection_rate} size={compact ? 68 : 88} />
            {!compact && (
              <div className="flex-1 min-w-0">
                <MoneyRow label="Expected" value={data.total_expected} color="var(--w11-text-primary)" />
                <MoneyRow label="Collected" value={data.total_collected} color="var(--w11-accent)" />
                <MoneyRow label="Outstanding" value={data.total_outstanding} color="#c42b1c" />
              </div>
            )}
          </div>
          {compact ? (
            <div className="min-w-0 flex-1">
              <MoneyRow label="Collected" value={data.total_collected} color="var(--w11-accent)" />
              <MoneyRow label="Outstanding" value={data.total_outstanding} color="#c42b1c" />
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              {data.student_count} students billed · {data.collection_rate}% of expected collected to date
            </p>
          )}
        </div>
      )}
    </DataPanel>
  );
}
