"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, TrendingDown, Award } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

export default function ChainAnalyticsPage() {
  return <PluginGate slug="multi_branch"><ChainAnalyticsContent /></PluginGate>;
}

function ChainAnalyticsContent() {
  const [period, setPeriod] = useState("this_year");

  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["chain-analytics", period],
    queryFn: async () => { const r = await api.get("/schools/chain/analytics", { params: { period } }); return r.data?.data ?? r.data; },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading chain analytics…" />;
    if (isError) {
      return (
        <AOSPage>
          <AOSPageHeader title="Chain Analytics" subtitle="Performance comparison across all branches" />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                  Failed to load multi-branch analytics. Please try again.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          </AOSPageBody>
        </AOSPage>
      );
    }

  const rankings: any[] = data?.branch_rankings ?? [];
  const metrics: any[] = data?.metrics ?? [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Chain Analytics"
        subtitle="Performance comparison across all branches"
        actions={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="last_year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <AOSPageBody>
        <StatGrid min={200}>
          {metrics.map((m: any) => (
            <KpiCard
              key={m.label}
              label={m.label}
              value={m.value}
              footnote={
                m.change != null ? (
                  <span
                    className="inline-flex items-center gap-1"
                    style={{ color: m.change >= 0 ? "var(--w11-accent)" : "var(--w11-text-secondary)" }}
                  >
                    {m.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {Math.abs(m.change)}% vs last period
                  </span>
                ) : undefined
              }
            />
          ))}
        </StatGrid>
        {metrics.length === 0 && (
          <DataPanel>
            <AOSEmptyState title="No analytics data available" />
          </DataPanel>
        )}

        <DataPanel
          title={
            <span className="inline-flex items-center gap-2">
              <Award className="h-4 w-4" /> Branch Performance Rankings
            </span>
          }
        >
          <div className="space-y-3">
            {rankings.length === 0 ? (
              <AOSEmptyState title="No ranking data available" />
            ) : rankings.map((b: any, idx: number) => (
              <div key={b.id} className="flex items-center gap-4">
                <span
                  className="text-lg font-bold w-8 text-center"
                  style={{ color: "var(--w11-text-secondary)" }}
                >
                  #{idx + 1}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{b.name}</span>
                    <span className="text-sm font-semibold" style={{ color: "var(--w11-text-primary)" }}>{b.score ?? 0}%</span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--w11-control-hover)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${b.score ?? 0}%`, background: "var(--w11-accent)" }}
                    />
                  </div>
                </div>
                <StatusChip
                  status={b.trend >= 0 ? "active" : "overdue"}
                  label={`${b.trend >= 0 ? "▲" : "▼"} ${Math.abs(b.trend ?? 0)}%`}
                />
              </div>
            ))}
          </div>
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
