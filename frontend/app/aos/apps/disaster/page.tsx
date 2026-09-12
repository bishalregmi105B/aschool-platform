"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Map, Calendar, Bell } from "lucide-react";
import Link from "next/link";
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

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load the disaster overview. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  const alerts: any[] = data?.recent_alerts ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-red-600" />
          <div><h1 className="text-2xl font-bold">Disaster Management</h1><p className="text-muted-foreground">Earthquake alerts, evacuation plans, and drill scheduling</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Map className="h-6 w-6 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Evacuation Plans</p>
                <p className="text-2xl font-bold">{stats.total_plans ?? "—"}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="mt-4 w-full" asChild><Link href="/dashboard/disaster/plans">Manage Plans</Link></Button>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Drills This Year</p>
                <p className="text-2xl font-bold">{stats.drills_this_year ?? "—"}</p>
                {stats.last_drill_at && <p className="text-xs text-muted-foreground mt-1">Last: {displayBS(stats.last_drill_at)}</p>}
              </div>
            </div>
            <Button size="sm" variant="outline" className="mt-4 w-full" asChild><Link href="/dashboard/disaster/drills">Schedule Drills</Link></Button>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold">{stats.active_alerts ?? "—"}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="mt-4 w-full" asChild><Link href="/dashboard/disaster/alerts">View Alerts</Link></Button>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Readiness Score</p>
                <p className="text-2xl font-bold">{stats.readiness_score ?? "—"}<span className="text-sm text-muted-foreground">/100</span></p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Drill recency, frequency, evacuation plans & alert hygiene</p>
          </CardContent>
        </Card>
      </div>

      {stats.upcoming_drills > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-600" />Upcoming Drills</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.upcoming_drills ?? []).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div><div className="font-medium">{d.title}</div><div className="text-sm text-muted-foreground capitalize">{d.drill_type ?? d.type}</div></div>
                  <Badge variant="secondary">{d.scheduled_date ? displayBS(d.scheduled_date) : "—"}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-600" />Recent Seismic Alerts</CardTitle></CardHeader>
        <CardContent>
          {data?.seismic?.unavailable && (
            <p className="text-sm text-muted-foreground mb-3">Live seismic feed is currently unreachable — showing no events rather than stale data.</p>
          )}
          {alerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No recent seismic alerts. System is monitoring.</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((a: any) => (
                <div key={a.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <AlertTriangle className={`h-5 w-5 ${a.magnitude >= 6 ? "text-red-600" : a.magnitude >= 4 ? "text-orange-600" : "text-yellow-600"}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><span className="font-medium">M{a.magnitude}</span><Badge variant={a.magnitude >= 6 ? "destructive" : "secondary"}>{a.location ?? "Unknown"}</Badge></div>
                    <p className="text-sm text-muted-foreground">{a.time ?? a.created_at ?? "—"}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{a.depth_km ? `${a.depth_km}km depth` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
