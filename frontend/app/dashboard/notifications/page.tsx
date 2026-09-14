"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { undoableDelete } from "@/components/ui/confirm-dialog";
import { useUrlFilters } from "@/components/ui/filter-bar";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  KpiCard,
  StatGrid,
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

/**
 * Notifications — A1 registry (plan 34-10: "list(A1 + category chips stay)").
 *
 * NN/g status-tracker guidance applied here: newest first, plain-language
 * titles, the read/unread distinction carried by a left accent border, and
 * destructive actions reversed by an undo toast instead of a blocking dialog.
 * Category selection lives in the URL (`?cat=`) so a filtered view survives
 * refresh and can be shared.
 */

const QUICK_LINKS = [
  { label: "Notification Matrix", icon: "ListOrdered", href: "/dashboard/notifications/matrix" },
  { label: "Notification Settings", icon: "Settings", href: "/dashboard/settings/notifications" },
  { label: "Communications", icon: "MessageSquare", href: "/dashboard/communications" },
  { label: "SMS", icon: "MessageSquare", href: "/dashboard/sms" },
];

export default function NotificationsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { values, setValues } = useUrlFilters(["cat"]);
  const activeCategory = values.cat ?? "";
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications", activeCategory],
    queryFn: async () => {
      const params: Record<string, unknown> = { per_page: 100 };
      if (activeCategory) params.category = activeCategory;
      const [list, count] = await Promise.all([
        fetchNotifications(params as Parameters<typeof fetchNotifications>[0]),
        fetchUnreadCount(),
      ]);
      return { list: list as InAppNotification[], count };
    },
    retry: 1,
  });

  const notifications = useMemo(
    () => (data?.list || []).filter((n) => !hiddenIds.has(n.id)),
    [data, hiddenIds]
  );
  const unreadCount = data?.count ?? 0;

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    [queryClient]
  );

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: refresh,
    onError: () => toast.error(t("Could not update notification", "सूचना अद्यावधिक गर्न सकिएन")),
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      refresh();
      toast.success(t("All notifications marked read", "सबै सूचना पढिएको चिन्ह लगाइयो"));
    },
    onError: () => toast.error(t("Could not mark all read", "सबै पढिएको लगाउन सकिएन")),
  });

  const remove = (n: InAppNotification) => {
    undoableDelete({
      label: t(`notification "${n.title}"`, `सूचना "${n.title}"`),
      optimistic: () => setHiddenIds((p) => new Set(p).add(n.id)),
      rollback: () =>
        setHiddenIds((p) => {
          const next = new Set(p);
          next.delete(n.id);
          return next;
        }),
      commit: async () => {
        await deleteNotification(n.id);
        refresh();
      },
    });
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Notifications", "सूचनाहरू")}
        subtitle={
          unreadCount > 0
            ? t(`${unreadCount} unread`, `${unreadCount} पढिएका छैनन्`)
            : t("All caught up!", "सबै पढिसकियो!")
        }
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll.mutate()}
              className="gap-2"
              id="mark-all-read-btn"
            >
              <CheckCheck className="h-4 w-4" />
              {t("Mark All Read", "सबै पढिएको")}
            </Button>
          ) : undefined
        }
      />
      <AOSPageBody>
        <div className="max-w-4xl mx-auto space-y-4">
          <StatGrid>
            <KpiCard
              label={t("Unread", "पढिएका")}
              value={unreadCount}
              icon={<Bell className="h-4 w-4" style={{ color: unreadCount > 0 ? "#d83b01" : "var(--w11-text-secondary)" }} />}
              color={unreadCount > 0 ? "#d83b01" : "var(--w11-accent)"}
            />
            <KpiCard
              label={t("High Priority", "उच्च प्राथमिकता")}
              value={notifications.filter((n) => n.priority === "high" || n.priority === "urgent").length}
              icon={<Bell className="h-4 w-4" style={{ color: "#c42b1c" }} />}
              color="#c42b1c"
            />
            <KpiCard
              label={t("Showing", "देखिएका")}
              value={notifications.length}
              icon={<ListOrdered className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
              color="var(--w11-text-primary)"
            />
          </StatGrid>

          <QuickLinks section="Communication" links={QUICK_LINKS} />

          <FilterCommandBar>
            {NOTIFICATION_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setValues({ cat: cat.key })}
                className={`win11-chip ${activeCategory === cat.key ? "accent" : ""}`}
                id={`filter-${cat.key || "all"}`}
                style={{ cursor: "pointer" }}
              >
                <span className="mr-1">{cat.icon}</span>
                {t(cat.label, cat.label)}
                {cat.key === "" && unreadCount > 0 && (
                  <span className="ml-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4"
                    style={{ background: "var(--w11-accent)", color: "#fff" }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </FilterCommandBar>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <DataPanel>
              <ErrorState
                title={t("Notifications could not be loaded", "सूचनाहरू लोड गर्न सकिएन")}
                onRetry={() => refetch()}
              />
            </DataPanel>
          ) : notifications.length === 0 ? (
            <DataPanel>
              <EmptyState
                icon={Bell}
                title={
                  activeCategory
                    ? t("No notifications in this category", "यस श्रेणीमा सूचना छैन")
                    : t("No notifications yet", "अझै सूचना छैन")
                }
                body={t(
                  "Events like attendance marking, fee payments, and new notices will appear here.",
                  "उपस्थिति, शुल्क भुक्तानी, नयाँ सूचना जस्ता घटनाहरू यहाँ देखिन्छन्।"
                )}
                action={
                  activeCategory
                    ? { label: t("Show all", "सबै हेर्नुहोस्"), onClick: () => setValues({ cat: "" }) }
                    : undefined
                }
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
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{ background: "var(--w11-control-hover)" }}
                      aria-hidden
                    >
                      {getCategoryIcon(n.category)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm ${!n.is_read ? "font-semibold" : ""}`} style={{ color: "var(--w11-text-primary)" }}>
                          {n.title}
                        </p>
                        <span className="text-xs whitespace-nowrap text-[color:var(--w11-text-secondary)]">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-sm mt-1 line-clamp-2 text-[color:var(--w11-text-secondary)]">
                        {n.body}
                      </p>
                      {n.priority === "high" || n.priority === "urgent" ? (
                        <span className="win11-chip error mt-2 text-[10px] font-bold uppercase">
                          {n.priority}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!n.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => markRead.mutate(n.id)}
                          aria-label={t("Mark as read", "पढिएको चिन्ह")}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#c42b1c]"
                        onClick={() => remove(n)}
                        aria-label={t("Delete", "मेटाउनुहोस्")}
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
