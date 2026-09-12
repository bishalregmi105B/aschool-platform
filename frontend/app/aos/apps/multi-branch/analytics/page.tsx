"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, Award } from "lucide-react";

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

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load multi-branch analytics. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  const rankings: any[] = data?.branch_rankings ?? [];
  const metrics: any[] = data?.metrics ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Chain Analytics</h1><p className="text-muted-foreground">Performance comparison across all branches</p></div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
            <SelectItem value="last_year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((m: any) => (
          <Card key={m.label}><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{m.label}</p>
            <p className="text-3xl font-bold mt-1">{m.value}</p>
            {m.change != null && (
              <div className={`flex items-center gap-1 text-sm mt-1 ${m.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                {m.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {Math.abs(m.change)}% vs last period
              </div>
            )}
          </CardContent></Card>
        ))}
        {metrics.length === 0 && (
          <Card className="col-span-3"><CardContent className="pt-6 text-center text-muted-foreground py-8">No analytics data available</CardContent></Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" />Branch Performance Rankings</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rankings.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No ranking data available</p>
            ) : rankings.map((b: any, idx: number) => (
              <div key={b.id} className="flex items-center gap-4">
                <span className={`text-lg font-bold w-8 text-center ${idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-amber-600" : "text-muted-foreground"}`}>#{idx + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-sm font-semibold">{b.score ?? 0}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${b.score ?? 0}%` }} />
                  </div>
                </div>
                <Badge variant={b.trend >= 0 ? "default" : "destructive"}>{b.trend >= 0 ? "▲" : "▼"} {Math.abs(b.trend ?? 0)}%</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
