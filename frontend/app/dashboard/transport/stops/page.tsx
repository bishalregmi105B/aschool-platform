"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { MapPin, Plus, Pencil, Trash2, Search } from "lucide-react";

export default function StopsPage() {
  return <PluginGate slug="gps_tracking"><StopsContent /></PluginGate>;
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

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/transport/stops/${id}`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["transport-stops"] }); toast.success("Stop removed"); },
    onError: () => toast.error("Failed to remove stop"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="h-6 w-6" /> Pickup Stops</h1>
          <p className="text-muted-foreground">Manage bus pickup and drop-off points</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Stop</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search stops..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Stop Name</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Coordinates</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stops.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No stops defined yet</TableCell></TableRow>
            ) : stops.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground">{s.sequence_number}</TableCell>
                <TableCell className="font-medium"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{s.name}</div></TableCell>
                <TableCell className="text-sm">{routeNameById[s.route_id] || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(s.id)} disabled={remove.isPending}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

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
              <select className="w-full border rounded-md p-2" value={form.route_id} onChange={(e) => setForm({ ...form, route_id: e.target.value })}>
                <option value="">Select a route…</option>
                {(routesData || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
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
    </div>
  );
}
