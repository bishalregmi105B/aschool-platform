"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FilterCommandBar,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Plus, MapPin, Pencil, Trash2 } from "lucide-react";

interface TransportRoute {
  id: string;
  name: string;
}

interface BusStop {
  id: string;
  route_id: string;
  name: string;
  name_nepali?: string;
  latitude?: number;
  longitude?: number;
  sequence_number?: number;
  arrival_time_am?: string;
  arrival_time_pm?: string;
}

export default function PickupPointsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<BusStop | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: routes } = useQuery({
    queryKey: ["transport-routes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TransportRoute[]>>("/transport/routes");
      return res.data.data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["transport-stops", selectedRouteId],
    queryFn: async () => {
      const url = selectedRouteId === "all" ? "/transport/stops" : `/transport/stops?route_id=${selectedRouteId}`;
      const res = await api.get<ApiResponse<BusStop[]>>(url);
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post("/transport/stops", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-stops"] });
      toast.success("Pickup point added");
      setShowAdd(false);
    },
    onError: () => toast.error("Failed to add pickup point"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put(`/transport/stops/${editItem?.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-stops"] });
      toast.success("Pickup point updated");
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update pickup point"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transport/stops/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-stops"] });
      toast.success("Pickup point deleted");
    },
    onError: () => toast.error("Failed to delete pickup point"),
  });

  const STOP_COLUMNS: Column<BusStop>[] = [
    { key: "sequence_number", label: "Seq", align: "right", sortable: true, value: (s) => s.sequence_number ?? 0, render: (s) => <span style={{ color: "var(--w11-text-secondary)" }}>{s.sequence_number}</span> },
    { key: "name", label: "Stop Name", sortable: true, value: (s) => s.name, render: (s) => <span className="font-medium">{s.name}</span> },
    {
      key: "route",
      label: "Route",
      sortable: true,
      value: (s) => routes?.find((r: any) => r.id === s.route_id)?.name ?? "",
      render: (s) => routes?.find((r: any) => r.id === s.route_id)?.name || "Unknown Route",
    },
    { key: "arrival_time_am", label: "Morning Time", sortable: true, value: (s) => s.arrival_time_am ?? "", render: (s) => (s.arrival_time_am ? s.arrival_time_am.slice(0, 5) : "—") },
    { key: "arrival_time_pm", label: "Afternoon Time", sortable: true, value: (s) => s.arrival_time_pm ?? "", render: (s) => (s.arrival_time_pm ? s.arrival_time_pm.slice(0, 5) : "—") },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (s) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditItem(s); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => {
            e.stopPropagation();
            if(confirm("Are you sure you want to delete this stop?")) deleteMutation.mutate(s.id);
          }}>
            <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading pickup points…" />;

  const stopsList = (data || []).filter((s: BusStop) =>
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<MapPin className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Pickup Points"
        subtitle={`${stopsList.length} bus ${stopsList.length === 1 ? "stop" : "stops"} and timings`}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Pickup Point
          </Button>
        }
      />
      <AOSPageBody>
        <FilterCommandBar>
          <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Route" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Routes</SelectItem>
              {(routes || []).map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterCommandBar>

        <DataPanel bodyClassName="p-0">
          <DataTable<BusStop>
            columns={STOP_COLUMNS}
            rows={stopsList}
            rowKey={(s) => s.id}
            searchable
            searchPlaceholder="Search stops…"
            exportFileName="pickup-points"
            empty={{ icon: MapPin, title: "No pickup points found", body: "Add stops with AM/PM arrival times." }}
          />
        </DataPanel>

        <Dialog open={showAdd || !!editItem} onOpenChange={(open) => {
          if (!open) { setShowAdd(false); setEditItem(null); }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? "Edit Pickup Point" : "Add Pickup Point"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload = {
                  name: fd.get("name"),
                  route_id: fd.get("route_id"),
                  sequence_number: fd.get("sequence_number") ? Number(fd.get("sequence_number")) : undefined,
                  arrival_time_am: fd.get("arrival_time_am") || undefined,
                  arrival_time_pm: fd.get("arrival_time_pm") || undefined,
                };
                if (editItem) updateMutation.mutate(payload);
                else createMutation.mutate(payload);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Route</Label>
                <Select name="route_id" defaultValue={editItem?.route_id} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a route" />
                  </SelectTrigger>
                  <SelectContent>
                    {(routes || []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stop Name</Label>
                <Input name="name" required defaultValue={editItem?.name} placeholder="e.g. Kalanki Chowk" />
              </div>
              <div className="space-y-2">
                <Label>Sequence Number</Label>
                <Input name="sequence_number" type="number" defaultValue={editItem?.sequence_number} placeholder="e.g. 1 (first stop)" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Arrival (Morning)</Label>
                  <TimePicker name="arrival_time_am" value={editItem?.arrival_time_am} />
                </div>
                <div className="space-y-2">
                  <Label>Arrival (Afternoon)</Label>
                  <TimePicker name="arrival_time_pm" value={editItem?.arrival_time_pm} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Spinner size="sm" /> : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
