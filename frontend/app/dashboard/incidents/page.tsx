"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Plus, AlertCircle } from "lucide-react";
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

  if (isLoading) return <AOSModuleLoadingState label="Loading incidents…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Incident Reports" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load data. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }


  const severityTone = (s: string) => s === "high" ? "error" : s === "medium" ? "warning" : "subtle";

  const INCIDENT_COLUMNS: Column<any>[] = [
    { key: "created_at", label: "Date", sortable: true, value: (i) => i.created_at ?? "", render: (i) => (i.created_at ? displayBS(i.created_at) : "—") },
    { key: "title", label: "Title", sortable: true, value: (i) => i.title ?? "", render: (i) => <span className="font-medium">{i.title}</span> },
    { key: "incident_type", label: "Type", sortable: true, value: (i) => i.incident_type ?? "", render: (i) => <span className="win11-chip subtle">{i.incident_type}</span> },
    { key: "severity", label: "Severity", sortable: true, value: (i) => i.severity ?? "", render: (i) => <StatusChip status={severityTone(i.severity)} label={i.severity} /> },
    { key: "student_name", label: "Student", value: (i) => i.student_name ?? "", render: (i) => i.student_name || "—" },
    { key: "status", label: "Status", sortable: true, value: (i) => i.status ?? "open", render: (i) => <StatusChip status={i.status === "resolved" ? "resolved" : "pending"} label={i.status || "open"} /> },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<AlertCircle className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Incident Reports"
        subtitle={`${incidents.length} ${incidents.length === 1 ? "incident" : "incidents"} recorded`}
        actions={
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Report Incident</Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
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
        </DataPanel>

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
      </AOSPageBody>
    </AOSPage>
  );
}
