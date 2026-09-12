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
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { Fingerprint, Monitor, RefreshCw, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";

export default function BiometricPage() {
  return <PluginGate slug="biometric"><BiometricContent /></PluginGate>;
}

function BiometricContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["biometric-overview"],
    queryFn: async () => { const r = await api.get("/attendance/biometric/overview"); return r.data?.data ?? r.data; },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading biometric overview…" />;
    if (isError) {
      return (
        <AOSPage>
          <AOSPageHeader title="Biometric Integration" />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load biometric overview. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          </AOSPageBody>
        </AOSPage>
      );
    }

  const devices: any[] = data?.devices ?? [];
  const stats = data?.stats ?? {};

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Fingerprint className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Biometric Integration"
        subtitle={`ZKTeco fingerprint attendance · ${stats.online ?? devices.filter((d: any) => d.status === "online").length}/${stats.total_devices ?? devices.length} devices online`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/dashboard/biometric/logs">Sync Logs</Link></Button>
            <Button asChild><Link href="/dashboard/biometric/devices">Manage Devices</Link></Button>
          </div>
        }
      />
      <AOSPageBody>
        <StatGrid>
          {[
            { label: "Total Devices", value: stats.total_devices ?? devices.length, icon: <Monitor className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />, color: "var(--w11-accent)" },
            { label: "Online", value: stats.online ?? devices.filter((d: any) => d.status === "online").length, icon: <Wifi className="h-4 w-4" style={{ color: "#107c10" }} />, color: "#107c10" },
            { label: "Offline", value: stats.offline ?? devices.filter((d: any) => d.status !== "online").length, icon: <WifiOff className="h-4 w-4" style={{ color: "#c42b1c" }} />, color: "#c42b1c" },
            { label: "Today Syncs", value: stats.today_syncs ?? "—", icon: <RefreshCw className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} /> },
          ].map((s) => (
            <KpiCard key={s.label} label={s.label} value={s.value} icon={s.icon} color={s.color} />
          ))}
        </StatGrid>

        {/* Quick links — every biometric subpage from the plugin manifest */}
        <QuickLinks
          section="Operations"
          links={[
            { label: "Devices", href: "/dashboard/biometric/devices", icon: "Fingerprint" },
            { label: "Sync Logs", href: "/dashboard/biometric/logs", icon: "Database" },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.length === 0 ? (
            <DataPanel className="col-span-full">
              <AOSEmptyState
                icon={<Fingerprint className="h-12 w-12" />}
                title="No biometric devices configured"
                action={<Button className="mt-2" asChild><Link href="/dashboard/biometric/devices">Add Device</Link></Button>}
              />
            </DataPanel>
          ) : devices.map((d: any) => (
            <div key={d.id} className="win11-card">
              <div className="flex flex-row items-center justify-between mb-2">
                <span className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--w11-text-primary)" }}>
                  <Fingerprint className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />{d.name}
                </span>
                <span className={`win11-chip ${d.status === "online" ? "success" : "error"}`}>{d.status ?? "unknown"}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span style={{ color: "var(--w11-text-secondary)" }}>IP Address</span><span className="font-mono">{d.ip_address ?? "—"}</span></div>
                <div className="flex justify-between"><span style={{ color: "var(--w11-text-secondary)" }}>Location</span><span>{d.location ?? "—"}</span></div>
                <div className="flex justify-between"><span style={{ color: "var(--w11-text-secondary)" }}>Last Sync</span><span>{d.last_sync ?? "Never"}</span></div>
                <div className="flex justify-between"><span style={{ color: "var(--w11-text-secondary)" }}>Users Enrolled</span><span>{d.enrolled_count ?? "—"}</span></div>
              </div>
            </div>
          ))}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
