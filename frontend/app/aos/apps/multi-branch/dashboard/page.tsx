"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, BookOpen, DollarSign } from "lucide-react";

export default function ChainDashboardPage() {
  return <PluginGate slug="multi_branch"><ChainDashboardContent /></PluginGate>;
}

function ChainDashboardContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["chain-dashboard"],
    queryFn: async () => { const r = await api.get("/schools/chain/dashboard"); return r.data?.data ?? r.data; },
  });

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load multi-branch dashboard. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  const branches: any[] = data?.branches ?? [];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Unified Chain Dashboard</h1><p className="text-muted-foreground">Consolidated view across all branches</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Students", value: data?.totals?.students ?? "—", icon: Users, color: "text-blue-600" },
          { label: "Total Staff", value: data?.totals?.staff ?? "—", icon: Users, color: "text-green-600" },
          { label: "Chain Attendance", value: data?.totals?.attendance ? `${data.totals.attendance}%` : "—", icon: BookOpen, color: "text-orange-600" },
          { label: "Total Revenue", value: data?.totals?.revenue ? `Rs. ${data.totals.revenue.toLocaleString()}` : "—", icon: DollarSign, color: "text-purple-600" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-6 flex items-center gap-4">
            <s.icon className={`h-8 w-8 ${s.color}`} />
            <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {branches.map((b: any) => (
          <Card key={b.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">{b.name}</CardTitle>
              <Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Inactive"}</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xl font-bold">{b.student_count ?? "—"}</p><p className="text-xs text-muted-foreground">Students</p></div>
                <div><p className="text-xl font-bold">{b.staff_count ?? "—"}</p><p className="text-xs text-muted-foreground">Staff</p></div>
                <div><p className="text-xl font-bold">{b.attendance_rate != null ? `${b.attendance_rate}%` : "—"}</p><p className="text-xs text-muted-foreground">Attendance</p></div>
              </div>
              {b.performance_score != null && (
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1"><span>Performance</span><span>{b.performance_score}%</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${b.performance_score}%` }} /></div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {branches.length === 0 && (
          <Card className="col-span-full"><CardContent className="pt-6 text-center text-muted-foreground py-12">No branch data available</CardContent></Card>
        )}
      </div>
    </div>
  );
}
