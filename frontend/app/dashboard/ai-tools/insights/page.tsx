"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Users, DollarSign, BookOpen, Activity, Brain } from "lucide-react";
import Link from "next/link";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

export default function InsightsPage() {
  return (
    <PluginGate slug="ai_suite"><InsightsContent /></PluginGate>
  );
}

function Header() {
  return (
    <AOSPageHeader
      icon={<Brain className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
      title="AI School Insights"
      subtitle="Weekly intelligence report for school management"
      actions={
        <Link href="/dashboard/ai-tools">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
        </Link>
      }
    />
  );
}

function InsightsContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: async () => { const r = await api.get("/ai-tools/insights/weekly"); return r.data?.data; },
    retry: 1,
  });

  if (isError) {
    return (
      <AOSPage>
        <Header />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load insights. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const insights = data?.insights || data || [];
  const summary = data?.summary || {};

  const iconMap: Record<string, any> = { attendance: Users, finance: DollarSign, academic: BookOpen, general: Activity };
  const priorityChip: Record<string, string> = { high: "error", medium: "warning", low: "success" };
  const sentimentColor: Record<string, string> = { positive: "var(--w11-accent)", negative: "#c42b1c", neutral: "var(--w11-text-primary)" };
  const trendColor = (t: number) => (t > 0 ? "var(--w11-accent)" : "#c42b1c");

  return (
    <AOSPage>
      <Header />
      <AOSPageBody>
        {summary && Object.keys(summary).length > 0 && (
          <StatGrid min={200}>
            {[
              { label: "Attendance Rate", value: summary.attendance_rate, icon: Users, trend: summary.attendance_trend },
              { label: "Fee Collection", value: summary.fee_collection_rate, icon: DollarSign, trend: summary.fee_trend },
              { label: "Academic Score", value: summary.avg_academic_score, icon: BookOpen, trend: summary.academic_trend },
              { label: "Alerts", value: summary.alert_count || 0, icon: AlertTriangle, trend: null },
            ].map((s, i) => (
              <KpiCard
                key={i}
                label={s.label}
                value={typeof s.value === "number" ? (s.value > 1 ? s.value : `${(s.value * 100).toFixed(1)}%`) : s.value ?? "—"}
                icon={<s.icon className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
                footnote={s.trend != null ? (
                  <span className="inline-flex items-center gap-0.5" style={{ color: trendColor(s.trend) }}>
                    {s.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(s.trend)}%
                  </span>
                ) : undefined}
              />
            ))}
          </StatGrid>
        )}

        {isLoading ? (
          <DataPanel><div className="py-16 text-center text-[color:var(--w11-text-secondary)]">Loading insights...</div></DataPanel>
        ) : Array.isArray(insights) && insights.length > 0 ? (
          <div className="space-y-4">
            {insights.map((insight: any, i: number) => {
              const Icon = iconMap[insight.category] || Activity;
              return (
                <DataPanel key={i}>
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg shrink-0" style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}><Icon className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[color:var(--w11-text-primary)]">{insight.title}</h3>
                        {insight.priority && <span className={`win11-chip ${priorityChip[insight.priority] || ""}`}>{insight.priority}</span>}
                        {insight.category && <span className="win11-chip">{insight.category}</span>}
                      </div>
                      <p className="text-sm text-[color:var(--w11-text-secondary)]">{insight.description || insight.message}</p>
                      {insight.recommendation && <p className="text-sm mt-2 font-medium text-[color:var(--w11-text-primary)]">Recommendation: {insight.recommendation}</p>}
                    </div>
                    {insight.metric && <div className="text-right shrink-0"><span className="text-lg font-bold" style={{ color: sentimentColor[insight.sentiment] || "var(--w11-text-primary)" }}>{insight.metric}</span></div>}
                  </div>
                </DataPanel>
              );
            })}
          </div>
        ) : (
          <DataPanel>
            <AOSEmptyState
              icon={<Activity className="h-12 w-12" />}
              title="No insights available yet"
              description="AI generates insights from school data weekly."
            />
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
