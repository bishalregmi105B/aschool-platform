import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton — the loading state for content whose shape we already know.
 *
 * Full-page spinners are banned in this codebase: they tell the user "wait"
 * without telling them what for, and they make a 200 ms fetch feel like a
 * failure. A skeleton keeps the layout stable so nothing jumps when data lands.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** Text lines of decreasing width, the way real paragraphs look. */
function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["w-full", "w-11/12", "w-9/12", "w-10/12", "w-8/12"];
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", widths[i % widths.length])} />
      ))}
    </div>
  );
}

/** A stat card's shape: label, big number, sublabel. */
function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2 rounded-lg border p-3.5", className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}

/**
 * A table's shape. `columns` should match the real table's count so the
 * header row does not resize when data arrives.
 */
function SkeletonTable({
  rows = 6,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)} role="status" aria-label="Loading">
      <div className="flex gap-3 border-b px-3 py-2">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b px-3 py-2.5">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("h-3 flex-1", c === 0 && "max-w-[180px]")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A list panel's shape: avatar/icon, two text lines, trailing meta. */
function SkeletonList({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("divide-y", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
          <Skeleton className="h-3 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonStat, SkeletonTable, SkeletonList };
