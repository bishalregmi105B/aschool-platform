"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Fingerprint, Monitor, RefreshCw, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";

export default function BiometricPage() {
  return <PluginGate slug="biometric"><BiometricContent /></PluginGate>;
}

function BiometricContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["biometric-overview"],
    queryFn: async () => { const r = await api.get("/attendance/biometric/overview"); return r.data?.data ?? r.data; },
  });

  if (isLoading) return <PageLoader />;

  const devices: any[] = data?.devices ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Biometric Integration</h1><p className="text-muted-foreground">ZKTeco fingerprint attendance management</p></div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/dashboard/biometric/logs">Sync Logs</Link></Button>
          <Button asChild><Link href="/dashboard/biometric/devices">Manage Devices</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Devices", value: stats.total_devices ?? devices.length, icon: Monitor },
          { label: "Online", value: stats.online ?? devices.filter((d: any) => d.status === "online").length, icon: Wifi, color: "text-green-600" },
          { label: "Offline", value: stats.offline ?? devices.filter((d: any) => d.status !== "online").length, icon: WifiOff, color: "text-red-600" },
          { label: "Today Syncs", value: stats.today_syncs ?? "—", icon: RefreshCw },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-6 flex items-center gap-4">
            <s.icon className={`h-8 w-8 ${s.color ?? "text-primary"}`} />
            <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.length === 0 ? (
          <Card className="col-span-full"><CardContent className="pt-6 text-center text-muted-foreground py-12">
            <Fingerprint className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No biometric devices configured.</p>
            <Button className="mt-4" asChild><Link href="/dashboard/biometric/devices">Add Device</Link></Button>
          </CardContent></Card>
        ) : devices.map((d: any) => (
          <Card key={d.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Fingerprint className="h-4 w-4" />{d.name}</CardTitle>
              <Badge variant={d.status === "online" ? "default" : "destructive"}>{d.status ?? "unknown"}</Badge>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">IP Address</span><span className="font-mono">{d.ip_address ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{d.location ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Last Sync</span><span>{d.last_sync ?? "Never"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Users Enrolled</span><span>{d.enrolled_count ?? "—"}</span></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
