"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Plus, Route, Pencil, Trash2, Map } from "lucide-react";

interface TransportRoute {
  id: string;
  name: string;
  description: string;
  distance_km: number;
  estimated_time_mins: number;
  is_active: boolean;
}

export default function RoutesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<TransportRoute | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["transport-routes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TransportRoute[]>>("/transport/routes");
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post("/transport/routes", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
      toast.success("Route added");
      setShowAdd(false);
    },
    onError: () => toast.error("Failed to add route"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put(`/transport/routes/${editItem?.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
      toast.success("Route updated");
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update route"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transport/routes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
      toast.success("Route deleted");
    },
    onError: () => toast.error("Failed to delete route"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.put(`/transport/routes/${id}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
    },
    onError: () => toast.error("Failed to toggle status"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading routes…" />;

  const routesList = (data || []).filter((r: TransportRoute) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase())
  );

  const ROUTE_COLUMNS: Column<TransportRoute>[] = [
    {
      key: "name",
      label: "Route Name",
      sortable: true,
      value: (r) => r.name ?? "",
      render: (r) => (
        <div>
          <div className="font-medium flex items-center gap-2">
            <Map className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />
            {r.name}
          </div>
          {r.description && <div className="text-xs mt-1 max-w-md truncate" style={{ color: "var(--w11-text-secondary)" }}>{r.description}</div>}
        </div>
      ),
    },
    { key: "distance_km", label: "Distance", align: "right", sortable: true, value: (r) => r.distance_km ?? 0, render: (r) => (r.distance_km ? `${r.distance_km} km` : "—") },
    { key: "estimated_time_mins", label: "Est. Time", align: "right", sortable: true, value: (r) => r.estimated_time_mins ?? 0, render: (r) => (r.estimated_time_mins ? `${r.estimated_time_mins} mins` : "—") },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      value: (r) => (r.is_active ? "active" : "inactive"),
      render: (r) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={r.is_active}
            onCheckedChange={(checked) => toggleStatusMutation.mutate({ id: r.id, is_active: checked })}
            disabled={toggleStatusMutation.isPending}
          />
          <StatusChip status={r.is_active ? "active" : "inactive"} />
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditItem(r); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => {
            e.stopPropagation();
            if(confirm("Are you sure you want to delete this route?")) deleteMutation.mutate(r.id);
          }}>
            <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Route className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Transport Routes"
        subtitle={`${routesList.length} ${routesList.length === 1 ? "route" : "routes"} · ${routesList.filter((r) => r.is_active).length} active`}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Route
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable<TransportRoute>
            columns={ROUTE_COLUMNS}
            rows={routesList}
            rowKey={(r) => r.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search routes..."
            exportFileName="transport-routes"
            empty={{ icon: Route, title: "No routes found", body: "Add bus routes to organize student transport.", action: { label: "Add Route", onClick: () => setShowAdd(true) } }}
          />
        </DataPanel>

        <Dialog open={showAdd || !!editItem} onOpenChange={(open) => {
          if (!open) { setShowAdd(false); setEditItem(null); }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? "Edit Route" : "Add Route"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload = {
                  name: fd.get("name"),
                  description: fd.get("description"),
                  distance_km: fd.get("distance_km") ? Number(fd.get("distance_km")) : undefined,
                  estimated_time_mins: fd.get("estimated_time_mins") ? Number(fd.get("estimated_time_mins")) : undefined,
                };
                if (editItem) updateMutation.mutate(payload);
                else createMutation.mutate(payload);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Route Name</Label>
                <Input name="name" required defaultValue={editItem?.name} placeholder="e.g. Ring Road Express" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input name="description" defaultValue={editItem?.description} placeholder="Key stops or areas covered" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Distance (km)</Label>
                  <Input name="distance_km" type="number" step="0.1" defaultValue={editItem?.distance_km} />
                </div>
                <div className="space-y-2">
                  <Label>Estimated Time (mins)</Label>
                  <Input name="estimated_time_mins" type="number" defaultValue={editItem?.estimated_time_mins} />
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
