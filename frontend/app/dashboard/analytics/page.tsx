"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { BarChart3, TrendingUp, Users, DollarSign, BookOpen, Brain } from "lucide-react";
import Link from "next/link";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";

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

  const sections = [
    { title: "Academic Analytics", desc: "Student performance, pass rates, grade distribution", icon: BookOpen, href: "/dashboard/analytics/academic" },
    { title: "Financial Analytics", desc: "Fee collection trends, revenue, outstanding dues", icon: DollarSign, href: "/dashboard/analytics/financial" },
    { title: "AI Intelligence Report", desc: "AI-generated weekly school insights", icon: Brain, href: "/dashboard/ai-tools/insights" },
  ];

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sections.map((s, i) => (
            <Link key={i} href={s.href}>
              <div className="win11-card interactive h-full" style={{ marginBottom: 0 }}>
                <div className="pt-2">
                  <div
                    className="p-3 rounded-lg w-fit mb-4"
                    style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}
                  >
                    <s.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1 text-[color:var(--w11-text-primary)]">{s.title}</h3>
                  <p className="text-sm text-[color:var(--w11-text-secondary)]">{s.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
