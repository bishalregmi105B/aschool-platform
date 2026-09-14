"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/aos/kit/page-kit";

/**
 * MetricCard — KPI display with a trend indicator (plan Phase 4.7).
 *
 * "A number on screen is not design" — the trend answers the admin's real
 * question: is this good, and is it moving? Delta is a signed % (or absolute
 * string); direction drives color (up = success, down = danger) — invert for
 * metrics where lower is better (e.g. overdue amount) via `lowerIsBetter`.
 */
export function MetricCard({
  label,
  value,
  denominator,
  footnote,
  delta,
  lowerIsBetter = false,
  spark,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  denominator?: React.ReactNode;
  footnote?: React.ReactNode;
  /** Signed percent change (e.g. 12.5 → +12.5%) or a formatted string. */
  delta?: number | string;
  /** Set when a *decrease* is the good direction (absenteeism, overdue ₹). */
  lowerIsBetter?: boolean;
  /** Optional tiny inline sparkline node (svg or div) rendered under value. */
  spark?: React.ReactNode;
  className?: string;
}) {
  let trend: "up" | "down" | "flat" = "flat";
  let deltaText: string | null = null;
  if (typeof delta === "number") {
    trend = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";
    deltaText = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
  } else if (typeof delta === "string" && delta.trim()) {
    deltaText = delta.trim();
    trend = /^[+\-]/.test(deltaText) ? (deltaText.startsWith("+") ? "up" : "down") : "flat";
  }
  const good = trend === "flat" ? null : (trend === "up") !== lowerIsBetter;
  const color =
    good === null
      ? "var(--w11-text-secondary)"
      : good
      ? "var(--w11-success, #107c10)"
      : "var(--w11-danger, #c42b1c)";
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  return (
    <div className={cn("win11-card", className)} style={{ padding: 0, overflow: "hidden" }}>
      <KpiCard
        label={label}
        value={value}
        denominator={denominator}
        footnote={undefined}
      />
      <div className="px-4 pb-3" style={{ marginTop: -4 }}>
        {deltaText && (
          <span
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
            style={{ color }}
            aria-label={`Trend ${trend === "up" ? "up" : trend === "down" ? "down" : "flat"}: ${deltaText}`}
          >
            <Icon className="h-3 w-3" />
            {deltaText}
          </span>
        )}
        {spark && <div className="mt-1 h-6 opacity-80">{spark}</div>}
        {footnote && (
          <div className="text-[11px] mt-1" style={{ color: "var(--w11-text-secondary)" }}>
            {footnote}
          </div>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
