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
import { Plus, AlertCircle, Search } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function IncidentsPage() {
  return <PluginGate slug="incidents"><IncidentsContent /></PluginGate>;
}

function IncidentsContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: "", type: "behavioral", severity: "low", student_id: "", description: "" });

  const { isError, refetch, data, isLoading } = useQuery({
    queryKey: ["incidents", search],
    queryFn: async () => { const r = await api.get("/incidents", { params: { search: search || undefined } }); return r.data; },
  });

  const incidents = data?.data || [];

  const create = useMutation({
    // Backend contract: POST /incidents {title, incident_type, severity, description,
    // involved_student_ids: [student uuid]} — incident_type enum is
    // bullying|fighting|vandalism|theft|medical|behavioral|other; disciplinary
    // follow-ups are separate records via POST /incidents/<id>/actions (admin only).
    mutationFn: async () => (await api.post("/incidents", {
      title: form.title,
      incident_type: form.type,
      severity: form.severity,
      description: form.description,
      involved_student_ids: form.student_id.trim() ? [form.student_id.trim()] : undefined,
    })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["incidents"] }); setShowDialog(false); toast.success("Incident recorded"); },
    onError: () => toast.error("Failed to record"),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load data. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }


  const severityColor = (s: string) => s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline";

  const INCIDENT_COLUMNS: Column<any>[] = [
    { key: "created_at", label: "Date", sortable: true, value: (i) => i.created_at ?? "", render: (i) => (i.created_at ? displayBS(i.created_at) : "—") },
    { key: "title", label: "Title", sortable: true, value: (i) => i.title ?? "", render: (i) => <span className="font-medium">{i.title}</span> },
    { key: "incident_type", label: "Type", sortable: true, value: (i) => i.incident_type ?? "", render: (i) => <Badge variant="outline">{i.incident_type}</Badge> },
    { key: "severity", label: "Severity", sortable: true, value: (i) => i.severity ?? "", render: (i) => <Badge variant={severityColor(i.severity)}>{i.severity}</Badge> },
    { key: "student_name", label: "Student", value: (i) => i.student_name ?? "", render: (i) => i.student_name || "—" },
    { key: "status", label: "Status", sortable: true, value: (i) => i.status ?? "open", render: (i) => <Badge variant={i.status === "resolved" ? "default" : "secondary"}>{i.status || "open"}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Incident Reports</h1><p className="text-muted-foreground">Record and track student/campus incidents</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Report Incident</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={INCIDENT_COLUMNS}
            rows={incidents}
            rowKey={(i: any) => i.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search incidents..."
            exportFileName="incidents"
            empty={{ icon: AlertCircle, title: "No incidents recorded", body: "Record incidents to build the disciplinary history.", action: { label: "Report Incident", onClick: () => setShowDialog(true) } }}
          />
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
                <AdvancedSelect
          value={form.type}
          onChange={(v) => setForm({ ...form, type: v })}
          options={[{ value: 'behavioral', label: 'Behavior' }, { value: 'bullying', label: 'Bullying' }, { value: 'fighting', label: 'Fighting' }, { value: 'vandalism', label: 'Vandalism' }, { value: 'theft', label: 'Theft' }, { value: 'medical', label: 'Medical' }, { value: 'other', label: 'Other' }]}
        />
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <AdvancedSelect
          value={form.severity}
          onChange={(v) => setForm({ ...form, severity: v })}
          options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
        />
              </div>
            </div>
            <div className="space-y-2"><Label>Student ID (optional)</Label><Input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
