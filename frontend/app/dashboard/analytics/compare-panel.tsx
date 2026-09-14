"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DataPanel,
  StatGrid,
  AOSModuleLoadingState,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { MetricCard } from "@/components/ui/metric-card";
import { BarChart3 } from "lucide-react";

/**
 * Benchmarking Compare panel — extracted (plan 34 #21: "fold as analytics
 * tab") so it renders both inside /dashboard/benchmarking (legacy route,
 * kept) and as the "Compare" tab of the analytics hub. School vs district vs
 * national; deltas are the REAL difference against the district average —
 * zero values stay zero (Part 19.3 honesty).
 */

export function BenchmarkCompare() {
  const { data, isLoading, isError, refetch } = useQuery<any>({
    retry: 1,
    queryKey: ["benchmarking"],
    queryFn: async () => {
      const res = await api.get("/benchmarking/overview");
      return res.data.data;
    },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading benchmarks…" />;
  if (isError) {
    return (
      <DataPanel className="max-w-2xl mx-auto">
        <div className="py-10 text-center space-y-3">
          <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
            Failed to load benchmarking data.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </DataPanel>
    );
  }

  const metrics = [
    { label: "Pass Rate", school: data?.school?.pass_rate || 0, district: data?.district?.pass_rate || 0, national: data?.national?.pass_rate || 0, suffix: "%", lowerBetter: false },
    { label: "Avg Score", school: data?.school?.avg_score || 0, district: data?.district?.avg_score || 0, national: data?.national?.avg_score || 0, suffix: "", lowerBetter: false },
    { label: "Attendance", school: data?.school?.attendance || 0, district: data?.district?.attendance || 0, national: data?.national?.attendance || 0, suffix: "%", lowerBetter: false },
    { label: "Student-Teacher Ratio", school: data?.school?.ratio || 0, district: data?.district?.ratio || 0, national: data?.national?.ratio || 0, suffix: ":1", lowerBetter: true },
  ];
  const hasData = metrics.some((m) => m.school > 0);
  const departments: any[] = data?.departments ?? [];

  return (
    <div className="space-y-4">
      <StatGrid min={180}>
        {metrics.map((m) => {
          const diff = m.lowerBetter ? m.district - m.school : m.school - m.district;
          return (
            <MetricCard
              key={m.label}
              label={m.label}
              value={`${m.school}${m.suffix}`}
              // Signed delta vs district — real comparison, not a fake trend.
              delta={`${diff > 0 ? "+" : ""}${diff.toFixed(1)} vs district`}
              lowerIsBetter={m.lowerBetter}
              footnote={`District ${m.district}${m.suffix} · National ${m.national}${m.suffix}`}
            />
          );
        })}
      </StatGrid>

      {!hasData && (
        <DataPanel>
          <AOSEmptyState
            icon={<BarChart3 className="h-10 w-10" />}
            title="Nothing to benchmark yet"
            description="Publish exam results and mark attendance — comparisons appear once there is data."
          />
        </DataPanel>
      )}

      <DataPanel title="Department Rankings (average by subject)">
        {departments.length === 0 ? (
          <AOSEmptyState
            title="No subject benchmarks yet"
            description="Subject averages appear once results are published for this session."
          />
        ) : (
          <div className="space-y-3">
            {departments.map((dept: any) => {
              const score = dept.avg ?? dept.average ?? dept.avg_score ?? 0;
              return (
                <div key={dept.subject} className="flex items-center gap-4">
                  <span className="win11-chip subtle w-8 justify-center">#{dept.rank}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                        {dept.subject}
                      </span>
                      <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                        {score}%
                      </span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: "var(--w11-control-hover)" }}>
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: "var(--w11-accent)" }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DataPanel>
    </div>
  );
}
