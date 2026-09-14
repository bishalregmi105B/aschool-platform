"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatusTimeline — the progression pattern every approval/money flow needs
 * (fees: draft→verified→paid; admissions: applied→shortlisted→admitted;
 * leave: submitted→approved). Vertical on narrow windows, compact horizontal
 * on wide ones. Steps without a timestamp still read clearly.
 */
export interface TimelineStep {
  label: string;
  /** ISO string or display text; optional. */
  at?: string | null;
  /** Extra context line (who, amount, note). */
  detail?: string;
}

export function StatusTimeline({
  steps,
  currentIndex,
  orientation = "vertical",
  className,
}: {
  steps: TimelineStep[];
  /** Index of the active/last-completed step. */
  currentIndex: number;
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  const done = (i: number) => i < currentIndex;
  const active = (i: number) => i === currentIndex;

  return (
    <ol
      className={cn(
        "flex gap-0",
        orientation === "vertical" ? "flex-col" : "flex-row items-start w-full",
        className
      )}
    >
      {steps.map((s, i) => {
        const isDone = done(i);
        const isActive = active(i);
        const dotColor = isDone
          ? "var(--w11-success, #107c10)"
          : isActive
          ? "var(--w11-accent)"
          : "var(--w11-text-disabled, rgba(0,0,0,0.25))";
        return (
          <li
            key={`${s.label}-${i}`}
            className={cn(
              "relative",
              orientation === "vertical" ? "flex gap-3 pb-4 last:pb-0" : "flex-1 flex flex-col items-center text-center"
            )}
          >
            {/* connector */}
            {orientation === "vertical" ? (
              i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[11px] top-6 bottom-0 w-px"
                  style={{ background: "var(--w11-border-subtle, rgba(0,0,0,0.08))" }}
                />
              )
            ) : (
              i > 0 && (
                <span
                  aria-hidden
                  className="absolute left-[-50%] right-[50%] top-[11px] h-px"
                  style={{ background: "var(--w11-border-subtle, rgba(0,0,0,0.08))" }}
                />
              )
            )}
            <span
              className={cn(
                "relative z-[1] flex h-6 w-6 items-center justify-center rounded-full text-white shrink-0",
                orientation === "horizontal" && "mb-1.5"
              )}
              style={{ background: dotColor }}
              aria-hidden
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : <span className="text-[11px] font-semibold">{i + 1}</span>}
            </span>
            <div className="min-w-0">
              <p
                className="text-[12px] font-semibold leading-tight"
                style={{
                  color: isDone || isActive ? "var(--w11-text-primary)" : "var(--w11-text-tertiary)",
                }}
              >
                {s.label}
              </p>
              {s.at && (
                <p className="text-[11px]" style={{ color: "var(--w11-text-tertiary)" }}>
                  {s.at}
                </p>
              )}
              {s.detail && (
                <p className="text-[11px] truncate" style={{ color: "var(--w11-text-secondary)" }}>
                  {s.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default StatusTimeline;
