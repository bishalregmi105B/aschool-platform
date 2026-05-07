"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, MapPin, Search, Pencil, Trash2 } from "lucide-react";

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

  if (isLoading) return <PageLoader />;

  const stopsList = (data || []).filter((s: BusStop) =>
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" /> Pickup Points
          </h1>
          <p className="text-muted-foreground">Manage bus stops and timings along routes</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Pickup Point
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pickup points..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seq</TableHead>
                <TableHead>Stop Name</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Morning Time</TableHead>
                <TableHead>Afternoon Time</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stopsList.map((s: BusStop) => {
                const routeName = routes?.find(r => r.id === s.route_id)?.name || "Unknown Route";
                return (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{s.sequence_number}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{routeName}</TableCell>
                    <TableCell>{s.arrival_time_am ? s.arrival_time_am.slice(0, 5) : "—"}</TableCell>
                    <TableCell>{s.arrival_time_pm ? s.arrival_time_pm.slice(0, 5) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setEditItem(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if(confirm("Are you sure you want to delete this stop?")) deleteMutation.mutate(s.id);
                        }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {stopsList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No pickup points found.
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
                <Input name="arrival_time_am" type="time" defaultValue={editItem?.arrival_time_am} />
              </div>
              <div className="space-y-2">
                <Label>Arrival (Afternoon)</Label>
                <Input name="arrival_time_pm" type="time" defaultValue={editItem?.arrival_time_pm} />
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
