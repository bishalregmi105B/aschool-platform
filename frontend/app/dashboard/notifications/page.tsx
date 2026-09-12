"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  formatTimeAgo,
  getCategoryIcon,
  NOTIFICATION_CATEGORIES,
  type InAppNotification,
} from "@/lib/services/notifications.service";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeCategory, setActiveCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (category?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { per_page: 100 };
      if (category) params.category = category;
      const data = await fetchNotifications(params as Parameters<typeof fetchNotifications>[0]);
      setNotifications(data);
      const count = await fetchUnreadCount();
      setUnreadCount(count);
    } catch {
      // Show an explicit error state — never render an empty list as if
      // the user simply has no notifications.
      setError("Could not load notifications. Please try again.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications(activeCategory || undefined);
  }, [activeCategory, loadNotifications]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (id: string) => {
    const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  return (
    <AOSPage>
      {/* Header */}
      <AOSPageHeader
        icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
            : "All caught up!"
        }
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="gap-2"
              id="mark-all-read-btn"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </Button>
          ) : undefined
        }
      />
      <AOSPageBody>
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Category Filters */}
          <FilterCommandBar>
            {NOTIFICATION_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`win11-chip ${activeCategory === cat.key ? "accent" : ""}`}
                id={`filter-${cat.key || "all"}`}
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </FilterCommandBar>

          {/* Notification List */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="win11-card p-4 animate-pulse" style={{ marginBottom: 0 }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg" style={{ background: "var(--w11-control-hover)" }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 rounded w-2/3" style={{ background: "var(--w11-control-hover)" }} />
                      <div className="h-3 rounded w-full" style={{ background: "var(--w11-control-hover)" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <DataPanel>
              <div className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="mb-4" style={{ color: "#c42b1c" }}>{error}</p>
                <Button variant="outline" size="sm" onClick={() => loadNotifications(activeCategory || undefined)}>
                  Retry
                </Button>
              </div>
            </DataPanel>
          ) : notifications.length === 0 ? (
            <DataPanel>
              <AOSEmptyState
                icon={<Bell className="h-12 w-12" />}
                title="No notifications in this category"
              />
            </DataPanel>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="win11-card p-4"
                  style={{
                    marginBottom: 0,
                    borderLeft: `4px solid ${!n.is_read ? "var(--w11-accent)" : "transparent"}`,
                  }}
                  id={`notification-${n.id}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{ background: "var(--w11-control-hover)" }}
                    >
                      {getCategoryIcon(n.category)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm ${!n.is_read ? "font-semibold" : ""}`}>
                          {n.title}
                        </p>
                        <span className="text-xs whitespace-nowrap text-[color:var(--w11-text-secondary)]">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-sm mt-1 line-clamp-2 text-[color:var(--w11-text-secondary)]">
                        {n.body}
                      </p>

                      {/* Priority badge */}
                      {n.priority === "high" || n.priority === "urgent" ? (
                        <span className="win11-chip error mt-2 text-[10px] font-bold uppercase">
                          {n.priority}
                        </span>
                      ) : null}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!n.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleMarkRead(n.id)}
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#c42b1c]"
                        onClick={() => handleDelete(n.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
