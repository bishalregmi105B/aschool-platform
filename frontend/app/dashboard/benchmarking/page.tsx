"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { BarChart3, TrendingUp, TrendingDown, Award, Target } from "lucide-react";

export default function BenchmarkingPage() {
  return (
    <PluginGate slug="benchmarking">
      <BenchmarkingContent />
    </PluginGate>
  );
}

function BenchmarkingContent() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["benchmarking"],
    queryFn: async () => {
      const res = await api.get("/benchmarking/overview");
      return res.data.data;
    },
  });

  if (isLoading) return <PageLoader />;

  const metrics = [
    { label: "Pass Rate", school: data?.school?.pass_rate || 0, district: data?.district?.pass_rate || 0, national: data?.national?.pass_rate || 0, icon: Award, suffix: "%" },
    { label: "Avg Score", school: data?.school?.avg_score || 0, district: data?.district?.avg_score || 0, national: data?.national?.avg_score || 0, icon: Target, suffix: "" },
    { label: "Attendance", school: data?.school?.attendance || 0, district: data?.district?.attendance || 0, national: data?.national?.attendance || 0, icon: BarChart3, suffix: "%" },
    { label: "Student-Teacher Ratio", school: data?.school?.ratio || 0, district: data?.district?.ratio || 0, national: data?.national?.ratio || 0, icon: BarChart3, suffix: ":1", lowerBetter: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">School Benchmarking</h1>
        <p className="text-muted-foreground">Compare your school&apos;s performance against district and national averages</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const diff = m.lowerBetter ? m.district - m.school : m.school - m.district;
          const isGood = diff > 0;

          return (
            <Card key={m.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <m.icon className="h-4 w-4" />{m.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{m.school}{m.suffix}</div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">District Avg</span>
                    <span>{m.district}{m.suffix}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">National Avg</span>
                    <span>{m.national}{m.suffix}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {isGood ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                  <span className={`text-sm font-medium ${isGood ? "text-green-600" : "text-red-600"}`}>
                    {isGood ? "+" : ""}{Math.abs(diff).toFixed(1)} vs district
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.departments || []).map((dept: any) => (
              <div key={dept.subject} className="flex items-center gap-4">
                <Badge variant="outline" className="w-8 justify-center">#{dept.rank}</Badge>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{dept.subject}</span>
                    <span className="text-sm text-muted-foreground">{dept.avg ?? dept.average ?? dept.avg_score}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${dept.avg ?? dept.average ?? dept.avg_score}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {(data?.departments || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No subject benchmarks yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
