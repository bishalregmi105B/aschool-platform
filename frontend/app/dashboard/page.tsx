"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useInstalledPlugins } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
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

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load dashboard. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">
          Welcome back, {user?.full_name?.split(" ")[0] || "Admin"}
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Here&apos;s what&apos;s happening at your school today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground leading-tight truncate">{card.title}</p>
                  <p className="text-xl font-bold mt-0.5">{card.value}</p>
                </div>
                <div className={`p-2 rounded-lg shrink-0 ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[13px] font-semibold">Active Plugins</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-1.5">
              {installedPlugins
                .filter((p) => p.active)
                .map((p) => (
                  <Badge key={p.plugin_slug} variant="secondary" className="text-[11px] py-0.5">
                    {p.plugin_slug.replace(/_/g, " ")}
                    {p.is_trial && (
                      <span className="ml-1 text-[10px] text-amber-600">(trial)</span>
                    )}
                  </Badge>
                ))}
              {installedPlugins.filter((p) => p.active).length === 0 && (
                <p className="text-[12px] text-muted-foreground">
                  No plugins installed yet.{" "}
                  <a href="/dashboard/marketplace" className="text-primary hover:underline">
                    Browse marketplace
                  </a>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[13px] font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Add Student", href: "/dashboard/students?action=add" },
                { label: "Mark Attendance", href: "/dashboard/attendance" },
                { label: "Create Notice", href: "/dashboard/notices?action=add" },
                { label: "Collect Fee", href: "/dashboard/fees" },
              ].map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className="flex items-center justify-center p-2.5 rounded border hover:bg-accent transition-colors text-[12px] font-medium text-center"
                >
                  {action.label}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
