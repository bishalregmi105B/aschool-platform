"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useInstalledPlugins } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DashboardData>>("/analytics/overview");
      return res.data.data;
    },
    retry: false,
  });

  if (isLoading) return <PageLoader />;

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
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Teachers & Staff",
      value: stats.total_teachers + stats.total_staff,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Fee Collection (Month)",
      value: formatCurrency(stats.fee_collection_this_month),
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Attendance Today",
      value: `${stats.attendance_today_percent}%`,
      icon: ClipboardList,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Pending Fees",
      value: formatCurrency(stats.pending_fee_amount),
      icon: TrendingUp,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Upcoming Events",
      value: stats.upcoming_events,
      icon: Calendar,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.full_name?.split(" ")[0] || "Admin"}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening at your school today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-full ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Plugins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {installedPlugins
                .filter((p) => p.active)
                .map((p) => (
                  <Badge key={p.plugin_slug} variant="secondary">
                    {p.plugin_slug.replace(/_/g, " ")}
                    {p.is_trial && (
                      <span className="ml-1 text-xs text-amber-600">(trial)</span>
                    )}
                  </Badge>
                ))}
              {installedPlugins.filter((p) => p.active).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No plugins installed yet.{" "}
                  <a href="/dashboard/marketplace" className="text-primary hover:underline">
                    Browse marketplace
                  </a>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Add Student", href: "/dashboard/students?action=add" },
                { label: "Mark Attendance", href: "/dashboard/attendance" },
                { label: "Create Notice", href: "/dashboard/notices?action=add" },
                { label: "Collect Fee", href: "/dashboard/fees" },
              ].map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className="flex items-center justify-center p-3 rounded-lg border hover:bg-muted transition-colors text-sm font-medium"
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
