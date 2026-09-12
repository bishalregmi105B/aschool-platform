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
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Bus, Plus, Pencil } from "lucide-react";

export default function BusesPage() {
  return <PluginGate slug="gps_tracking"><BusesContent /></PluginGate>;
}

function BusesContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ vehicle_number: "", model: "", capacity: "40", gps_device_id: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["transport-buses"],
    queryFn: async () => (await api.get("/transport/buses")).data?.data || [],
  });

  const buses: any[] = (data || []).filter((b: any) =>
    b.vehicle_number?.toLowerCase().includes(search.toLowerCase()) ||
    b.gps_device_id?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm({ vehicle_number: "", model: "", capacity: "40", gps_device_id: "" }); setEditItem(null); setShowDialog(true); };
  const openEdit = (b: any) => { setForm({ vehicle_number: b.vehicle_number || "", model: b.model || "", capacity: String(b.capacity || 40), gps_device_id: b.gps_device_id || "" }); setEditItem(b); setShowDialog(true); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, capacity: parseInt(form.capacity) || 40, gps_device_id: form.gps_device_id || undefined };
      if (editItem) return (await api.put(`/transport/buses/${editItem.id}`, payload)).data;
      return (await api.post("/transport/buses", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-buses"] });
      setShowDialog(false);
      toast.success(editItem ? "Bus updated" : "Bus added");
    },
    onError: () => toast.error("Failed to save bus"),
  });

  const BUS_COLUMNS: Column<any>[] = [
    { key: "vehicle_number", label: "Number Plate", sortable: true, value: (b) => b.vehicle_number ?? "", render: (b) => <div className="flex items-center gap-2 font-medium"><Bus className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />{b.vehicle_number}</div> },
    { key: "model", label: "Model", sortable: true, value: (b) => b.model ?? "", render: (b) => b.model || "—" },
    { key: "capacity", label: "Capacity", align: "right", sortable: true, value: (b) => b.capacity ?? 0, render: (b) => <span className="win11-chip subtle">{b.capacity} seats</span> },
    { key: "gps_device_id", label: "GPS Device", value: (b) => b.gps_device_id ?? "", render: (b) => b.gps_device_id || "—" },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (b) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(b); }}><Pencil className="h-4 w-4" /></Button>
      ),
    },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading buses…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bus className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Buses"
        subtitle={`${buses.length} ${buses.length === 1 ? "vehicle" : "vehicles"} in the fleet`}
        actions={
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Bus</Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={BUS_COLUMNS}
            rows={buses}
            rowKey={(b: any) => b.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search buses..."
            exportFileName="buses"
            empty={{ icon: Bus, title: "No buses found", body: "Add your first bus to start transport management.", action: { label: "Add Bus", onClick: openAdd } }}
          />
        </DataPanel>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItem ? "Edit Bus" : "Add Bus"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Number Plate</Label><Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder="BA 1 KHA 0001" /></div>
                <div className="space-y-2"><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Tata 407" /></div>
              </div>
              <div className="space-y-2"><Label>Capacity (seats)</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
              <div className="space-y-2"><Label>GPS Device ID</Label><Input value={form.gps_device_id} onChange={(e) => setForm({ ...form, gps_device_id: e.target.value })} placeholder="e.g. esp32-001" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => save.mutate()} disabled={!form.vehicle_number || save.isPending}>
                {save.isPending ? <Spinner className="mr-2" /> : null} {editItem ? "Update" : "Add Bus"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
