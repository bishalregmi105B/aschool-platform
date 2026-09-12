"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, type ApiResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useInstalledPlugins, getPluginDisplayName } from "@/lib/plugins";
import { SkeletonStat } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { WidgetSlot } from "@/components/plugin-widgets/PluginWidgetHost";
import { ThemedBarChart, ThemedLineChart } from "@/components/ui/charts";
import { formatCurrency } from "@/lib/utils";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatGrid,
  KpiCard,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import {
  GraduationCap,
  Users,
  DollarSign,
  ClipboardList,
  TrendingUp,
  Calendar,
  LayoutDashboard,
  RefreshCw,
  UserCog,
  BookOpen,
  Bell,
  Receipt,
} from "lucide-react";

interface TrendPoint {
  [key: string]: string | number | null | undefined;
}

interface DashboardData {
  total_students: number;
  total_teachers: number;
  total_staff: number;
  fee_collection_this_month: number;
  attendance_today_percent: number;
  upcoming_events: number;
  pending_fee_amount: number;
  active_plugins: number;
  attendance_summary?: {
    average_percentage?: number;
    best_class?: string | null;
    worst_class?: string | null;
    by_class?: Array<{ class_name: string; percentage: number }>;
  };
  fee_summary?: {
    by_month?: Array<{ month: string; collected: number; pending: number }>;
    by_fee_type?: Array<{ type: string; amount: number; percentage: number }>;
  };
  exam_summary?: {
    top_subject?: string | null;
    by_subject?: Array<{ subject: string; average: number }>;
  };
}

