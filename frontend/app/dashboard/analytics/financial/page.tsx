"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, PieChart } from "lucide-react";
import Link from "next/link";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";

export default function FinancialAnalyticsPage() {
  const [period, setPeriod] = useState("yearly");

  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["financial-analytics", period],
    queryFn: async () => { const r = await api.get("/analytics/financial", { params: { period } }); return r.data?.data; },
  });

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <AOSPage>
          <AOSPageHeader
            icon={<DollarSign className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
            title="Financial Analytics"
            subtitle="Revenue, collections, and financial trends"
          />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load financial analytics. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          </AOSPageBody>
        </AOSPage>
      );
    }

  const analytics = data || {};
  const monthly = analytics.monthly_trend || [];
  const byType = analytics.by_fee_type || [];
  const byClass = analytics.by_class || [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<DollarSign className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Financial Analytics"
        subtitle="Revenue, collections, and financial trends"
        actions={
          <>
            <Link href="/dashboard/analytics">
              <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <AdvancedSelect className="w-40" value={period} onChange={(v) => setPeriod(v)}
              options={[
                { value: "monthly", label: "This Month" },
                { value: "quarterly", label: "This Quarter" },
                { value: "yearly", label: "This Year" },
              ]}
            />
          </>
        }
      />
      <AOSPageBody>
        <StatGrid min={180}>
          <KpiCard label="Total Revenue" value={`Rs. ${(analytics.total_revenue || 0).toLocaleString()}`} icon={<DollarSign className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Collected" value={`Rs. ${(analytics.collected || 0).toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Outstanding" value={`Rs. ${(analytics.outstanding || 0).toLocaleString()}`} color="#c42b1c" icon={<TrendingDown className="h-5 w-5" style={{ color: "#c42b1c" }} />} />
          <KpiCard label="Collection Rate" value={`${analytics.collection_rate || 0}%`} icon={<PieChart className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </StatGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DataPanel title="Monthly Collection Trend">
            {monthly.length > 0 ? (
              <div className="space-y-2">
                {monthly.map((m: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span>{m.month}</span><span>Rs. {(m.collected || 0).toLocaleString()}</span></div>
                    <div className="w-full rounded-full h-4" style={{ background: "var(--w11-control-hover)" }}>
                      <div className="h-4 rounded-full text-xs flex items-center justify-center" style={{ width: `${Math.min(100, ((m.collected || 0) / (m.expected || 1)) * 100)}%`, background: "var(--w11-accent)", color: "var(--w11-accent-text)" }}>
                        {Math.round(((m.collected || 0) / (m.expected || 1)) * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-8 text-[color:var(--w11-text-secondary)]">No monthly data</p>}
          </DataPanel>

          <DataPanel title="Revenue by Fee Type">
            {byType.length > 0 ? (
              <div className="space-y-4">
                {byType.map((t: any, i: number) => {
                  const colors = ["#0067c0", "#0f7b0f", "#8b5cf6", "#9d5d00", "#c42b1c", "#6366f1"];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: colors[i % colors.length] }} />
                      <span className="text-sm flex-1">{t.type || t.name}</span>
                      <span className="text-sm font-medium">Rs. {(t.amount || 0).toLocaleString()}</span>
                      <span className="text-xs w-12 text-right text-[color:var(--w11-text-secondary)]">{t.percentage || 0}%</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-center py-8 text-[color:var(--w11-text-secondary)]">No fee type data</p>}
          </DataPanel>
        </div>

        {byClass.length > 0 && (
          <DataPanel title="Collection by Class">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {byClass.map((c: any, i: number) => (
                <div key={i} className="rounded-lg border border-[color:var(--w11-border-subtle)] p-4">
                  <h4 className="font-medium mb-2">{c.class_name}</h4>
                  <div className="flex justify-between text-sm mb-1"><span>Expected</span><span>Rs. {(c.expected || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm mb-1"><span>Collected</span><span style={{ color: "var(--w11-accent)" }}>Rs. {(c.collected || 0).toLocaleString()}</span></div>
                  <div className="w-full rounded-full h-2 mt-2" style={{ background: "var(--w11-control-hover)" }}><div className="h-2 rounded-full" style={{ width: `${Math.min(100, ((c.collected || 0) / (c.expected || 1)) * 100)}%`, background: "var(--w11-accent)" }} /></div>
                </div>
              ))}
            </div>
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
