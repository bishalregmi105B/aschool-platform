"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { undoableDelete } from "@/components/ui/confirm-dialog";
import { DependencyMissingEmptyState } from "@/components/ui/empty-state";

export default function StopsPage() {
  return <AppGate slug="gps_tracking"><StopsContent /></AppGate>;
}

function StopsContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", sequence_number: "1", route_id: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["transport-stops"],
    queryFn: async () => (await api.get("/transport/stops")).data?.data || [],
  });

  // Routes are required for a stop (BusStop.route_id is NOT NULL).
  const { data: routesData } = useQuery({
    queryKey: ["transport-routes"],
    queryFn: async () => (await api.get("/transport/routes")).data?.data || [],
  });
  const routeNameById = Object.fromEntries(((routesData || []) as any[]).map((r) => [r.id, r.name]));
  const stops: any[] = (data || []).filter((s: any) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    routeNameById[s.route_id]?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm({ name: "", latitude: "", longitude: "", sequence_number: String((stops?.length || 0) + 1), route_id: (routesData || [])[0]?.id || "" }); setEditItem(null); setShowDialog(true); };
  const openEdit = (s: any) => { setForm({ name: s.name || "", latitude: String(s.latitude || ""), longitude: String(s.longitude || ""), sequence_number: String(s.sequence_number || 1), route_id: s.route_id || "" }); setEditItem(s); setShowDialog(true); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        route_id: form.route_id,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        sequence_number: parseInt(form.sequence_number) || 1,
      };
      if (!form.route_id) throw new Error("A route is required for a stop");
      if (editItem) return (await api.put(`/transport/stops/${editItem.id}`, payload)).data;
      return (await api.post("/transport/stops", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-stops"] });
      setShowDialog(false);
      toast.success(editItem ? "Stop updated" : "Stop added");
    },
    onError: (e: any) => toast.error(e?.message === "A route is required for a stop" ? e.message : "Failed to save stop"),
  });

  const STOP_COLUMNS: Column<any>[] = [
    { key: "sequence_number", label: "#", align: "right", sortable: true, value: (s) => s.sequence_number ?? 0, render: (s) => <span style={{ color: "var(--w11-text-secondary)" }}>{s.sequence_number}</span> },
    { key: "name", label: "Stop Name", sortable: true, value: (s) => s.name ?? "", render: (s) => <div className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />{s.name}</div> },
    { key: "route", label: "Route", sortable: true, value: (s) => routeNameById[s.route_id] ?? "", render: (s) => <span className="text-sm">{routeNameById[s.route_id] || "—"}</span> },
    { key: "coords", label: "Coordinates", value: (s) => (s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : ""), render: (s) => <span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : "—"}</span> },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (s) => (
        <span className="text-right space-x-1">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(s); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); undoableDelete({ label: `stop “${s.name}”`, commit: async () => { await api.delete(`/transport/stops/${s.id}`); queryClient.invalidateQueries({ queryKey: ["transport-stops"] }); } }); }}><Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} /></Button>
        </span>
      ),
    },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading stops…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<MapPin className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Pickup Stops"
        subtitle={`${stops.length} pickup and drop-off ${stops.length === 1 ? "point" : "points"}`}
        actions={
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Stop</Button>
        }
      />
      <AOSPageBody>
        {((routesData || []) as any[]).length === 0 ? (
          // Stops are meaningless without a route — point at the prerequisite.
          <DataPanel>
            <DependencyMissingEmptyState
              icon={MapPin}
              prerequisiteName="Transport routes"
              setupHref="/dashboard/transport/routes"
              setupLabel="Create a route first"
              title="No routes exist yet"
              body="Every stop belongs to a route. Create a route, then add its stops here."
            />
          </DataPanel>
        ) : (
        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={STOP_COLUMNS}
            rows={stops}
            rowKey={(s: any) => s.id}
            searchable
            searchPlaceholder="Search stops…"
            exportFileName="transport-stops"
            empty={{ icon: MapPin, title: "No stops defined yet", body: "Add stops to build your routes." }}
          />
        </DataPanel>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItem ? "Edit Stop" : "Add Stop"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Stop Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Baneshwor Chowk" /></div>
                <div className="space-y-2"><Label>Sequence #</Label><Input type="number" value={form.sequence_number} onChange={(e) => setForm({ ...form, sequence_number: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Route</Label>
                <AdvancedSelect
          value={form.route_id}
          onChange={(v) => setForm({ ...form, route_id: v })}
          options={(routesData || []).map((r: any) => ({ value: r.id, label: r.name }))}
        />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="27.7172" /></div>
                <div className="space-y-2"><Label>Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="85.3240" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => save.mutate()} disabled={!form.name || !form.route_id || save.isPending}>
                {save.isPending ? <Spinner className="mr-2" /> : null} {editItem ? "Update" : "Add Stop"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
