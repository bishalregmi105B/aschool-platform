"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
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

const ALLOCATION_COLUMNS: Column<HostelAllocation>[] = [
  {
    key: "student_name",
    label: "Student",
    sortable: true,
    value: (a) => a.student_name,
    render: (a) => (
      <div>
        <p className="font-medium">{a.student_name}</p>
        {a.student_roll != null && <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Roll: {a.student_roll}</p>}
      </div>
    ),
  },
  {
    key: "room",
    label: "Hostel / Room",
    sortable: true,
    value: (a) => `${a.hostel_name ?? ""} ${a.room_number ?? ""}`,
    render: (a) => (
      <div>
        <p>{a.hostel_name || "—"}</p>
        <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Room {a.room_number || "—"}</p>
      </div>
    ),
  },
  {
    key: "check_in_date",
    label: "Allocated",
    sortable: true,
    value: (a) => a.check_in_date ?? "",
    render: (a) => (
      <span style={{ color: "var(--w11-text-secondary)" }}>
        {a.check_in_date ? new Date(a.check_in_date).toLocaleDateString("ne-NP") : "—"}
      </span>
    ),
  },
  { key: "monthly_fee", label: "Fee", align: "right", sortable: true, value: (a) => a.monthly_fee ?? 0, render: (a) => <span className="font-medium" style={{ color: "#107c10" }}>{fmt(a.monthly_fee)}</span> },
  {
    key: "status",
    label: "Status",
    sortable: true,
    value: (a) => a.status ?? "",
    render: (a) =>
      a.status === "checked_out" || a.check_out_date ? (
        <span className="win11-chip subtle text-xs">Checked Out</span>
      ) : (
        <StatusChip status="active" label="Active" className="text-xs" />
      ),
  },
  {
    key: "action",
    label: "Action",
    noExport: true,
    render: (a) =>
      !(a.status === "checked_out" || a.check_out_date) ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          style={{ color: "#c42b1c", borderColor: "rgba(196,43,28,0.3)" }}
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Check out ${a.student_name}?`)) checkout.mutate(a.id);
          }}
        >
          <UserX className="mr-1 h-3 w-3" />Checkout
        </Button>
      ) : null,
  },
];
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
  if (sl && tab === "overview") return <AOSModuleLoadingState label="Loading hostels…" />;
  if (se) {
    return (
      <AOSPage>
        <AOSPageHeader title="Hostel Management" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load hostel data. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => srefetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Building2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Hostel Management"
        subtitle={summary ? `${summary.total_hostels} hostels · ${summary.total_occupied}/${summary.total_capacity} beds occupied (${summary.occupancy_rate?.toFixed(0)}%)` : "Manage hostels, rooms and student allocations"}
        actions={
          <Button onClick={() => setShowAddHostel(true)}><Plus className="mr-2 h-4 w-4" />Add Hostel</Button>
        }
      />
      <AOSPageBody>
        {summary && (
          <StatGrid>
            <KpiCard label="Hostels" value={summary.total_hostels} icon={<Building2 className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />} />
            <KpiCard label="Total Capacity" value={summary.total_capacity} color="#107c10" icon={<BedDouble className="h-4 w-4" style={{ color: "#107c10" }} />} />
            <KpiCard label="Occupied" value={summary.total_occupied} color="#d83b01" icon={<Users className="h-4 w-4" style={{ color: "#d83b01" }} />} />
            <KpiCard label="Available" value={summary.total_available} footnote={`${summary.occupancy_rate?.toFixed(0)}% occupancy`} icon={<BedDouble className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />} />
          </StatGrid>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList><TabsTrigger value="overview">Hostels</TabsTrigger><TabsTrigger value="rooms">Rooms</TabsTrigger><TabsTrigger value="allocations">Allocations</TabsTrigger></TabsList>

          <TabsContent value="overview" className="mt-4">
            {hostels.length === 0 ? (
              <DataPanel>
                <AOSEmptyState icon={<Building2 className="h-10 w-10" />} title="No hostels yet" description="Add your first hostel to start managing accommodation" />
              </DataPanel>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {hostels.map((h) => (
                  <div key={h.hostel_id} className="win11-card space-y-3">
                    <div className="flex justify-between gap-2">
                      <div><p className="font-semibold" style={{ color: "var(--w11-text-primary)" }}>{h.hostel_name}</p><p className="text-xs capitalize" style={{ color: "var(--w11-text-secondary)" }}>{h.type}</p></div>
                      <span className="win11-chip subtle capitalize">{h.type}</span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}><span className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{h.occupied}</span>/{h.total_capacity} occupied · <span className="font-medium" style={{ color: "#107c10" }}>{h.available}</span> free · {h.total_rooms} rooms</p>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => { setSelHostel(h.hostel_id); setTab("rooms"); }}>View Rooms</Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rooms" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <AdvancedSelect className="w-44" value={selHostel} onChange={(v) => setSelHostel(v)} clearable placeholder="All Hostels"
                options={hostels.map((h) => ({ value: h.hostel_id, label: h.hostel_name }))} />
              <Button size="sm" onClick={() => setShowAddRoom(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add Room</Button>
            </div>
            {rl ? <AOSModuleLoadingState label="Loading rooms…" /> : re ? (
              <DataPanel className="max-w-2xl mx-auto">
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load rooms.</p>
                  <Button size="sm" variant="outline" onClick={() => rrefetch()}>Retry</Button>
                </div>
              </DataPanel>
            ) : !rooms?.length ? (
              <DataPanel>
                <AOSEmptyState icon={<BedDouble className="h-10 w-10" />} title="No rooms" description="Add rooms to this hostel" />
              </DataPanel>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rooms.map((r) => (
                  <div key={r.id} className="win11-card" style={r.is_full ? { borderColor: "#c42b1c" } : undefined}>
                    <div className="flex items-center justify-between mb-2"><p className="font-semibold" style={{ color: "var(--w11-text-primary)" }}>Room {r.room_number}</p><span className={`win11-chip text-xs ${r.is_full ? "error" : "success"}`}>{r.is_full ? "Full" : "Available"}</span></div>
                    <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{r.occupied_count}/{r.capacity} beds</p>
                    {r.room_type && <p className="text-xs capitalize mt-1" style={{ color: "var(--w11-text-secondary)" }}>{r.room_type}</p>}
                    {r.monthly_fee != null && <p className="text-xs font-medium mt-1" style={{ color: "#107c10" }}>{fmt(r.monthly_fee)}/mo</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>



          <TabsContent value="allocations" className="mt-4">
            {al ? <AOSModuleLoadingState label="Loading allocations…" /> : ae ? (
              <DataPanel className="max-w-2xl mx-auto">
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load allocations.</p>
                  <Button size="sm" variant="outline" onClick={() => arefetch()}>Retry</Button>
                </div>
              </DataPanel>
            ) : !allocs?.length ? (
              <DataPanel>
                <AOSEmptyState icon={<Users className="h-10 w-10" />} title="No allocations" description="Students have not been allocated to hostel rooms yet" />
              </DataPanel>
            ) : (
              <DataPanel bodyClassName="p-0">
                <DataTable
                  columns={ALLOCATION_COLUMNS}
                  rows={allocs}
                  rowKey={(a: any) => a.id}
                  searchable
                  searchPlaceholder="Search students…"
                  exportFileName="hostel-allocations"
                  dense
                />
              </DataPanel>
            )}
          </TabsContent>
        </Tabs>

        <AddHostelDialog open={showAddHostel} onClose={() => setShowAddHostel(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["hostel-summary"] }); setShowAddHostel(false); }} />
        <AddRoomDialog open={showAddRoom} hostels={hostels} defaultHostelId={selHostel} onClose={() => setShowAddRoom(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["hostel-rooms"] }); setShowAddRoom(false); }} />
      </AOSPageBody>
    </AOSPage>
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
          <div className="space-y-1.5"><Label>Gender</Label><AdvancedSelect
          value={f.gender}
          onChange={(v) => setF({ ...f, gender: v })}
          options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'mixed', label: 'Mixed' }]}
        /></div>
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
          <div className="space-y-1.5"><Label>Hostel *</Label><AdvancedSelect value={f.hostel_id} onChange={(v) => setF({ ...f, hostel_id: v })}
            options={hostels.map((h) => ({ value: h.hostel_id, label: h.hostel_name }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Room Number *</Label><Input value={f.room_number} onChange={(e) => setF({ ...f, room_number: e.target.value })} placeholder="e.g. 101" /></div>
            <div className="space-y-1.5"><Label>Capacity (beds)</Label><Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} min={1} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Floor</Label><Input type="number" value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Monthly Fee (Rs)</Label><Input type="number" value={f.monthly_fee} onChange={(e) => setF({ ...f, monthly_fee: e.target.value })} placeholder="e.g. 3000" /></div>
          </div>
          <div className="space-y-1.5"><Label>Room Type</Label><AdvancedSelect
          value={f.room_type}
          onChange={(v) => setF({ ...f, room_type: v })}
          options={[{ value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }, { value: 'dormitory', label: 'Dormitory' }, { value: 'single', label: 'Single' }]}
        /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Add"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
