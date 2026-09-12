"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load seismic alerts. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  const getSeverity = (m: number) => {
    if (m >= 7) return { label: "Major", color: "text-red-700", bg: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" };
    if (m >= 6) return { label: "Strong", color: "text-red-600", bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/20" };
    if (m >= 5) return { label: "Moderate", color: "text-orange-600", bg: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20" };
    if (m >= 4) return { label: "Light", color: "text-yellow-600", bg: "bg-yellow-50/50" };
    return { label: "Minor", color: "text-muted-foreground", bg: "" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-red-600" />
          <div><h1 className="text-2xl font-bold">Seismic Alerts</h1><p className="text-muted-foreground">Real-time earthquake monitoring from NSC/USGS API</p></div>
        </div>
        {meta.unavailable ? (
          <Badge variant="outline" className="text-amber-600 border-amber-300">Feed Unreachable</Badge>
        ) : (
          <Badge variant="outline" className="text-green-600 border-green-300">Live Monitoring</Badge>
        )}
      </div>

      {meta.unavailable && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4 flex items-center gap-3">
            <Info className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm">The seismic feed could not be reached just now ({meta.reason ?? "network error"}). The empty list below is real — no events are being shown rather than stale data.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="pt-4 flex items-center gap-3">
          <Info className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm">This page fetches seismic data from Nepal Seismological Centre (NSC) and USGS. Events above M4.0 within 200km of your school are shown.</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No significant seismic activity detected recently.</p>
          </CardContent></Card>
        ) : alerts.map((a: any) => {
          const sev = getSeverity(a.magnitude ?? 0);
          return (
            <Card key={a.id ?? a.event_id} className={`border ${sev.bg}`}>
              <CardContent className="pt-4 flex items-center gap-4">
                <div className="text-center min-w-[60px]">
                  <div className={`text-2xl font-bold ${sev.color}`}>M{a.magnitude}</div>
                  <Badge variant="outline" className={`text-xs ${sev.color}`}>{sev.label}</Badge>
                </div>
                <div className="flex-1">
                  <div className="font-medium">{a.location ?? "Unknown Location"}</div>
                  <div className="text-sm text-muted-foreground">{a.time ? displayBS(a.time) : "—"} · Depth: {a.depth_km ? `${a.depth_km}km` : "—"}</div>
                  {a.distance_km != null && <div className="text-sm text-muted-foreground">{a.distance_km}km from your school</div>}
                </div>
                {a.magnitude >= 5.5 && (
                  <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
