"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  DollarSign,
  Calendar,
  Star,
  ArrowRight,
  ClipboardList,
  Settings,
} from "lucide-react";
import Link from "next/link";

export default function HRPage() {
  return (
    <PluginGate slug="hr">
      <HRContent />
    </PluginGate>
  );
}

function HRContent() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["hr-stats"],
    queryFn: async () => {
      const r = await api.get("/hr/stats");
      return r.data?.data || {};
    },
  });

  const s = data || {};

  // KPI Cards
  const kpis = [
    {
      label: "Total Staff",
      value: s.total_staff ?? "—",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Monthly Payroll",
      value: s.monthly_payroll
        ? `Rs. ${Math.round(s.monthly_payroll / 1000)}K`
        : "—",
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Pending Leaves",
      value: s.pending_leaves ?? "—",
      icon: Calendar,
      color: s.pending_leaves > 0 ? "text-amber-600" : "text-muted-foreground",
      bg: s.pending_leaves > 0 ? "bg-amber-50" : "bg-muted",
      alert: (s.pending_leaves ?? 0) > 0,
    },
    {
      label: "Pending Payroll",
      value: s.pending_payroll ?? "—",
      icon: ClipboardList,
      color: s.pending_payroll > 0 ? "text-red-600" : "text-muted-foreground",
      bg: s.pending_payroll > 0 ? "bg-red-50" : "bg-muted",
    },
  ];

  // Quick navigation links — displayed prominently
  const modules = [
    {
      title: "Payroll",
      desc: "Generate, approve and pay monthly salaries",
      href: "/dashboard/hr/payroll",
      icon: DollarSign,
      badge:
        (s.pending_payroll ?? 0) > 0 ? `${s.pending_payroll} pending` : null,
      badgeColor: "destructive" as const,
      primary: true,
    },
    {
      title: "Leave Management",
      desc: "Review and approve staff leave requests",
      href: "/dashboard/hr/leaves",
      icon: Calendar,
      badge: (s.pending_leaves ?? 0) > 0 ? `${s.pending_leaves} pending` : null,
      badgeColor: "warning" as const,
      primary: false,
    },
    {
      title: "Staff Attendance",
      desc: "Track daily staff presence and absences",
      href: "/dashboard/hr/staff-attendance",
      icon: ClipboardList,
      badge: null,
      badgeColor: "secondary" as const,
      primary: false,
    },
    {
      title: "Expenses",
      desc: "Manage school expense categories and records",
      href: "/dashboard/hr/expenses",
      icon: DollarSign,
      badge: null,
      badgeColor: "secondary" as const,
      primary: false,
    },
    {
      title: "Appraisal",
      desc: "Staff performance evaluation and feedback",
      href: "/dashboard/hr/appraisal",
      icon: Star,
      badge: null,
      badgeColor: "secondary" as const,
      primary: false,
    },
    {
      title: "Payroll Settings",
      desc: "Configure allowances, deductions and tax rates",
      href: "/dashboard/hr/payroll/settings",
      icon: Settings,
      badge: null,
      badgeColor: "secondary" as const,
      primary: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">HR & Payroll</h1>
        <p className="text-muted-foreground">
          Manage staff salaries, leaves, attendance, and performance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {k.label}
                  </p>
                  <p
                    className={`text-xl font-bold mt-1 ${k.color} ${isLoading ? "animate-pulse" : ""}`}
                  >
                    {isLoading ? "—" : k.value}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${k.bg}`}>
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts for pending items */}
      {((s.pending_leaves ?? 0) > 0 || (s.pending_payroll ?? 0) > 0) && (
        <div className="space-y-2">
          {(s.pending_leaves ?? 0) > 0 && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-amber-800">
                {s.pending_leaves} leave request
                {s.pending_leaves > 1 ? "s" : ""} waiting for approval
              </p>
              <Link href="/dashboard/hr/leaves">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs border-amber-300"
                >
                  Review <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          )}
          {(s.pending_payroll ?? 0) > 0 && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-red-800">
                {s.pending_payroll} payroll record
                {s.pending_payroll > 1 ? "s" : ""} need attention
              </p>
              <Link href="/dashboard/hr/payroll">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs border-red-300"
                >
                  Process <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Module Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card
              className={`hover:shadow-md transition-all cursor-pointer h-full ${
                m.primary ? "border-primary/30 bg-primary/5" : ""
              }`}
            >
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`p-2 rounded-lg ${
                      m.primary ? "bg-primary/10" : "bg-muted"
                    }`}
                  >
                    <m.icon
                      className={`h-5 w-5 ${m.primary ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </div>
                  {m.badge && (
                    <Badge
                      variant={
                        m.badgeColor === "destructive"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {m.badge}
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-sm">{m.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {m.desc}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
