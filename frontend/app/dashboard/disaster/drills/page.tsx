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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Calendar, Plus } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function DrillsPage() {
  return <PluginGate slug="disaster_management"><DrillsContent /></PluginGate>;
}

function DrillsContent() {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: "", drill_type: "earthquake", scheduled_date: "", duration_minutes: "30", notes: "" });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["disaster-drills"],
    queryFn: async () => { const r = await api.get("/emergency/drills"); return r.data?.data ?? r.data; },
    retry: 1,
  });

  const drills: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/emergency/drills", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["disaster-drills"] }); setShowDialog(false); toast.success("Drill scheduled"); setForm({ title: "", drill_type: "earthquake", scheduled_date: "", duration_minutes: "30", notes: "" }); },
    onError: () => toast.error("Failed to schedule drill"),
  });

  const markComplete = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/emergency/drills/${id}`, { status: "completed" })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["disaster-drills"] }); toast.success("Drill marked complete"); },
    onError: () => toast.error("Failed to update drill"),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load drills. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Drill Schedule</h1><p className="text-muted-foreground">Plan and track emergency evacuation drills</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />Schedule Drill</Button>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Scheduled Date</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {drills.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No drills scheduled</TableCell></TableRow>
            ) : drills.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.title}</TableCell>
                <TableCell><Badge variant="outline">{d.drill_type ?? d.type}</Badge></TableCell>
                <TableCell>{d.scheduled_date ? displayBS(d.scheduled_date) : "—"}</TableCell>
                <TableCell>{d.duration_minutes ? `${d.duration_minutes} min` : "—"}</TableCell>
                <TableCell><Badge variant={d.status === "completed" ? "default" : d.status === "missed" ? "destructive" : "secondary"}>{d.status ?? "scheduled"}</Badge></TableCell>
                <TableCell>{d.status !== "completed" && <Button size="sm" variant="outline" onClick={() => markComplete.mutate(d.id)}>Mark Done</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Emergency Drill</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Drill Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Annual Earthquake Drill" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.drill_type} onChange={(e) => setForm({ ...form, drill_type: e.target.value })}>
                  <option value="earthquake">Earthquake</option><option value="fire">Fire</option><option value="flood">Flood</option><option value="general">General</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Scheduled Date</Label><Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.title || !form.scheduled_date}>{create.isPending ? <Spinner /> : "Schedule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
