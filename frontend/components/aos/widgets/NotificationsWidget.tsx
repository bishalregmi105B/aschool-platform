"use client";

import { useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import {
  fetchNotifications,
  formatTimeAgo,
  getCategoryIcon,
  type InAppNotification,
} from "@/lib/services/notifications.service";
import { SkeletonList } from "@/components/ui/skeleton";
import { DataPanel, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { WidgetLink, WidgetError, type AOSWidgetProps } from "./shared";

/**
 * notifications — the current user's latest in-app notifications
 * (lib/services/notifications.service). Unread items get an accent left
 * border and a subtle tint; rows with an action_url navigate there.
 */
export default function NotificationsWidget({ compact = false, onOpenRoute }: AOSWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["aos-widget", "notifications", compact ? 4 : 6],
    queryFn: () => fetchNotifications({ per_page: compact ? 4 : 6 }),
    retry: 1,
  });

  const notifications: InAppNotification[] = data ?? [];

  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <BellRing className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
          Notifications
        </span>
      }
      actions={
        <WidgetLink
          href="/dashboard/notifications"
          onOpenRoute={onOpenRoute}
          className="text-[11px] hover:underline"
          style={{ color: "var(--w11-accent)" }}
        >
          View all
        </WidgetLink>
      }
    >
      {isLoading ? (
        <SkeletonList rows={compact ? 4 : 6} />
      ) : isError ? (
        <WidgetError
          title="Couldn't load notifications"
          body="Your notifications are unavailable right now."
          onRetry={() => refetch()}
        />
      ) : notifications.length === 0 ? (
        <AOSEmptyState
          icon={<BellRing className="h-6 w-6" />}
          title="You're all caught up"
          description="New notifications will appear here as school activity happens."
        />
      ) : (
        <div className="flex flex-col">
          {notifications.map((notification) => {
            const body = (
              <>
                <span
                  className="flex items-center gap-1.5 text-[12px] font-medium truncate"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  <span aria-hidden="true">{getCategoryIcon(notification.category)}</span>
                  {notification.title}
                </span>
                {notification.body && (
                  <span
                    className="block text-[11px] truncate"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    {notification.body}
                  </span>
                )}
                <span className="text-[10px]" style={{ color: "var(--w11-text-tertiary)" }}>
                  {formatTimeAgo(notification.created_at)}
                </span>
              </>
            );

            const rowClass =
              "flex flex-col gap-0.5 py-2 px-2.5 -mx-2.5 border-b border-[var(--w11-border-subtle)] last:border-0";
            const unreadStyle: Record<string, string> = notification.is_read
              ? {}
              : {
                  borderLeft: "3px solid var(--w11-accent)",
                  background: "var(--w11-accent-light)",
                };

            return notification.action_url ? (
              <WidgetLink
                key={notification.id}
                href={notification.action_url}
                onOpenRoute={onOpenRoute}
                className={`${rowClass} transition-colors hover:bg-[color:var(--w11-control-hover)] rounded-[var(--w11-radius-sm)]`}
                style={unreadStyle}
              >
                {body}
              </WidgetLink>
            ) : (
              <div key={notification.id} className={rowClass} style={unreadStyle}>
                {body}
              </div>
            );
          })}
        </div>
      )}
    </DataPanel>
  );
}
