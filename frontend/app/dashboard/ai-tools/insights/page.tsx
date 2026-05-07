"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Users, DollarSign, BookOpen, Activity } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function InsightsPage() {
  return (
    <PluginGate slug="ai_tools"><InsightsContent /></PluginGate>
  );
}

function InsightsContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: async () => { const r = await api.get("/ai-tools/insights/weekly"); return r.data?.data; },
  });

  const insights = data?.insights || data || [];
  const summary = data?.summary || {};

  const iconMap: Record<string, any> = { attendance: Users, finance: DollarSign, academic: BookOpen, general: Activity };
  const colorMap: Record<string, string> = { high: "text-red-600 bg-red-50", medium: "text-yellow-600 bg-yellow-50", low: "text-green-600 bg-green-50", positive: "text-green-600", negative: "text-red-600", neutral: "text-gray-600" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">AI School Insights</h1><p className="text-muted-foreground">Weekly intelligence report for school management</p></div>
      </div>

      {summary && Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Attendance Rate", value: summary.attendance_rate, icon: Users, trend: summary.attendance_trend },
            { label: "Fee Collection", value: summary.fee_collection_rate, icon: DollarSign, trend: summary.fee_trend },
            { label: "Academic Score", value: summary.avg_academic_score, icon: BookOpen, trend: summary.academic_trend },
            { label: "Alerts", value: summary.alert_count || 0, icon: AlertTriangle, trend: null },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{typeof s.value === "number" ? (s.value > 1 ? s.value : `${(s.value * 100).toFixed(1)}%`) : s.value ?? "—"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <s.icon className="h-5 w-5 text-muted-foreground" />
                    {s.trend && (
                      <span className={`text-xs flex items-center ${s.trend > 0 ? "text-green-600" : "text-red-600"}`}>
                        {s.trend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {Math.abs(s.trend)}%
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Loading insights...</CardContent></Card>
      ) : Array.isArray(insights) && insights.length > 0 ? (
        <div className="space-y-4">
          {insights.map((insight: any, i: number) => {
            const Icon = iconMap[insight.category] || Activity;
            return (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${colorMap[insight.priority] || "bg-gray-50"}`}><Icon className="h-5 w-5" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{insight.title}</h3>
                        {insight.priority && <Badge variant={insight.priority === "high" ? "destructive" : "secondary"}>{insight.priority}</Badge>}
                        {insight.category && <Badge variant="outline">{insight.category}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description || insight.message}</p>
                      {insight.recommendation && <p className="text-sm mt-2 font-medium">Recommendation: {insight.recommendation}</p>}
                    </div>
                    {insight.metric && <div className="text-right"><span className={`text-lg font-bold ${colorMap[insight.sentiment] || ""}`}>{insight.metric}</span></div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><Activity className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No insights available yet. AI generates insights from school data weekly.</p></CardContent></Card>
      )}
    </div>
  );
}
