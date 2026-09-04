"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useInstalledPlugins, getPluginDisplayName } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonStat } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { WidgetSlot } from "@/components/plugin-widgets/PluginWidgetHost";
import { formatCurrency } from "@/lib/utils";
import {
  GraduationCap,
  Users,
  DollarSign,
  ClipboardList,
  TrendingUp,
  Calendar,
} from "lucide-react";

interface DashboardData {
  total_students: number;
  total_teachers: number;
  total_staff: number;
  fee_collection_this_month: number;
  attendance_today_percent: number;
  upcoming_events: number;
  pending_fee_amount: number;
  active_plugins: number;
}

/**
 * The school dashboard.
 *
 * Two layers, deliberately:
 *   1. Six platform KPIs from /analytics/overview — core data, ungated, always
 *      present, so a school with zero paid plugins still opens to something real.
 *   2. Plugin widget slots. Every installed plugin's `widgets.yaml` entries for
 *      `dashboard.actions` / `.main` / `.wide` / `.side` render themselves; the
 *      page has no idea which plugins exist. Uninstall a plugin and its cards
 *      vanish with no change here.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const { installedPlugins } = useInstalledPlugins();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DashboardData>>("/analytics/overview");
      return res.data.data;
    },
    retry: 1,
  });

  const stats = data || {
    total_students: 0,
    total_teachers: 0,
    total_staff: 0,
    fee_collection_this_month: 0,
    attendance_today_percent: 0,
    upcoming_events: 0,
    pending_fee_amount: 0,
    active_plugins: installedPlugins.length,
  };

  const cards = [
    {
      title: "Total Students",
      value: stats.total_students,
      icon: GraduationCap,
      color: "text-ocean dark:text-mint",
      bg: "bg-ocean/10 dark:bg-mint/20",
    },
    {
      title: "Teachers & Staff",
      value: stats.total_teachers + stats.total_staff,
      icon: Users,
      color: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      title: "Fee Collection (Month)",
      value: formatCurrency(stats.fee_collection_this_month),
      icon: DollarSign,
      color: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
    {
      title: "Attendance Today",
      value: `${stats.attendance_today_percent}%`,
      icon: ClipboardList,
      color: "text-ocean dark:text-mint",
      bg: "bg-mint/30 dark:bg-mint/20",
    },
    {
      title: "Pending Fees",
      value: formatCurrency(stats.pending_fee_amount),
      icon: TrendingUp,
      color: "text-red-700 dark:text-red-300",
      bg: "bg-red-50 dark:bg-red-950/40",
    },
    {
      title: "Upcoming Events",
      value: stats.upcoming_events,
      icon: Calendar,
      color: "text-ocean-light dark:text-mint",
      bg: "bg-ocean/10 dark:bg-mint/15",
    },
  ];

  const activePlugins = installedPlugins.filter((p) => p.active);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Welcome back, ${user?.full_name?.split(" ")[0] || "Admin"}`}
        description="Here's what's happening at your school today."
      />

      {/* Platform KPIs — skeletons keep the grid from jumping when data lands. */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <SkeletonStat key={c.title} />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-0">
            <ErrorState
              title="Couldn't load the school overview"
              body="The dashboard totals are unavailable right now. Plugin cards below may still work."
              onRetry={() => refetch()}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((card) => (
            <Card key={card.title} className="shadow-sm">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] leading-tight text-muted-foreground">
                      {card.title}
                    </p>
                    <p className="mt-0.5 text-xl font-bold">{card.value}</p>
                  </div>
                  <div className={`shrink-0 rounded-lg p-2 ${card.bg}`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Plugin-contributed quick actions; falls back to the core four. */}
      <Card className="shadow-sm">
        <CardHeader className="px-4 pb-2 pt-3">
          <CardTitle className="text-[13px] font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <WidgetSlot
            id="dashboard.actions"
            grid={false}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            fallback={
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Add Student", href: "/dashboard/students?action=add" },
                  { label: "Mark Attendance", href: "/dashboard/attendance/mark" },
                  { label: "Create Notice", href: "/dashboard/notices?action=add" },
                  { label: "Collect Fee", href: "/dashboard/fees/collect" },
                ].map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className="flex items-center justify-center rounded border p-2.5 text-center text-[12px] font-medium transition-colors hover:bg-accent"
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Every installed plugin's dashboard widgets, server-ordered. */}
      <WidgetSlot id="dashboard.main" />
      <WidgetSlot id="dashboard.wide" />
      <WidgetSlot id="dashboard.side" />

      <Card className="shadow-sm">
        <CardHeader className="px-4 pb-2 pt-3">
          <CardTitle className="text-[13px] font-semibold">Active Plugins</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {activePlugins.map((p) => (
              <Badge
                key={p.plugin_slug}
                variant="secondary"
                className="py-0.5 text-[11px]"
              >
                {getPluginDisplayName(p.plugin_slug)}
                {p.is_trial && (
                  <span className="ml-1 text-[10px] text-amber-600">(trial)</span>
                )}
              </Badge>
            ))}
            {activePlugins.length === 0 && (
              <p className="text-[12px] text-muted-foreground">
                No plugins installed yet.{" "}
                <a
                  href="/dashboard/marketplace"
                  className="text-primary hover:underline"
                >
                  Browse marketplace
                </a>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
