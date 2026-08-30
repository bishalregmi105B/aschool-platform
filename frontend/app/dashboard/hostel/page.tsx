"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/spinner";
import { Building2, BedDouble, Users, Plus, UserX } from "lucide-react";

// Backend GET /hostel/summary returns an array of per-hostel stats:
// {hostel_id, hostel_name, type, total_rooms, total_capacity, occupied, available, occupancy_pct}
// (totals are derived client-side). GET /hostel/allocations rows now carry
// room_number/hostel_name/monthly_fee from the backend serializer.
interface HostelStat { hostel_id: string; hostel_name: string; type: string; total_rooms: number; total_capacity: number; occupied: number; available: number; occupancy_pct: number; }
interface HostelSummary { total_hostels: number; total_capacity: number; total_occupied: number; total_available: number; occupancy_rate: number; hostels: HostelStat[]; }
interface HostelRoom { id: string; hostel_id: string; room_number: string; floor?: number | string; room_type?: string; capacity: number; occupied_count: number; is_full: boolean; monthly_fee?: number; }
interface HostelAllocation { id: string; student_id: string; room_id: string; student_name: string; student_roll?: number; hostel_name?: string; room_number?: string; check_in_date?: string; check_out_date?: string; status?: string; monthly_fee?: number; }

function deriveSummary(stats: HostelStat[] | null | undefined): HostelSummary | null {
  if (!stats) return null;
  const total_capacity = stats.reduce((s, h) => s + (h.total_capacity || 0), 0);
  const total_occupied = stats.reduce((s, h) => s + (h.occupied || 0), 0);
  const total_available = stats.reduce((s, h) => s + (h.available || 0), 0);
  return {
    total_hostels: stats.length,
    total_capacity,
    total_occupied,
    total_available,
    occupancy_rate: total_capacity ? (total_occupied / total_capacity) * 100 : 0,
    hostels: stats,
  };
}

function fmt(v?: number) { return v != null ? `Rs. ${v.toLocaleString()}` : "—"; }

export default function HostelPage() {
  return (
    <PluginGate slug="hostel">
      <HostelContent />
    </PluginGate>
  );
}

