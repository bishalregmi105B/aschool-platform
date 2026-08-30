"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Check, CheckCheck, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" id="notifications-title">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
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
        )}
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {NOTIFICATION_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
            id={`filter-${cat.key || "all"}`}
          >
            <span className="mr-1">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="py-12 text-center border-destructive/30">
          <Bell className="h-12 w-12 mx-auto mb-3 text-destructive/40" />
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={() => loadNotifications(activeCategory || undefined)}>
            Retry
          </Button>
        </Card>
      ) : notifications.length === 0 ? (
        <Card className="py-16 text-center">
          <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">No notifications in this category</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`p-4 transition-all hover:shadow-md ${
                !n.is_read
                  ? "border-l-4 border-l-primary bg-primary/[0.02]"
                  : "border-l-4 border-l-transparent"
              }`}
              id={`notification-${n.id}`}
            >
              <div className="flex items-start gap-3">
                {/* Category Icon */}
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">
                  {getCategoryIcon(n.category)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm ${!n.is_read ? "font-semibold" : ""}`}>
                      {n.title}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(n.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {n.body}
                  </p>

                  {/* Priority badge */}
                  {n.priority === "high" || n.priority === "urgent" ? (
                    <span className="inline-block mt-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-destructive/10 text-destructive">
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
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(n.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
