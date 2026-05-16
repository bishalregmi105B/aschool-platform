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
import { Search, TrendingUp, Plus, Users } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function ActiveCasesPage() {
  return <PluginGate slug="incident_management"><ActiveCasesContent /></PluginGate>;
}

function ActiveCasesContent() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showWitnessDialog, setShowWitnessDialog] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", type: "behavior", severity: "medium", student_id: "", description: "", witnesses: "", parent_notified: false });

  const { data, isLoading } = useQuery({
    queryKey: ["active-cases", search],
    queryFn: async () => { const r = await api.get("/incidents/management/active", { params: { search: search || undefined } }); return r.data?.data ?? r.data; },
  });

  const cases: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/incidents/management", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["active-cases"] }); setShowDialog(false); toast.success("Case created"); setForm({ title: "", type: "behavior", severity: "medium", student_id: "", description: "", witnesses: "", parent_notified: false }); },
    onError: () => toast.error("Failed to create case"),
  });

  const escalate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/incidents/management/${id}/escalate`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["active-cases"] }); toast.success("Case escalated"); },
    onError: () => toast.error("Escalation failed"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Active Cases</h1><p className="text-muted-foreground">Open incidents requiring resolution or follow-up</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />New Case</Button>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search cases..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Case</TableHead><TableHead>Type</TableHead><TableHead>Severity</TableHead><TableHead>Student</TableHead><TableHead>Witnesses</TableHead><TableHead>Parent Notified</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {cases.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No active cases</TableCell></TableRow>
            ) : cases.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium max-w-[200px] truncate">{c.title}</TableCell>
                <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                <TableCell><Badge variant={c.severity === "high" ? "destructive" : c.severity === "medium" ? "secondary" : "outline"}>{c.severity}</Badge></TableCell>
                <TableCell>{c.student_name ?? "—"}</TableCell>
                <TableCell><div className="flex items-center gap-1"><Users className="h-3 w-3" />{c.witness_count ?? 0}</div></TableCell>
                <TableCell><Badge variant={c.parent_notified ? "default" : "secondary"}>{c.parent_notified ? "Yes" : "No"}</Badge></TableCell>
                <TableCell>{c.created_at ? displayBS(c.created_at) : "—"}</TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => escalate.mutate(c.id)} disabled={escalate.isPending}><TrendingUp className="h-3 w-3 mr-1" />Escalate</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Case</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief incident description" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="behavior">Behavior</option><option value="bullying">Bullying</option><option value="violence">Violence</option><option value="academic">Academic</option><option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Severity</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Student ID</Label><Input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} /></div>
            <div className="space-y-2"><Label>Witness Names</Label><Input value={form.witnesses} onChange={(e) => setForm({ ...form, witnesses: e.target.value })} placeholder="Comma-separated names" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.title}>{create.isPending ? <Spinner /> : "Create Case"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