function HostelContent() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [selHostel, setSelHostel] = useState("");

  const { data: rawSummary, isLoading: sl, isError: se, refetch: srefetch } = useQuery({
    queryKey: ["hostel-summary"],
    queryFn: async () => { const r = await api.get("/hostel/summary"); return (r.data?.data ?? []) as HostelStat[]; },
    retry: 1,
  });
  const summary = deriveSummary(rawSummary);

  const { data: rooms, isLoading: rl, isError: re, refetch: rrefetch } = useQuery({
    queryKey: ["hostel-rooms", selHostel],
    enabled: tab === "rooms",
    queryFn: async () => { const p = selHostel ? `?hostel_id=${selHostel}` : ""; const r = await api.get(`/hostel/rooms${p}`); return (r.data?.data ?? []) as HostelRoom[]; },
    retry: 1,
  });

  const { data: allocs, isLoading: al, isError: ae, refetch: arefetch } = useQuery({
    queryKey: ["hostel-allocations"],
    enabled: tab === "allocations",
    queryFn: async () => { const r = await api.get("/hostel/allocations?per_page=50"); return (r.data?.data ?? []) as HostelAllocation[]; },
    retry: 1,
  });

  const checkout = useMutation({
    mutationFn: (id: string) => api.post(`/hostel/allocations/${id}/checkout`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostel-allocations"] }); qc.invalidateQueries({ queryKey: ["hostel-summary"] }); toast.success("Checked out"); },
    onError: () => toast.error("Checkout failed"),
  });

  const hostels = summary?.hostels ?? [];
  if (sl && tab === "overview") return <PageLoader />;
  if (se) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load hostel data. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => srefetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" />Hostel Management</h1>
          <p className="text-sm text-muted-foreground">Manage hostels, rooms and student allocations</p>
        </div>
        <Button onClick={() => setShowAddHostel(true)}><Plus className="mr-2 h-4 w-4" />Add Hostel</Button>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Hostels", value: summary.total_hostels, icon: <Building2 className="h-5 w-5 text-blue-600" />, bg: "bg-blue-50" },
            { label: "Total Capacity", value: summary.total_capacity, icon: <BedDouble className="h-5 w-5 text-green-600" />, bg: "bg-green-50" },
            { label: "Occupied", value: summary.total_occupied, icon: <Users className="h-5 w-5 text-orange-600" />, bg: "bg-orange-50" },
            { label: "Available", value: summary.total_available, icon: <BedDouble className="h-5 w-5 text-purple-600" />, bg: "bg-purple-50", sub: `${summary.occupancy_rate?.toFixed(0)}% occupancy` },
          ].map((s) => (
            <Card key={s.label}><CardContent className="pt-4 flex items-center gap-4">
              <div className={`rounded-lg p-2.5 ${s.bg}`}>{s.icon}</div>
              <div><p className="text-2xl font-bold">{s.value}</p><p className="text-sm text-muted-foreground">{s.label}</p>{s.sub && <p className="text-xs text-muted-foreground">{s.sub}</p>}</div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="overview">Hostels</TabsTrigger><TabsTrigger value="rooms">Rooms</TabsTrigger><TabsTrigger value="allocations">Allocations</TabsTrigger></TabsList>

        <TabsContent value="overview" className="mt-4">
          {hostels.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center"><Building2 className="h-10 w-10 text-muted-foreground/40" /><p className="font-semibold">No hostels yet</p><p className="text-sm text-muted-foreground">Add your first hostel to start managing accommodation</p></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hostels.map((h) => (
                <Card key={h.hostel_id}><CardContent className="pt-4 space-y-3">
                  <div className="flex justify-between gap-2">
                    <div><p className="font-semibold">{h.hostel_name}</p><p className="text-xs text-muted-foreground capitalize">{h.type}</p></div>
                    <Badge variant="outline" className="capitalize">{h.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{h.occupied}</span>/{h.total_capacity} occupied · <span className="text-green-600 font-medium">{h.available}</span> free · {h.total_rooms} rooms</p>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => { setSelHostel(h.hostel_id); setTab("rooms"); }}>View Rooms</Button>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rooms" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <select className="rounded border bg-background px-3 py-1.5 text-sm" value={selHostel} onChange={(e) => setSelHostel(e.target.value)}>
              <option value="">All Hostels</option>
              {hostels.map((h) => <option key={h.hostel_id} value={h.hostel_id}>{h.hostel_name}</option>)}
            </select>
            <Button size="sm" onClick={() => setShowAddRoom(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add Room</Button>
          </div>
          {rl ? <PageLoader /> : re ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-destructive">Failed to load rooms.</p>
              <Button size="sm" variant="outline" onClick={() => rrefetch()}>Retry</Button>
            </div>
          ) : !rooms?.length ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center"><BedDouble className="h-10 w-10 text-muted-foreground/40" /><p className="font-semibold">No rooms</p><p className="text-sm text-muted-foreground">Add rooms to this hostel</p></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rooms.map((r) => (
                <Card key={r.id} className={r.is_full ? "border-red-200" : ""}><CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2"><p className="font-semibold">Room {r.room_number}</p><Badge variant={r.is_full ? "destructive" : "success"} className="text-xs">{r.is_full ? "Full" : "Available"}</Badge></div>
                  <p className="text-sm text-muted-foreground">{r.occupied_count}/{r.capacity} beds</p>
                  {r.room_type && <p className="text-xs text-muted-foreground capitalize mt-1">{r.room_type}</p>}
                  {r.monthly_fee != null && <p className="text-xs font-medium text-green-700 mt-1">{fmt(r.monthly_fee)}/mo</p>}
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="allocations" className="mt-4">
          {al ? <PageLoader /> : ae ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-destructive">Failed to load allocations.</p>
              <Button size="sm" variant="outline" onClick={() => arefetch()}>Retry</Button>
            </div>
          ) : !allocs?.length ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center"><Users className="h-10 w-10 text-muted-foreground/40" /><p className="font-semibold">No allocations</p><p className="text-sm text-muted-foreground">Students have not been allocated to hostel rooms yet</p></div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="px-4 py-3 text-left">Student</th><th className="px-4 py-3 text-left">Hostel / Room</th><th className="px-4 py-3 text-left">Allocated</th><th className="px-4 py-3 text-left">Fee</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Action</th></tr></thead>
                <tbody>
                  {allocs.map((a, i) => (
                    <tr key={a.id} className={i % 2 ? "bg-muted/20" : ""}>
                      <td className="px-4 py-2.5"><p className="font-medium">{a.student_name}</p>{a.student_roll != null && <p className="text-xs text-muted-foreground">Roll: {a.student_roll}</p>}</td>
                      <td className="px-4 py-2.5"><p>{a.hostel_name || "—"}</p><p className="text-xs text-muted-foreground">Room {a.room_number || "—"}</p></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{a.check_in_date ? new Date(a.check_in_date).toLocaleDateString("ne-NP") : "—"}</td>
                      <td className="px-4 py-2.5 text-green-700 font-medium">{fmt(a.monthly_fee)}</td>
                      <td className="px-4 py-2.5">{(a.status === "checked_out" || a.check_out_date) ? <Badge variant="outline" className="text-xs">Checked Out</Badge> : <Badge variant="success" className="text-xs">Active</Badge>}</td>
                      <td className="px-4 py-2.5">{!(a.status === "checked_out" || a.check_out_date) && <Button size="sm" variant="outline" className="text-destructive border-destructive/30 h-7 text-xs" onClick={() => { if (confirm(`Check out ${a.student_name}?`)) checkout.mutate(a.id); }}><UserX className="mr-1 h-3 w-3" />Checkout</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddHostelDialog open={showAddHostel} onClose={() => setShowAddHostel(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["hostel-summary"] }); setShowAddHostel(false); }} />
      <AddRoomDialog open={showAddRoom} hostels={hostels} defaultHostelId={selHostel} onClose={() => setShowAddRoom(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["hostel-rooms"] }); setShowAddRoom(false); }} />
    </div>
  );
}

function AddHostelDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", gender: "male", warden_name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    // Backend contract: POST /hostel {name, type(boys|girls|mixed), warden_name, warden_phone, description}
    try { await api.post("/hostel", { name: f.name.trim(), type: f.gender === "male" ? "boys" : f.gender === "female" ? "girls" : "mixed", warden_name: f.warden_name || undefined, warden_phone: f.phone || undefined, description: f.address || undefined }); onSaved(); toast.success("Hostel added"); setF({ name: "", gender: "male", warden_name: "", phone: "", address: "" }); }
    catch { toast.error("Failed to add hostel"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent><DialogHeader><DialogTitle>Add Hostel</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Boys Hostel Block A" /></div>
          <div className="space-y-1.5"><Label>Gender</Label><select className="w-full rounded border bg-background px-3 py-2 text-sm" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="male">Male</option><option value="female">Female</option><option value="mixed">Mixed</option></select></div>
          <div className="space-y-1.5"><Label>Warden Name</Label><Input value={f.warden_name} onChange={(e) => setF({ ...f, warden_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div></div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Add"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRoomDialog({ open, hostels, defaultHostelId, onClose, onSaved }: { open: boolean; hostels: HostelStat[]; defaultHostelId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ hostel_id: defaultHostelId || hostels[0]?.hostel_id || "", room_number: "", capacity: "4", room_type: "standard", floor: "0", monthly_fee: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.hostel_id) { toast.error("Select hostel"); return; }
    if (!f.room_number.trim()) { toast.error("Room number required"); return; }
    setSaving(true);
    try { await api.post("/hostel/rooms", { ...f, capacity: parseInt(f.capacity) || 4, floor: parseInt(f.floor) || 0, monthly_fee: f.monthly_fee ? parseFloat(f.monthly_fee) : undefined }); onSaved(); toast.success("Room added"); setF({ ...f, room_number: "", monthly_fee: "" }); }
    catch { toast.error("Failed to add room"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent><DialogHeader><DialogTitle>Add Room</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Hostel *</Label><select className="w-full rounded border bg-background px-3 py-2 text-sm" value={f.hostel_id} onChange={(e) => setF({ ...f, hostel_id: e.target.value })}>{hostels.map((h) => <option key={h.hostel_id} value={h.hostel_id}>{h.hostel_name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Room Number *</Label><Input value={f.room_number} onChange={(e) => setF({ ...f, room_number: e.target.value })} placeholder="e.g. 101" /></div>
            <div className="space-y-1.5"><Label>Capacity (beds)</Label><Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} min={1} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Floor</Label><Input type="number" value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Monthly Fee (Rs)</Label><Input type="number" value={f.monthly_fee} onChange={(e) => setF({ ...f, monthly_fee: e.target.value })} placeholder="e.g. 3000" /></div>
          </div>
          <div className="space-y-1.5"><Label>Room Type</Label><select className="w-full rounded border bg-background px-3 py-2 text-sm" value={f.room_type} onChange={(e) => setF({ ...f, room_type: e.target.value })}><option value="standard">Standard</option><option value="premium">Premium</option><option value="dormitory">Dormitory</option><option value="single">Single</option></select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Add"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
