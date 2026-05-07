"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, Building, Users, Bed } from "lucide-react";

export default function HostelPage() {
  return <PluginGate slug="hostel"><HostelContent /></PluginGate>;
}

function HostelContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", type: "boys", capacity: "", warden_name: "", floor: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["hostel-rooms"],
    queryFn: async () => { const r = await api.get("/hostel/rooms"); return r.data; },
  });

  const rooms = data?.data || [];
  const stats = { total_rooms: rooms.length, total_capacity: rooms.reduce((s: number, r: any) => s + (r.capacity || 0), 0), occupied: rooms.reduce((s: number, r: any) => s + (r.occupied || 0), 0) };

  const create = useMutation({
    mutationFn: async () => (await api.post("/hostel/rooms", { ...form, capacity: parseInt(form.capacity) })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hostel-rooms"] }); setShowDialog(false); toast.success("Room added!"); },
    onError: () => toast.error("Failed to add room"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Hostel Management</h1><p className="text-muted-foreground">Manage rooms, allocations, and hostel facilities</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Room</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><Building className="h-5 w-5 mb-2 text-muted-foreground" /><p className="text-2xl font-bold">{stats.total_rooms}</p><p className="text-sm text-muted-foreground">Total Rooms</p></CardContent></Card>
        <Card><CardContent className="pt-6"><Bed className="h-5 w-5 mb-2 text-muted-foreground" /><p className="text-2xl font-bold">{stats.total_capacity}</p><p className="text-sm text-muted-foreground">Total Capacity</p></CardContent></Card>
        <Card><CardContent className="pt-6"><Users className="h-5 w-5 mb-2 text-muted-foreground" /><p className="text-2xl font-bold">{stats.occupied}</p><p className="text-sm text-muted-foreground">Occupied Beds</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Type</TableHead><TableHead>Floor</TableHead><TableHead>Capacity</TableHead><TableHead>Occupied</TableHead><TableHead>Warden</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rooms.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No rooms added yet</TableCell></TableRow>
              ) : rooms.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                  <TableCell>{r.floor || "—"}</TableCell>
                  <TableCell>{r.capacity}</TableCell>
                  <TableCell>{r.occupied || 0}</TableCell>
                  <TableCell>{r.warden_name || "—"}</TableCell>
                  <TableCell><Badge variant={(r.occupied || 0) >= (r.capacity || 1) ? "destructive" : "default"}>{(r.occupied || 0) >= (r.capacity || 1) ? "Full" : "Available"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Room</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Room Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Room 101" /></div>
              <div className="space-y-2"><Label>Type</Label><select className="w-full border rounded-md p-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="boys">Boys</option><option value="girls">Girls</option></select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
              <div className="space-y-2"><Label>Floor</Label><Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Warden Name</Label><Input value={form.warden_name} onChange={(e) => setForm({ ...form, warden_name: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || !form.capacity || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Add Room</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
