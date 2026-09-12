"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { BarChart3, TrendingUp, TrendingDown, Award, Target } from "lucide-react";

export default function BenchmarkingPage() {
  return (
    <PluginGate slug="ai_suite">
      <BenchmarkingContent />
    </PluginGate>
  );
}

function BenchmarkingContent() {
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
        <AOSPage>
          <AOSPageHeader title="School Benchmarking" />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load benchmarking data. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          </AOSPageBody>
        </AOSPage>
      );
    }

  const metrics = [
    { label: "Pass Rate", school: data?.school?.pass_rate || 0, district: data?.district?.pass_rate || 0, national: data?.national?.pass_rate || 0, icon: Award, suffix: "%" },
    { label: "Avg Score", school: data?.school?.avg_score || 0, district: data?.district?.avg_score || 0, national: data?.national?.avg_score || 0, icon: Target, suffix: "" },
    { label: "Attendance", school: data?.school?.attendance || 0, district: data?.district?.attendance || 0, national: data?.national?.attendance || 0, icon: BarChart3, suffix: "%" },
    { label: "Student-Teacher Ratio", school: data?.school?.ratio || 0, district: data?.district?.ratio || 0, national: data?.national?.ratio || 0, icon: BarChart3, suffix: ":1", lowerBetter: true },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="School Benchmarking"
        subtitle="Compare your school's performance against district and national averages"
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m) => {
            const diff = m.lowerBetter ? m.district - m.school : m.school - m.district;
            const isGood = diff > 0;

            return (
              <div key={m.label} className="win11-card">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--w11-text-secondary)" }}>{m.label}</span>
                </div>
                <div className="text-3xl font-bold" style={{ color: "var(--w11-text-primary)" }}>{m.school}{m.suffix}</div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--w11-text-secondary)" }}>District Avg</span>
                    <span style={{ color: "var(--w11-text-primary)" }}>{m.district}{m.suffix}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--w11-text-secondary)" }}>National Avg</span>
                    <span style={{ color: "var(--w11-text-primary)" }}>{m.national}{m.suffix}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {isGood ? <TrendingUp className="h-4 w-4" style={{ color: "#107c10" }} /> : <TrendingDown className="h-4 w-4" style={{ color: "#c42b1c" }} />}
                  <span className="text-sm font-medium" style={{ color: isGood ? "#107c10" : "#c42b1c" }}>
                    {isGood ? "+" : ""}{Math.abs(diff).toFixed(1)} vs district
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <DataPanel title="Department Rankings">
          <div className="space-y-3">
            {(data?.departments || []).map((dept: any) => (
              <div key={dept.subject} className="flex items-center gap-4">
                <span className="win11-chip subtle w-8 justify-center">#{dept.rank}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>{dept.subject}</span>
                    <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{dept.avg ?? dept.average ?? dept.avg_score}%</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ background: "var(--w11-control-hover)" }}>
                    <div className="h-2 rounded-full transition-all" style={{ width: `${dept.avg ?? dept.average ?? dept.avg_score}%`, background: "var(--w11-accent)" }} />
                  </div>
                </div>
              </div>
            ))}
            {(data?.departments || []).length === 0 && (
              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>No subject benchmarks yet.</p>
            )}
          </div>
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
