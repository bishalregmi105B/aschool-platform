"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { BarChart3, TrendingUp, Users, DollarSign, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";

// Quick links — every analytics subpage plus the AI Suite surfaces from the
// ai_suite manifest (Workbench, Benchmarking, Reports).
const QUICK_LINKS = [
  { label: "Academic Analytics", desc: "Student performance, pass rates, grade distribution", icon: "BookOpen", href: "/dashboard/analytics/academic" },
  { label: "Financial Analytics", desc: "Fee collection trends, revenue, outstanding dues", icon: "DollarSign", href: "/dashboard/analytics/financial" },
  { label: "AI Usage", desc: "AI feature usage and cost", icon: "Sparkles", href: "/dashboard/analytics/ai-usage" },
  { label: "AI Intelligence Report", desc: "AI-generated weekly school insights", icon: "Brain", href: "/dashboard/ai-tools/insights" },
  { label: "Benchmarking", desc: "Compare against district and national averages", icon: "TrendingUp", href: "/dashboard/benchmarking" },
  { label: "Reports", desc: "Everyday school reports", icon: "FileBarChart2", href: "/dashboard/reports" },
  { label: "AI Workbench", desc: "Schema-driven AI generation tools", icon: "Layers", href: "/dashboard/ai-workbench" },
];

export default function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["analytics-overview"],
    queryFn: async () => { const r = await api.get("/analytics/overview"); return r.data?.data; },
  });

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <AOSPage>
          <AOSPageHeader
            icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
            title="Analytics & Reports"
            subtitle="Data-driven insights for school management"
          />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load analytics overview. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          </AOSPageBody>
        </AOSPage>
      );
    }

  const stats = data || {};

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Analytics & Reports"
        subtitle="Data-driven insights for school management"
      />
      <AOSPageBody>
        <StatGrid min={180}>
          <KpiCard label="Total Students" value={stats.total_students || 0} icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Avg Attendance" value={stats.attendance_rate ? `${stats.attendance_rate}%` : "—"} icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Fee Collection Rate" value={stats.collection_rate ? `${stats.collection_rate}%` : "—"} icon={<DollarSign className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Overall Pass Rate" value={stats.pass_rate ? `${stats.pass_rate}%` : "—"} icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </StatGrid>

        {/* Quick links — 44px gradient icon tile + label, as next/link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_LINKS.map((l) => {
            const Icon = ICON_MAP[l.icon] || ChevronRight;
            return (
              <Link key={l.href} href={l.href} className="block h-full">
                <div
                  className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                  style={{ cursor: "pointer", marginBottom: 0 }}
                >
                  <div
                    className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      background: SECTION_GRADIENTS.Insights,
                      boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                      {l.label}
                    </p>
                    <p className="text-[11px] leading-snug" style={{ color: "var(--w11-text-secondary)" }}>
                      {l.desc}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
