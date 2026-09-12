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
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Shield, AlertTriangle, Map, Calendar, Bell } from "lucide-react";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { displayBS } from "@/lib/nepali_date";

export default function DisasterPage() {
  return <PluginGate slug="disaster_management"><DisasterContent /></PluginGate>;
}

function DisasterContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["disaster-overview"],
    queryFn: async () => { const r = await api.get("/emergency/disaster/overview"); return r.data?.data ?? r.data; },
    retry: 1,
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading disaster overview…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Disaster Management" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load the disaster overview. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const alerts: any[] = data?.recent_alerts ?? [];
  const stats = data?.stats ?? {};

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Shield className="h-5 w-5" style={{ color: "#c42b1c" }} />}
        title="Disaster Management"
        subtitle={`Earthquake alerts, evacuation plans, and drill scheduling · readiness ${stats.readiness_score ?? "—"}/100`}
      />
      <AOSPageBody>
        {/* Dashboard KPIs — real numbers from the /emergency/disaster/overview stats */}
        <StatGrid>
          <KpiCard
            label="Evacuation Plans"
            value={stats.total_plans ?? "—"}
            color="#d83b01"
            icon={<Map className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
          <KpiCard
            label="Drills This Year"
            value={stats.drills_this_year ?? "—"}
            icon={<Calendar className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
            footnote={stats.last_drill_at ? `Last: ${displayBS(stats.last_drill_at)}` : undefined}
          />
          <KpiCard
            label="Active Alerts"
            value={stats.active_alerts ?? "—"}
            color="#c42b1c"
            icon={<Bell className="h-4 w-4" style={{ color: "#c42b1c" }} />}
          />
          <KpiCard
            label="Readiness Score"
            value={stats.readiness_score ?? "—"}
            denominator="/100"
            color="#107c10"
            icon={<Shield className="h-4 w-4" style={{ color: "#107c10" }} />}
            footnote="Drill recency, frequency, evacuation plans & alert hygiene"
          />
        </StatGrid>

        {/* Quick links — every disaster subpage from the plugin manifest */}
        <QuickLinks
          section="Safety & Compliance"
          links={[
            { label: "Evacuation Plans", href: "/dashboard/disaster/plans", icon: "MapPin" },
            { label: "Drill Schedule", href: "/dashboard/disaster/drills", icon: "CalendarDays" },
            { label: "Seismic Alerts", href: "/dashboard/disaster/alerts", icon: "Siren" },
          ]}
        />

        {stats.upcoming_drills > 0 && (
          <DataPanel
            className="mb-4"
            title={
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />Upcoming Drills
              </span>
            }
          >
            <div className="space-y-3">
              {(data?.upcoming_drills ?? []).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 border border-[var(--w11-border-subtle)] rounded-lg">
                  <div><div className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{d.title}</div><div className="text-sm capitalize" style={{ color: "var(--w11-text-secondary)" }}>{d.drill_type ?? d.type}</div></div>
                  <span className="win11-chip subtle">{d.scheduled_date ? displayBS(d.scheduled_date) : "—"}</span>
                </div>
              ))}
            </div>
          </DataPanel>
        )}

        <DataPanel
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" style={{ color: "#d83b01" }} />Recent Seismic Alerts
            </span>
          }
        >
          {data?.seismic?.unavailable && (
            <p className="text-sm mb-3" style={{ color: "var(--w11-text-secondary)" }}>Live seismic feed is currently unreachable — showing no events rather than stale data.</p>
          )}
          {alerts.length === 0 ? (
            <p className="text-center py-6" style={{ color: "var(--w11-text-secondary)" }}>No recent seismic alerts. System is monitoring.</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((a: any) => (
                <div key={a.id} className="flex items-center gap-4 p-3 border border-[var(--w11-border-subtle)] rounded-lg">
                  <AlertTriangle
                    className="h-5 w-5"
                    style={{ color: a.magnitude >= 6 ? "#c42b1c" : a.magnitude >= 4 ? "#d83b01" : "#8a6116" }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><span className="font-medium" style={{ color: "var(--w11-text-primary)" }}>M{a.magnitude}</span><span className={`win11-chip ${a.magnitude >= 6 ? "error" : "subtle"}`}>{a.location ?? "Unknown"}</span></div>
                    <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{a.time ?? a.created_at ?? "—"}</p>
                  </div>
                  <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{a.depth_km ? `${a.depth_km}km depth` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
