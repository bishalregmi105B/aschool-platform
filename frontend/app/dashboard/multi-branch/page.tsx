"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { Building2, Users, TrendingUp, MapPin } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MultiBranchPage() {
  return <PluginGate slug="multi_branch"><MultiBranchContent /></PluginGate>;
}

function MultiBranchContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["multi-branch-overview"],
    queryFn: async () => { const r = await api.get("/schools/chain/overview"); return r.data?.data ?? r.data; },
  });

  if (isLoading) return <PageLoader />;

  const branches: any[] = data?.branches ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Multi-Branch Management</h1>
          <p className="text-muted-foreground">Oversee all branches in your school chain</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/dashboard/multi-branch/analytics">Chain Analytics</Link></Button>
          <Button asChild><Link href="/dashboard/multi-branch/branches">Manage Branches</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Branches", value: stats.total_branches ?? branches.length, icon: Building2, color: "text-blue-600" },
          { label: "Total Students", value: stats.total_students ?? "—", icon: Users, color: "text-green-600" },
          { label: "Total Staff", value: stats.total_staff ?? "—", icon: Users, color: "text-orange-600" },
          { label: "Avg Performance", value: stats.avg_performance ? `${stats.avg_performance}%` : "—", icon: TrendingUp, color: "text-purple-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6 flex items-center gap-4">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.length === 0 ? (
          <Card className="col-span-full"><CardContent className="pt-6 text-center text-muted-foreground py-12">No branches found. Add branches to get started.</CardContent></Card>
        ) : branches.map((b: any) => (
          <Card key={b.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{b.name}</CardTitle>
                <Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Inactive"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{b.address ?? "—"}</div>
              <div className="flex justify-between text-sm">
                <span>Students: <strong>{b.student_count ?? "—"}</strong></span>
                <span>Staff: <strong>{b.staff_count ?? "—"}</strong></span>
              </div>
              {b.performance_score != null && (
                <div className="text-sm">Performance: <strong>{b.performance_score}%</strong></div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
