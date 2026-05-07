"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, Route, Search, Pencil, Trash2, Map } from "lucide-react";

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

  if (isLoading) return <PageLoader />;

  const routesList = (data || []).filter((r: TransportRoute) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Route className="h-6 w-6" /> Transport Routes
          </h1>
          <p className="text-muted-foreground">Manage bus routes and paths</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Route
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search routes..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route Name</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Est. Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routesList.map((r: TransportRoute) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      <Map className="h-4 w-4 text-muted-foreground" />
                      {r.name}
                    </div>
                    {r.description && <div className="text-xs text-muted-foreground mt-1 max-w-md truncate">{r.description}</div>}
                  </TableCell>
                  <TableCell>{r.distance_km ? `${r.distance_km} km` : "—"}</TableCell>
                  <TableCell>{r.estimated_time_mins ? `${r.estimated_time_mins} mins` : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={r.is_active} 
                        onCheckedChange={(checked) => toggleStatusMutation.mutate({ id: r.id, is_active: checked })}
                        disabled={toggleStatusMutation.isPending}
                      />
                      <Badge variant={r.is_active ? "success" : "secondary"}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setEditItem(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if(confirm("Are you sure you want to delete this route?")) deleteMutation.mutate(r.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {routesList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No routes found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
    </div>
  );
}
