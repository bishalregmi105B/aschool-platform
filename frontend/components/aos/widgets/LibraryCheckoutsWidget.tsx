"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, BookMarked } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { DataPanel, StatusChip, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { WidgetLink, WidgetError, type AOSWidgetProps } from "./shared";

interface BookIssue {
  id: string;
  book_title: string | null;
  student_name: string | null;
  issued_date: string | null;
  due_date: string | null;
  status: string;
  overdue_days: number;
}

interface LibraryStats {
  activeCount: number;
  overdueCount: number;
  recent: BookIssue[];
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * library-checkouts — circulation pulse from /library/issues: active checkout
 * count, overdue count (both from pagination totals of cheap filtered
 * queries) and the five most recent issues.
 */
export default function LibraryCheckoutsWidget({
  compact = false,
  onOpenRoute,
}: AOSWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["aos-widget", "library-checkouts"],
    queryFn: async (): Promise<LibraryStats> => {
      const activeRes = await api.get<ApiResponse<BookIssue[]>>("/library/issues", {
        params: { status: "issued", page: 1, per_page: compact ? 3 : 5 },
      });
      const overdueRes = await api.get<ApiResponse<BookIssue[]>>("/library/issues", {
        params: { status: "overdue", page: 1, per_page: 1 },
      });
      return {
        activeCount: activeRes.data?.meta?.pagination?.total ?? 0,
        overdueCount: overdueRes.data?.meta?.pagination?.total ?? 0,
        recent: activeRes.data?.data ?? [],
      };
    },
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <BookOpen className="h-4 w-4" style={{ color: "#107c10" }} />
          Library Checkouts
        </span>
      }
      actions={
        <WidgetLink
          href="/dashboard/library"
          onOpenRoute={onOpenRoute}
          className="text-[11px] hover:underline"
          style={{ color: "var(--w11-accent)" }}
        >
          Open library
        </WidgetLink>
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 flex-1" />
          </div>
          <SkeletonText lines={compact ? 2 : 4} />
        </div>
      ) : isError ? (
        <WidgetError
          title="Couldn't load library checkouts"
          body="The circulation counts are unavailable right now."
          onRetry={() => refetch()}
        />
      ) : !data || (data.activeCount === 0 && data.overdueCount === 0) ? (
        <AOSEmptyState
          icon={<BookMarked className="h-6 w-6" />}
          title="Nothing checked out"
          description="Active checkouts and overdue books appear here as students borrow."
          action={
            <WidgetLink
              href="/dashboard/library/checkout"
              onOpenRoute={onOpenRoute}
              className="win11-chip"
              style={{ color: "var(--w11-accent)" }}
            >
              Circulation desk
            </WidgetLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusChip status="active" label={`${data.activeCount} active`} />
            <StatusChip
              status={data.overdueCount > 0 ? "overdue" : "active"}
              label={`${data.overdueCount} overdue`}
            />
          </div>
          {data.recent.length > 0 && (
            <div className="flex flex-col gap-1">
              {data.recent.map((issue) => {
                const isOverdue = issue.status === "overdue" || issue.overdue_days > 0;
                return (
                  <div
                    key={issue.id}
                    className="flex items-center justify-between gap-3 py-0.5"
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-[12px]"
                      style={{ color: "var(--w11-text-primary)" }}
                      title={issue.book_title ?? undefined}
                    >
                      {issue.book_title ?? "Unknown title"}
                      {!compact && issue.student_name && (
                        <span style={{ color: "var(--w11-text-secondary)" }}>
                          {" "}
                          · {issue.student_name}
                        </span>
                      )}
                    </span>
                    <span
                      className="shrink-0 text-[11px] tabular-nums"
                      style={{ color: isOverdue ? "#c42b1c" : "var(--w11-text-secondary)" }}
                    >
                      {isOverdue ? `${issue.overdue_days}d over` : `due ${shortDate(issue.due_date)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {!compact && (
            <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              Latest issues · {data.activeCount} books currently out
            </p>
          )}
        </div>
      )}
    </DataPanel>
  );
}
