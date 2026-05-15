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
import { Plus, AlertCircle, Search } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function IncidentsPage() {
  return <PluginGate slug="incidents"><IncidentsContent /></PluginGate>;
}

function IncidentsContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: "", type: "behavior", severity: "low", student_id: "", description: "", action_taken: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["incidents", search],
    queryFn: async () => { const r = await api.get("/incidents", { params: { search: search || undefined } }); return r.data; },
  });

  const incidents = data?.data || [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/incidents", { ...form, student_id: form.student_id ? parseInt(form.student_id) : undefined })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["incidents"] }); setShowDialog(false); toast.success("Incident recorded"); },
    onError: () => toast.error("Failed to record"),
  });

  if (isLoading) return <PageLoader />;

  const severityColor = (s: string) => s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Incident Reports</h1><p className="text-muted-foreground">Record and track student/campus incidents</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Report Incident</Button>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search incidents..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Severity</TableHead><TableHead>Student</TableHead><TableHead>Action Taken</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {incidents.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No incidents recorded</TableCell></TableRow>
              ) : incidents.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{i.created_at ? displayBS(i.created_at) : "—"}</TableCell>
                  <TableCell className="font-medium">{i.title}</TableCell>
                  <TableCell><Badge variant="outline">{i.type}</Badge></TableCell>
                  <TableCell><Badge variant={severityColor(i.severity)}>{i.severity}</Badge></TableCell>
                  <TableCell>{i.student_name || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{i.action_taken || "—"}</TableCell>
                  <TableCell><Badge variant={i.status === "resolved" ? "default" : "secondary"}>{i.status || "open"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report Incident</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief incident title" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <select className="w-full border rounded-md p-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="behavior">Behavior</option><option value="bullying">Bullying</option><option value="injury">Injury</option><option value="property">Property Damage</option><option value="academic">Academic</option><option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <select className="w-full border rounded-md p-2" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Student ID (optional)</Label><Input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Action Taken</Label><Input value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
