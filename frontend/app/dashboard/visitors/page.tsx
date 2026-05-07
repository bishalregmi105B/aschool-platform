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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
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
  });

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
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Purpose</TableHead><TableHead>Visiting</TableHead><TableHead>Check In</TableHead><TableHead>Check Out</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {visitors.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No visitors recorded</TableCell></TableRow>
              ) : visitors.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium"><div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-muted-foreground" />{v.name}</div></TableCell>
                  <TableCell>{v.phone || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{v.purpose}</Badge></TableCell>
                  <TableCell>{v.visiting_staff_id || "—"}</TableCell>
                  <TableCell className="text-sm">{v.checked_in_at ? new Date(v.checked_in_at).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell className="text-sm">{v.checked_out_at ? new Date(v.checked_out_at).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell><Badge variant={v.checked_out_at ? "default" : "secondary"}>{v.checked_out_at ? "Left" : "In Campus"}</Badge></TableCell>
                  <TableCell>{!v.checked_out_at && <Button variant="ghost" size="sm" onClick={() => checkOut.mutate(v.id)}><LogOut className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                <select className="w-full border rounded-md p-2" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
                  <option value="meeting">Meeting</option><option value="parent_visit">Parent Visit</option><option value="delivery">Delivery</option><option value="official">Official Visit</option><option value="maintenance">Maintenance</option><option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Visiting Whom</Label><Input value={form.visiting_whom} onChange={(e) => setForm({ ...form, visiting_whom: e.target.value })} placeholder="Name/Department" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>ID Type</Label>
                <select className="w-full border rounded-md p-2" value={form.id_type} onChange={(e) => setForm({ ...form, id_type: e.target.value })}>
                  <option value="citizenship">Citizenship</option><option value="license">License</option><option value="passport">Passport</option><option value="other">Other</option>
                </select>
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
