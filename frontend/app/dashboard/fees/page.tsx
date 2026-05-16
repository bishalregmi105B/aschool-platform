"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Receipt,
  Users,
  Calendar,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { displayBS } from "@/lib/nepali_date";

// ── Types ──────────────────────────────────────────────────────────────────
interface FeesSummary {
  total_expected: number;
  total_collected: number;
  total_outstanding: number;
  total_overdue: number;
  collection_rate: number;
  student_count: number;
  paid_count: number;
  pending_count: number;
  overdue_count: number;
  this_month_collected: number;
  recent_payments: Array<{
    id: string;
    student_name: string;
    fee_type: string;
    amount: number;
    paid_at: string;
    receipt_number: string;
  }>;
  by_class: Array<{
    class_name: string;
    collected: number;
    expected: number;
    rate: number;
  }>;
}

export default function FeesPage() {
  return <FeeOverviewContent />;
}

function FeeOverviewContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["fees-overview"],
    queryFn: async () => {
      const res = await api.get("/fees/summary");
      return res.data?.data as FeesSummary | null;
    },
  });

  const s = data;
  const collectionRate = s?.collection_rate ?? 0;

  // Quick actions for the most common tasks
  const quickActions = [
    {
      label: "Collect Fee",
      desc: "Record student payment",
      href: "/dashboard/fees/collect",
      icon: DollarSign,
      color: "bg-primary text-primary-foreground",
    },
    {
      label: "View Defaulters",
      desc: "Students with overdue fees",
      href: "/dashboard/fees/defaulters",
      icon: AlertTriangle,
      color: "bg-red-50 text-red-700 border border-red-200",
    },
    {
      label: "Fee Structure",
      desc: "Manage fee types & amounts",
      href: "/dashboard/fees/structure",
      icon: CreditCard,
      color: "bg-muted text-foreground border",
    },
    {
      label: "Fee Reports",
      desc: "Collection analytics",
      href: "/dashboard/fees/reports",
      icon: TrendingUp,
      color: "bg-muted text-foreground border",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Fee Management</h1>
        <p className="text-muted-foreground">
          Overview of fee collection status for your school
        </p>
      </div>

      {/* Quick Actions — most important at top for easy access */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((a) => (
          <Link key={a.label} href={a.href}>
            <button
              className={`w-full h-full text-left rounded-xl p-4 flex items-start gap-3 transition-shadow hover:shadow-md ${a.color}`}
            >
              <a.icon className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm leading-tight">{a.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{a.desc}</p>
              </div>
            </button>
          </Link>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Collected",
            value: `Rs. ${((s?.total_collected ?? 0) / 1000).toFixed(0)}K`,
            icon: CheckCircle2,
            color: "text-green-600",
            bg: "bg-green-50",
            sub: `${collectionRate.toFixed(0)}% collection rate`,
          },
          {
            label: "Outstanding",
            value: `Rs. ${((s?.total_outstanding ?? 0) / 1000).toFixed(0)}K`,
            icon: AlertTriangle,
            color: "text-amber-600",
            bg: "bg-amber-50",
            sub: `${s?.pending_count ?? 0} students pending`,
          },
          {
            label: "Overdue",
            value: `Rs. ${((s?.total_overdue ?? 0) / 1000).toFixed(0)}K`,
            icon: Calendar,
            color: "text-red-600",
            bg: "bg-red-50",
            sub: `${s?.overdue_count ?? 0} students overdue`,
          },
          {
            label: "This Month",
            value: `Rs. ${((s?.this_month_collected ?? 0) / 1000).toFixed(0)}K`,
            icon: Receipt,
            color: "text-blue-600",
            bg: "bg-blue-50",
            sub: `${s?.paid_count ?? 0} payments received`,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <p
                    className={`text-xl font-bold mt-1 ${stat.color} ${isLoading ? "animate-pulse" : ""}`}
                  >
                    {isLoading ? "—" : stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.sub}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Collection Progress Bar */}
      {!isLoading && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                Overall Collection Progress
              </span>
              <span className="text-sm font-bold text-primary">
                {collectionRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, collectionRate)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
              <span>
                Collected: Rs. {(s?.total_collected ?? 0).toLocaleString()}
              </span>
              <span>
                Expected: Rs. {(s?.total_expected ?? 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Payments</CardTitle>
            <Link href="/dashboard/fees/collect">
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-muted rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : !s?.recent_payments?.length ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No payments recorded yet
              </div>
            ) : (
              <div className="divide-y">
                {s.recent_payments.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    className="px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.student_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.fee_type} •{" "}
                        {displayBS(p.paid_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-700">
                        Rs. {(p.amount || 0).toLocaleString()}
                      </p>
                      {p.receipt_number && (
                        <p className="text-[10px] text-muted-foreground">
                          #{p.receipt_number}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collection by Class */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Collection by Class</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : !s?.by_class?.length ? (
              <p className="text-center text-muted-foreground text-sm py-4">
                No class data available
              </p>
            ) : (
              s.by_class.slice(0, 8).map((c) => {
                const rate =
                  c.rate ?? Math.round((c.collected / (c.expected || 1)) * 100);
                return (
                  <div key={c.class_name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{c.class_name}</span>
                      <span className="text-muted-foreground">
                        Rs. {(c.collected / 1000).toFixed(0)}K /{" "}
                        {(c.expected / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(100, rate)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert for overdue */}
      {!isLoading && (s?.overdue_count ?? 0) > 0 && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {s!.overdue_count} students have overdue fees
              </p>
              <p className="text-xs text-red-600">
                Total overdue: Rs. {s!.total_overdue.toLocaleString()}
              </p>
            </div>
          </div>
          <Link href="/dashboard/fees/defaulters">
            <Button size="sm" variant="destructive" className="gap-1">
              View <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
