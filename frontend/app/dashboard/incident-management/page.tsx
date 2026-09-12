"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { ShieldAlert, AlertOctagon, TrendingUp, FileText } from "lucide-react";
import Link from "next/link";

export default function IncidentManagementPage() {
  return <PluginGate slug="incident_management"><IncidentMgmtContent /></PluginGate>;
}

function IncidentMgmtContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["incident-management-overview"],
    queryFn: async () => { const r = await api.get("/incidents/management/overview"); return r.data?.data ?? r.data; },
    retry: 1,
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading incident management…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Full Incident Management" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load incident management overview. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const stats = data?.stats ?? {};
  const recentCases: any[] = data?.recent_cases ?? [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ShieldAlert className="h-5 w-5" style={{ color: "#d83b01" }} />}
        title="Full Incident Management"
        subtitle="Behavior management with witnesses, escalation, and parent conferences"
      />
      <AOSPageBody>
        <StatGrid>
          {[
            { label: "Active Cases", value: stats.active ?? "—", href: "/dashboard/incident-management/active", color: "#c42b1c", icon: <AlertOctagon className="h-4 w-4" style={{ color: "#c42b1c" }} /> },
            { label: "Pending Escalation", value: stats.pending_escalation ?? "—", href: "/dashboard/incident-management/escalations", color: "#d83b01", icon: <TrendingUp className="h-4 w-4" style={{ color: "#d83b01" }} /> },
            { label: "Resolved (Month)", value: stats.resolved_this_month ?? "—", href: "/dashboard/incident-management/reports", color: "#107c10", icon: <ShieldAlert className="h-4 w-4" style={{ color: "#107c10" }} /> },
            { label: "Total This Year", value: stats.total_this_year ?? "—", href: "/dashboard/incident-management/reports", color: "var(--w11-accent)", icon: <FileText className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /> },
          ].map((s) => (
            <Link key={s.label} href={s.href} className="block">
              <KpiCard label={s.label} value={s.value} color={s.color} icon={s.icon} className="cursor-pointer hover:shadow-md transition-shadow" />
            </Link>
          ))}
        </StatGrid>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Active Cases", desc: "Open incidents requiring resolution", icon: AlertOctagon, href: "/dashboard/incident-management/active", accent: "#c42b1c" },
            { title: "Escalations", desc: "Cases escalated to principal/management", icon: TrendingUp, href: "/dashboard/incident-management/escalations", accent: "#d83b01" },
            { title: "Reports", desc: "Analytics and resolved case reports", icon: FileText, href: "/dashboard/incident-management/reports", accent: "var(--w11-accent)" },
          ].map((card) => (
            <div key={card.title} className="win11-card hover:shadow-md transition-shadow" style={{ borderTop: `2px solid ${card.accent}` }}>
              <div className="flex items-center gap-2 mb-2">
                <card.icon className="h-5 w-5" style={{ color: card.accent }} />
                <span className="text-base font-semibold" style={{ color: "var(--w11-text-primary)" }}>{card.title}</span>
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--w11-text-secondary)" }}>{card.desc}</p>
              <Button size="sm" variant="outline" asChild className="w-full"><Link href={card.href}>Open</Link></Button>
            </div>
          ))}
        </div>

        {recentCases.length > 0 && (
          <DataPanel title="Recent Cases">
            <div className="space-y-3">
              {recentCases.slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 border border-[var(--w11-border-subtle)] rounded-lg">
                  <div><div className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{c.title}</div><div className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{c.student_name ?? "—"} · {c.type ?? "incident"}</div></div>
                  <StatusChip status={c.severity === "high" ? "failed" : "pending"} label={c.severity ?? "medium"} />
                </div>
              ))}
            </div>
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
