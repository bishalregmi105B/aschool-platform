"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { BarChart3, TrendingUp, Users, DollarSign, BookOpen, Brain } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["analytics-overview"],
    queryFn: async () => { const r = await api.get("/analytics/overview"); return r.data?.data; },
  });

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load analytics overview. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  const stats = data || {};

  const sections = [
    { title: "Academic Analytics", desc: "Student performance, pass rates, grade distribution", icon: BookOpen, href: "/dashboard/analytics/academic", color: "bg-blue-50 text-blue-600" },
    { title: "Financial Analytics", desc: "Fee collection trends, revenue, outstanding dues", icon: DollarSign, href: "/dashboard/analytics/financial", color: "bg-green-50 text-green-600" },
    { title: "AI Intelligence Report", desc: "AI-generated weekly school insights", icon: Brain, href: "/dashboard/ai-tools/insights", color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Analytics & Reports</h1><p className="text-muted-foreground">Data-driven insights for school management</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><Users className="h-5 w-5 text-blue-600 mb-2" /><p className="text-2xl font-bold">{stats.total_students || 0}</p><p className="text-sm text-muted-foreground">Total Students</p></CardContent></Card>
        <Card><CardContent className="pt-6"><TrendingUp className="h-5 w-5 text-green-600 mb-2" /><p className="text-2xl font-bold">{stats.attendance_rate ? `${stats.attendance_rate}%` : "—"}</p><p className="text-sm text-muted-foreground">Avg Attendance</p></CardContent></Card>
        <Card><CardContent className="pt-6"><DollarSign className="h-5 w-5 text-yellow-600 mb-2" /><p className="text-2xl font-bold">{stats.collection_rate ? `${stats.collection_rate}%` : "—"}</p><p className="text-sm text-muted-foreground">Fee Collection Rate</p></CardContent></Card>
        <Card><CardContent className="pt-6"><BookOpen className="h-5 w-5 text-purple-600 mb-2" /><p className="text-2xl font-bold">{stats.pass_rate ? `${stats.pass_rate}%` : "—"}</p><p className="text-sm text-muted-foreground">Overall Pass Rate</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sections.map((s, i) => (
          <Link key={i} href={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="pt-6">
                <div className={`p-3 rounded-lg ${s.color} w-fit mb-4`}><s.icon className="h-6 w-6" /></div>
                <h3 className="font-semibold text-lg mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
