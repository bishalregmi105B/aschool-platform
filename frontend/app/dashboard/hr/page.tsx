"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";
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
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["hr-stats"],
    queryFn: async () => {
      const r = await api.get("/hr/stats");
      return r.data?.data || {};
    },
    retry: 1,
  });

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="HR & Payroll" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>
                Failed to load HR dashboard. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const s = data || {};

  // KPI values — straight from /hr/stats, never invented.
  const kpis = [
    {
      label: "Total Staff",
      value: s.total_staff ?? "—",
      icon: <Users className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
      color: "var(--w11-accent)",
    },
    {
      label: "Monthly Payroll",
      value: s.monthly_payroll
        ? `Rs. ${Math.round(s.monthly_payroll / 1000)}K`
        : "—",
      icon: <DollarSign className="h-4 w-4" style={{ color: "#107c10" }} />,
      color: "#107c10",
    },
    {
      label: "Pending Leaves",
      value: s.pending_leaves ?? "—",
      icon: (
        <Calendar
          className="h-4 w-4"
          style={{ color: (s.pending_leaves ?? 0) > 0 ? "#d83b01" : "var(--w11-text-tertiary)" }}
        />
      ),
      color: (s.pending_leaves ?? 0) > 0 ? "#d83b01" : "var(--w11-text-secondary)",
    },
    {
      label: "Pending Payroll",
      value: s.pending_payroll ?? "—",
      icon: (
        <ClipboardList
          className="h-4 w-4"
          style={{ color: (s.pending_payroll ?? 0) > 0 ? "#c42b1c" : "var(--w11-text-tertiary)" }}
        />
      ),
      color: (s.pending_payroll ?? 0) > 0 ? "#c42b1c" : "var(--w11-text-secondary)",
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
      badgeTone: (s.pending_payroll ?? 0) > 0 ? "error" : "subtle",
      primary: true,
    },
    {
      title: "Leave Management",
      desc: "Review and approve staff leave requests",
      href: "/dashboard/hr/leaves",
      icon: Calendar,
      badge: (s.pending_leaves ?? 0) > 0 ? `${s.pending_leaves} pending` : null,
      badgeTone: "warning",
      primary: false,
    },
    {
      title: "Staff Attendance",
      desc: "Track daily staff presence and absences",
      href: "/dashboard/hr/staff-attendance",
      icon: ClipboardList,
      badge: null,
      badgeTone: "subtle",
      primary: false,
    },
    {
      title: "Expenses",
      desc: "Manage school expense categories and records",
      href: "/dashboard/hr/expenses",
      icon: DollarSign,
      badge: null,
      badgeTone: "subtle",
      primary: false,
    },
    {
      title: "Appraisal",
      desc: "Staff performance evaluation and feedback",
      href: "/dashboard/hr/appraisal",
      icon: Star,
      badge: null,
      badgeTone: "subtle",
      primary: false,
    },
    {
      title: "Payroll Settings",
      desc: "Configure allowances, deductions and tax rates",
      href: "/dashboard/hr/payroll/settings",
      icon: Settings,
      badge: null,
      badgeTone: "subtle",
      primary: false,
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="HR & Payroll"
        subtitle={
          isLoading
            ? "Manage staff salaries, leaves, attendance, and performance"
            : `${s.total_staff ?? 0} staff · ${s.pending_leaves ?? 0} pending leaves · ${s.pending_payroll ?? 0} pending payroll`
        }
        actions={
          <Link href="/dashboard/hr/payroll">
            <Button>
              <DollarSign className="h-4 w-4 mr-2" /> Open Payroll
            </Button>
          </Link>
        }
      />
      <AOSPageBody>
        {/* KPI cards */}
        <StatGrid min={180}>
          {kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={isLoading ? "—" : k.value}
              color={k.color}
              icon={k.icon}
              className={isLoading ? "animate-pulse" : undefined}
            />
          ))}
        </StatGrid>

        {/* Alerts for pending items */}
        {((s.pending_leaves ?? 0) > 0 || (s.pending_payroll ?? 0) > 0) && (
          <div className="space-y-2 mb-4">
            {(s.pending_leaves ?? 0) > 0 && (
              <div
                className="win11-infobar warning flex items-center justify-between gap-3"
                role="status"
              >
                <p className="text-sm font-medium">
                  {s.pending_leaves} leave request
                  {s.pending_leaves > 1 ? "s" : ""} waiting for approval
                </p>
                <Link href="/dashboard/hr/leaves">
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                    Review <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
            {(s.pending_payroll ?? 0) > 0 && (
              <div
                className="win11-infobar error flex items-center justify-between gap-3"
                role="status"
              >
                <p className="text-sm font-medium">
                  {s.pending_payroll} payroll record
                  {s.pending_payroll > 1 ? "s" : ""} need attention
                </p>
                <Link href="/dashboard/hr/payroll">
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                    Process <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Module navigation grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="block h-full">
              <div
                className={`win11-card h-full transition-all hover:-translate-y-0.5 ${m.primary ? "border-[var(--w11-accent)]" : ""}`}
                style={{ cursor: "pointer" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      background: m.primary
                        ? "var(--w11-accent-light)"
                        : "var(--w11-control-hover)",
                    }}
                  >
                    <m.icon
                      className="h-5 w-5"
                      style={{
                        color: m.primary
                          ? "var(--w11-accent)"
                          : "var(--w11-text-secondary)",
                      }}
                    />
                  </div>
                  {m.badge && (
                    <span className={`win11-chip ${m.badgeTone} text-xs`}>
                      {m.badge}
                    </span>
                  )}
                </div>
                <h3
                  className="font-semibold text-sm"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  {m.title}
                </h3>
                <p
                  className="text-xs mt-1 leading-relaxed"
                  style={{ color: "var(--w11-text-secondary)" }}
                >
                  {m.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
