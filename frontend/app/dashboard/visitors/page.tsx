"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { UserCheck, Plus, LogIn, LogOut, Search } from "lucide-react";

export default function VisitorsPage() {
  return <PluginGate slug="visitors"><VisitorsContent /></PluginGate>;
}

function VisitorsContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", purpose: "meeting", visiting_whom: "", id_type: "citizenship", id_number: "", vehicle_no: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["visitors", search],
    queryFn: async () => {
      const r = await api.get("/visitors", { params: { search: search || undefined } });
      return r.data?.data || [];
    },
  });

  const visitors = data || [];
  const today = new Date().toDateString();
  const stats = {
    today: visitors.filter((v: any) => v.checked_in_at && new Date(v.checked_in_at).toDateString() === today).length,
    currently_in: visitors.filter((v: any) => !v.checked_out_at).length,
    this_month: visitors.filter((v: any) => {
      if (!v.checked_in_at) return false;
      const date = new Date(v.checked_in_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length,
    avg_per_day: visitors.length ? Math.max(1, Math.round(visitors.length / 30)) : 0,
  };

  const checkIn = useMutation({
    mutationFn: async () =>
      (
        await api.post("/visitors/checkin", {
          ...form,
          notes: [form.visiting_whom, form.vehicle_no].filter(Boolean).join(" | "),
        })
      ).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["visitors"] }); setShowDialog(false); toast.success("Visitor checked in"); },
    onError: () => toast.error("Check-in failed"),
  });

  const checkOut = useMutation({
    mutationFn: async (id: string) => (await api.post(`/visitors/${id}/checkout`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["visitors"] }); toast.success("Visitor checked out"); },
    onError: () => toast.error("Check-out failed"),
  });

  const VISITOR_COLUMNS: Column<any>[] = [
    { key: "name", label: "Name", sortable: true, value: (v) => v.name ?? "", render: (v) => <div className="flex items-center gap-2 font-medium"><UserCheck className="h-4 w-4 text-muted-foreground" />{v.name}</div> },
    { key: "phone", label: "Phone", value: (v) => v.phone ?? "", render: (v) => v.phone || "—" },
    { key: "purpose", label: "Purpose", sortable: true, value: (v) => v.purpose ?? "", render: (v) => <Badge variant="outline">{v.purpose}</Badge> },
    { key: "visiting", label: "Visiting", value: (v) => v.visiting_staff_id ?? "", render: (v) => v.visiting_staff_id || "—" },
    { key: "checked_in_at", label: "Check In", sortable: true, value: (v) => v.checked_in_at ?? "", render: (v) => <span className="text-sm">{v.checked_in_at ? new Date(v.checked_in_at).toLocaleTimeString() : "—"}</span> },
    { key: "checked_out_at", label: "Check Out", sortable: true, value: (v) => v.checked_out_at ?? "", render: (v) => <span className="text-sm">{v.checked_out_at ? new Date(v.checked_out_at).toLocaleTimeString() : "—"}</span> },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (v) => (v.checked_out_at ? "left" : "in-campus"),
      render: (v) => <Badge variant={v.checked_out_at ? "default" : "secondary"}>{v.checked_out_at ? "Left" : "In Campus"}</Badge>,
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (v) => (!v.checked_out_at ? (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); checkOut.mutate(v.id); }}><LogOut className="h-4 w-4" /></Button>
      ) : null),
    },
  ];

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Visitor Management</h1><p className="text-muted-foreground">Track and manage campus visitors</p></div>
        <Button onClick={() => setShowDialog(true)}><LogIn className="h-4 w-4 mr-2" /> Check In Visitor</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[{ label: "Today's Visitors", val: stats.today || 0 }, { label: "Currently In", val: stats.currently_in || 0 }, { label: "This Month", val: stats.this_month || 0 }, { label: "Avg/Day", val: stats.avg_per_day || 0 }].map((s) => (
          <Card key={s.label}><CardContent className="py-4"><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.val}</p></CardContent></Card>
        ))}
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search visitors..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={VISITOR_COLUMNS}
            rows={visitors}
            rowKey={(v: any) => v.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search visitors..."
            exportFileName="visitors"
            empty={{ icon: UserCheck, title: "No visitors recorded", body: "Check in visitors to start the log." }}
          />
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Visitor Check-In</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purpose</Label>
                <AdvancedSelect
          value={form.purpose}
          onChange={(v) => setForm({ ...form, purpose: v })}
          options={[{ value: 'meeting', label: 'Meeting' }, { value: 'parent_visit', label: 'Parent Visit' }, { value: 'delivery', label: 'Delivery' }, { value: 'official', label: 'Official Visit' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'other', label: 'Other' }]}
        />
              </div>
              <div className="space-y-2"><Label>Visiting Whom</Label><Input value={form.visiting_whom} onChange={(e) => setForm({ ...form, visiting_whom: e.target.value })} placeholder="Name/Department" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>ID Type</Label>
                <AdvancedSelect
          value={form.id_type}
          onChange={(v) => setForm({ ...form, id_type: v })}
          options={[{ value: 'citizenship', label: 'Citizenship' }, { value: 'license', label: 'License' }, { value: 'passport', label: 'Passport' }, { value: 'other', label: 'Other' }]}
        />
              </div>
              <div className="space-y-2"><Label>ID Number</Label><Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} /></div>
              <div className="space-y-2"><Label>Vehicle No.</Label><Input value={form.vehicle_no} onChange={(e) => setForm({ ...form, vehicle_no: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => checkIn.mutate()} disabled={!form.name || checkIn.isPending}>{checkIn.isPending ? <Spinner className="mr-2" /> : null} Check In</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
