"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Pin } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { displayBS } from "@/lib/nepali_date";
import { SkeletonList } from "@/components/ui/skeleton";
import { DataPanel, StatusChip, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { WidgetLink, WidgetError, type AOSWidgetProps } from "./shared";

interface NoticeItem {
  id: string;
  title: string;
  notice_type?: string | null;
  is_pinned?: boolean;
  author_name?: string | null;
  created_at?: string | null;
}

/**
 * recent-notices — the latest school notices (GET /notices, pinned first —
 * the API orders is_pinned desc, created_at desc). Each row jumps to the
 * notices module; urgent notices carry a chip.
 */
export default function RecentNoticesWidget({ compact = false, onOpenRoute }: AOSWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["aos-widget", "recent-notices"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<NoticeItem[]>>("/notices", {
        params: { per_page: compact ? 4 : 5 },
      });
      return res.data.data ?? [];
    },
    retry: 1,
  });

  const notices = data ?? [];

  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <Bell className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
          Recent Notices
        </span>
      }
      actions={
        <WidgetLink
          href="/dashboard/notices"
          onOpenRoute={onOpenRoute}
          className="text-[11px] hover:underline"
          style={{ color: "var(--w11-accent)" }}
        >
          View all
        </WidgetLink>
      }
    >
      {isLoading ? (
        <SkeletonList rows={compact ? 4 : 5} />
      ) : isError ? (
        <WidgetError
          title="Couldn't load notices"
          body="The notices list is unavailable right now."
          onRetry={() => refetch()}
        />
      ) : notices.length === 0 ? (
        <AOSEmptyState
          icon={<Bell className="h-6 w-6" />}
          title="No notices yet"
          description="School announcements will show up here."
          action={
            <WidgetLink
              href="/dashboard/notices?action=add"
              onOpenRoute={onOpenRoute}
              className="win11-chip"
              style={{ color: "var(--w11-accent)" }}
            >
              Create notice
            </WidgetLink>
          }
        />
      ) : (
        <div className="flex flex-col">
          {notices.map((notice) => (
            <WidgetLink
              key={notice.id}
              href="/dashboard/notices"
              onOpenRoute={onOpenRoute}
              className="flex items-start gap-2.5 py-2 border-b border-[var(--w11-border-subtle)] last:border-0 transition-colors hover:bg-[color:var(--w11-control-hover)] rounded-[var(--w11-radius-sm)]"
            >
              {notice.is_pinned ? (
                <Pin
                  className="h-3.5 w-3.5 mt-0.5 shrink-0 fill-current"
                  style={{ color: "var(--w11-accent)" }}
                />
              ) : (
                <span
                  className="h-1.5 w-1.5 mt-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--w11-border-strong)" }}
                />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[12px] font-medium truncate"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  {notice.title}
                </span>
                <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                  {displayBS(notice.created_at)}
                  {notice.author_name ? ` · ${notice.author_name}` : ""}
                </span>
              </span>
              {notice.notice_type === "urgent" && <StatusChip status="overdue" label="Urgent" />}
            </WidgetLink>
          ))}
        </div>
      )}
    </DataPanel>
  );
}
