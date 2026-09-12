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
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Bell, AlertTriangle, Info } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function SeismicAlertsPage() {
  return <PluginGate slug="disaster_management"><AlertsContent /></PluginGate>;
}

function AlertsContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["seismic-alerts"],
    queryFn: async () => { const r = await api.get("/emergency/seismic-alerts"); return r.data?.data ?? r.data; },
    refetchInterval: 60000, // refresh every minute
    retry: 1,
  });

  const alerts: any[] = Array.isArray(data) ? data : data?.alerts ?? [];
  const meta = Array.isArray(data) ? {} : data ?? {};

  if (isLoading) return <AOSModuleLoadingState label="Loading seismic alerts…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Seismic Alerts" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load seismic alerts. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const getSeverity = (m: number) => {
    if (m >= 7) return { label: "Major", color: "#c42b1c", border: "#c42b1c" };
    if (m >= 6) return { label: "Strong", color: "#c42b1c", border: "#d83b01" };
    if (m >= 5) return { label: "Moderate", color: "#d83b01", border: "#ffb900" };
    if (m >= 4) return { label: "Light", color: "#8a6116", border: "rgba(255,185,0,0.5)" };
    return { label: "Minor", color: "var(--w11-text-secondary)", border: "var(--w11-border-default)" };
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bell className="h-5 w-5" style={{ color: "#c42b1c" }} />}
        title="Seismic Alerts"
        subtitle={`Real-time earthquake monitoring from NSC/USGS API · ${alerts.length} recent ${alerts.length === 1 ? "event" : "events"}`}
        actions={
          meta.unavailable ? (
            <span className="win11-chip warning">Feed Unreachable</span>
          ) : (
            <span className="win11-chip success">Live Monitoring</span>
          )
        }
      />
      <AOSPageBody>
        {meta.unavailable && (
          <div className="win11-infobar warning flex items-center gap-3 mb-4" role="status">
            <Info className="h-5 w-5 shrink-0" />
            <p className="text-sm">The seismic feed could not be reached just now ({meta.reason ?? "network error"}). The empty list below is real — no events are being shown rather than stale data.</p>
          </div>
        )}

        <div className="win11-infobar info flex items-center gap-3 mb-4" role="status">
          <Info className="h-5 w-5 shrink-0" />
          <p className="text-sm">This page fetches seismic data from Nepal Seismological Centre (NSC) and USGS. Events above M4.0 within 200km of your school are shown.</p>
        </div>

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <DataPanel>
              <AOSEmptyState
                icon={<Bell className="h-12 w-12" />}
                title="No significant seismic activity detected recently"
              />
            </DataPanel>
          ) : alerts.map((a: any) => {
            const sev = getSeverity(a.magnitude ?? 0);
            return (
              <div key={a.id ?? a.event_id} className="win11-card" style={{ borderLeft: `3px solid ${sev.border}` }}>
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <div className="text-2xl font-bold" style={{ color: sev.color }}>M{a.magnitude}</div>
                    <span className="win11-chip subtle text-xs" style={{ color: sev.color }}>{sev.label}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{a.location ?? "Unknown Location"}</div>
                    <div className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{a.time ? displayBS(a.time) : "—"} · Depth: {a.depth_km ? `${a.depth_km}km` : "—"}</div>
                    {a.distance_km != null && <div className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{a.distance_km}km from your school</div>}
                  </div>
                  {a.magnitude >= 5.5 && (
                    <AlertTriangle className="h-6 w-6 shrink-0" style={{ color: "#c42b1c" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
