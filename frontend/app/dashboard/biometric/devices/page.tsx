"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Monitor, Plus, RefreshCw } from "lucide-react";

export default function BiometricDevicesPage() {
  return <PluginGate slug="biometric"><DevicesContent /></PluginGate>;
}

function DevicesContent() {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", ip_address: "", port: "4370", location: "", serial_number: "" });
  // The backend returns the device API key exactly once (only its SHA-256
  // hash is stored) — surface it for copy-paste or the device can never
  // authenticate against /ingest + /heartbeat (E141).
  const [newKey, setNewKey] = useState<{ name: string; apiKey: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["biometric-devices"],
    queryFn: async () => { const r = await api.get("/attendance/biometric/devices"); return r.data?.data ?? r.data; },
  });

  const devices: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/attendance/biometric/devices", form)).data,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["biometric-devices"] });
      setShowDialog(false);
      setForm({ name: "", ip_address: "", port: "4370", location: "", serial_number: "" });
      const created = res?.data ?? res;
      if (created?.api_key) {
        setNewKey({ name: created.name ?? "Device", apiKey: created.api_key });
        toast.success("Device added — copy the API key now, it is shown only once");
      } else {
        toast.success("Device added");
      }
    },
    onError: () => toast.error("Failed to add device"),
  });

  const syncDevice = useMutation({
    mutationFn: async (id: string) => (await api.post(`/attendance/biometric/devices/${id}/sync`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["biometric-devices"] }); toast.success("Sync initiated"); },
    onError: () => toast.error("Sync failed"),
  });

  const DEVICE_COLUMNS: Column<any>[] = [
    { key: "name", label: "Name", sortable: true, value: (d) => d.name ?? "", render: (d) => <span className="font-medium flex items-center gap-2"><Monitor className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />{d.name}</span> },
    { key: "endpoint", label: "IP Address", value: (d) => `${d.ip_address ?? ""}:${d.port ?? 4370}`, render: (d) => <span className="font-mono">{d.ip_address}:{d.port ?? 4370}</span> },
    { key: "location", label: "Location", sortable: true, value: (d) => d.location ?? "", render: (d) => d.location ?? "—" },
    { key: "serial_number", label: "Serial No.", value: (d) => d.serial_number ?? "", render: (d) => <span className="font-mono text-xs">{d.serial_number ?? "—"}</span> },
    { key: "status", label: "Status", sortable: true, value: (d) => d.status ?? "", render: (d) => <StatusChip status={d.status === "online" ? "active" : "failed"} label={d.status ?? "unknown"} /> },
    { key: "last_sync", label: "Last Sync", value: (d) => d.last_sync ?? "", render: (d) => d.last_sync ?? "Never" },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (d) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); syncDevice.mutate(d.id); }} disabled={syncDevice.isPending}>
          <RefreshCw className="h-3 w-3 mr-1" />Sync
        </Button>
      ),
    },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading devices…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Monitor className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Biometric Devices"
        subtitle={`${devices.length} ZKTeco ${devices.length === 1 ? "device" : "devices"}`}
        actions={
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />Add Device</Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={DEVICE_COLUMNS}
            rows={devices}
            rowKey={(d: any) => d.id}
            searchable
            searchPlaceholder="Search devices…"
            exportFileName="biometric-devices"
            empty={{ icon: Monitor, title: "No devices configured", body: "Add a ZKTeco device — the API key is shown once at creation.", action: { label: "Add Device", onClick: () => setShowDialog(true) } }}
          />
        </DataPanel>

        {/* One-time API key dialog (E141) */}
        <Dialog open={!!newKey} onOpenChange={(open) => { if (!open) setNewKey(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Device API Key — shown once</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                Copy the key for <strong>{newKey?.name}</strong> now. It is stored only as a hash and
                cannot be viewed again — the device authenticates with the{" "}
                <code className="font-mono text-xs">X-Device-Key</code> header on ingest and heartbeat.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={newKey?.apiKey ?? ""} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button
                  variant="outline"
                  onClick={() => { if (newKey) { navigator.clipboard?.writeText(newKey.apiKey); toast.success("API key copied"); } }}
                >
                  Copy
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setNewKey(null)}>I&apos;ve stored the key</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Biometric Device</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Device Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Gate ZKTeco" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>IP Address</Label><Input value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} placeholder="192.168.1.100" /></div>
                <div className="space-y-2"><Label>Port</Label><Input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="4370" /></div>
              </div>
              <div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Main Entrance" /></div>
              <div className="space-y-2"><Label>Serial Number</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.ip_address}>{create.isPending ? <Spinner /> : "Add Device"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
