"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, AlertOctagon, TrendingUp, FileText } from "lucide-react";
import Link from "next/link";

export default function IncidentManagementPage() {
  return <PluginGate slug="incident_management"><IncidentMgmtContent /></PluginGate>;
}

function IncidentMgmtContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["incident-management-overview"],
    queryFn: async () => { const r = await api.get("/incidents/management/overview"); return r.data?.data ?? r.data; },
  });

  if (isLoading) return <PageLoader />;

  const stats = data?.stats ?? {};
  const recentCases: any[] = data?.recent_cases ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-orange-600" />
          <div><h1 className="text-2xl font-bold">Full Incident Management</h1><p className="text-muted-foreground">Behavior management with witnesses, escalation, and parent conferences</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Cases", value: stats.active ?? "—", icon: AlertOctagon, color: "text-red-600", href: "/dashboard/incident-management/active" },
          { label: "Pending Escalation", value: stats.pending_escalation ?? "—", icon: TrendingUp, color: "text-orange-600", href: "/dashboard/incident-management/escalations" },
          { label: "Resolved (Month)", value: stats.resolved_this_month ?? "—", icon: ShieldAlert, color: "text-green-600", href: "/dashboard/incident-management/reports" },
          { label: "Total This Year", value: stats.total_this_year ?? "—", icon: FileText, color: "text-blue-600", href: "/dashboard/incident-management/reports" },
        ].map((s) => (
          <Card key={s.label} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <Link href={s.href} className="flex items-center gap-4">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "Active Cases", desc: "Open incidents requiring resolution", icon: AlertOctagon, href: "/dashboard/incident-management/active", color: "border-red-200" },
          { title: "Escalations", desc: "Cases escalated to principal/management", icon: TrendingUp, href: "/dashboard/incident-management/escalations", color: "border-orange-200" },
          { title: "Reports", desc: "Analytics and resolved case reports", icon: FileText, href: "/dashboard/incident-management/reports", color: "border-blue-200" },
        ].map((card) => (
          <Card key={card.title} className={`${card.color} hover:shadow-md transition-shadow`}>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><card.icon className="h-5 w-5" />{card.title}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{card.desc}</p>
              <Button size="sm" variant="outline" asChild className="w-full"><Link href={card.href}>Open</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {recentCases.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Cases</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCases.slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div><div className="font-medium">{c.title}</div><div className="text-sm text-muted-foreground">{c.student_name ?? "—"} · {c.type ?? "incident"}</div></div>
                  <Badge variant={c.severity === "high" ? "destructive" : "secondary"}>{c.severity ?? "medium"}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