/** Quick-launch tiles — jump straight into the core modules. */
const QUICK_LAUNCH = [
  { label: "Students", href: "/dashboard/students", icon: GraduationCap },
  { label: "Teachers", href: "/dashboard/teachers", icon: UserCog },
  { label: "Attendance", href: "/dashboard/attendance/mark", icon: ClipboardList },
  { label: "Fees", href: "/dashboard/fees/collect", icon: Receipt },
  { label: "Notices", href: "/dashboard/notices?action=add", icon: Bell },
  { label: "Academics", href: "/dashboard/academics", icon: BookOpen },
];

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

  const activePlugins = installedPlugins.filter((p) => p.active);

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<LayoutDashboard className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={`Welcome back, ${user?.full_name?.split(" ")[0] || "Admin"}`}
        subtitle="Here's what's happening at your school today."
        actions={
          <button
            type="button"
            className="win11-chip"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </button>
        }
      />
      <AOSPageBody>
        {/* Platform KPIs — skeletons keep the grid from jumping when data lands. */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonStat key={i} />
            ))}
          </div>
        ) : isError ? (
          <DataPanel className="mb-4">
            <ErrorState
              title="Couldn't load the school overview"
              body="The dashboard totals are unavailable right now. Plugin cards below may still work."
              onRetry={() => refetch()}
            />
          </DataPanel>
        ) : (
          <StatGrid min={150}>
            <KpiCard
              label="Total Students"
              value={stats.total_students}
              icon={<GraduationCap className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
              color="var(--w11-accent)"
            />
            <KpiCard
              label="Teachers & Staff"
              value={stats.total_teachers + stats.total_staff}
              icon={<Users className="h-4 w-4" style={{ color: "#107c10" }} />}
              color="#107c10"
            />
            <KpiCard
              label="Fee Collection (Month)"
              value={formatCurrency(stats.fee_collection_this_month)}
              icon={<DollarSign className="h-4 w-4" style={{ color: "#d83b01" }} />}
              color="#d83b01"
            />
            <KpiCard
              label="Attendance Today"
              value={`${stats.attendance_today_percent}%`}
              icon={<ClipboardList className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
              color="var(--w11-accent)"
            />
            <KpiCard
              label="Pending Fees"
              value={formatCurrency(stats.pending_fee_amount)}
              icon={<TrendingUp className="h-4 w-4" style={{ color: "#c42b1c" }} />}
              color="#c42b1c"
            />
            <KpiCard
              label="Upcoming Events"
              value={stats.upcoming_events}
              icon={<Calendar className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
              color="var(--w11-accent)"
            />
          </StatGrid>
        )}

        {/* Trends — real charts over the overview payload's richer halves
            (attendance by class, fee monthly trend, subject averages). Each
            panel hides itself when its series is empty instead of showing a
            hollow frame. */}
        {!isLoading && !isError && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 mb-4">
            {(data?.fee_summary?.by_month?.length ?? 0) > 0 && (
              <DataPanel
                title="Fee Collection Trend"
                actions={
                  <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                    Collected vs pending, last months
                  </span>
                }
                bodyClassName="px-2 pb-3 pt-0"
              >
                <ThemedLineChart
                  data={(data?.fee_summary?.by_month ?? []) as unknown as TrendPoint[]}
                  xKey="month"
                  lines={[
                    { key: "collected", name: "Collected", ne: "संकलित" },
                    { key: "pending", name: "Pending", ne: "बाँकी" },
                  ]}
                />
              </DataPanel>
            )}
            {(data?.attendance_summary?.by_class?.length ?? 0) > 0 && (
              <DataPanel
                title="Attendance by Class"
                actions={
                  <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                    Best: {data?.attendance_summary?.best_class ?? "—"}
                    {data?.attendance_summary?.worst_class ? ` · Needs attention: ${data.attendance_summary.worst_class}` : ""}
                  </span>
                }
                bodyClassName="px-2 pb-3 pt-0"
              >
                <ThemedBarChart
                  data={(data?.attendance_summary?.by_class ?? []).map((c) => ({
                    class_name: c.class_name,
                    percentage: c.percentage,
                  }))}
                  xKey="class_name"
                  bars={[{ key: "percentage", name: "Attendance %", ne: "उपस्थिति %" }]}
                />
              </DataPanel>
            )}
            {(data?.exam_summary?.by_subject?.length ?? 0) > 0 && (
              <DataPanel
                title="Subject Averages"
                className="lg:col-span-2"
                actions={
                  <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                    Latest exam · avg score per subject
                    {data?.exam_summary?.top_subject ? ` · top: ${data.exam_summary.top_subject}` : ""}
                  </span>
                }
                bodyClassName="px-2 pb-3 pt-0"
              >
                <ThemedBarChart
                  data={(data?.exam_summary?.by_subject ?? []).map((s) => ({
                    subject: s.subject,
                    average: s.average,
                  }))}
                  xKey="subject"
                  bars={[{ key: "average", name: "Average score", ne: "औसत अंक" }]}
                  height={240}
                />
              </DataPanel>
            )}
          </div>
        )}

        {/* Quick launch — one-click jumps into the core modules. */}
        <DataPanel title="Quick Launch" className="mb-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {QUICK_LAUNCH.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-2 rounded-[var(--w11-radius-md)] border border-[color:var(--w11-border-subtle)] p-3 text-center text-[12px] font-medium transition-colors hover:border-[color:var(--w11-accent)] hover:bg-[color:var(--w11-accent-light)]"
                style={{ color: "var(--w11-text-primary)" }}
              >
                <item.icon className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />
                {item.label}
              </Link>
            ))}
          </div>
        </DataPanel>

        {/* Plugin-contributed quick actions; falls back to the core four. */}
        <DataPanel title="Quick Actions" className="mb-4">
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
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center justify-center rounded-[var(--w11-radius-md)] border border-[color:var(--w11-border-default)] p-2.5 text-center text-[12px] font-medium transition-colors hover:bg-[color:var(--w11-accent-light)] hover:border-[color:var(--w11-accent)]"
                    style={{ color: "var(--w11-text-primary)" }}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            }
          />
        </DataPanel>

        {/* Every installed plugin's dashboard widgets, server-ordered. */}
        <WidgetSlot id="dashboard.main" />
        <WidgetSlot id="dashboard.wide" />
        <WidgetSlot id="dashboard.side" />

        <DataPanel title="Active Plugins">
          <div className="flex flex-wrap gap-1.5">
            {activePlugins.map((p) => (
              <StatusChip
                key={p.plugin_slug}
                status="user"
                label={
                  <>
                    {getPluginDisplayName(p.plugin_slug)}
                    {p.is_trial && (
                      <span className="ml-1 text-[10px]" style={{ color: "#d83b01" }}>(trial)</span>
                    )}
                  </>
                }
              />
            ))}
            {activePlugins.length === 0 && (
              <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                No plugins installed yet.{" "}
                <Link
                  href="/dashboard/marketplace"
                  className="hover:underline"
                  style={{ color: "var(--w11-accent)" }}
                >
                  Browse marketplace
                </Link>
              </p>
            )}
          </div>
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
