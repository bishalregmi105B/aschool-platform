"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BSDateInput } from "@/components/ui/bs-date-input";
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

  if (isLoading) return <AOSModuleLoadingState label="Loading drills…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Drill Schedule" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load drills. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const DRILL_COLUMNS: Column<any>[] = [
    { key: "title", label: "Title", sortable: true, value: (d) => d.title ?? "", render: (d) => <span className="font-medium">{d.title}</span> },
    { key: "type", label: "Type", sortable: true, value: (d) => d.drill_type ?? d.type ?? "", render: (d) => <span className="win11-chip subtle">{d.drill_type ?? d.type}</span> },
    { key: "scheduled_date", label: "Scheduled Date", sortable: true, value: (d) => d.scheduled_date ?? "", render: (d) => (d.scheduled_date ? displayBS(d.scheduled_date) : "—") },
    { key: "duration_minutes", label: "Duration", align: "right", sortable: true, value: (d) => d.duration_minutes ?? 0, render: (d) => (d.duration_minutes ? `${d.duration_minutes} min` : "—") },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (d) => d.status ?? "scheduled",
      render: (d) => (
        <StatusChip
          status={d.status === "completed" ? "completed" : d.status === "missed" ? "failed" : "pending"}
          label={d.status ?? "scheduled"}
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (d) =>
        d.status !== "completed" ? (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); markComplete.mutate(d.id); }}>Mark Done</Button>
        ) : null,
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Calendar className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Drill Schedule"
        subtitle={`${drills.length} emergency evacuation ${drills.length === 1 ? "drill" : "drills"}`}
        actions={
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />Schedule Drill</Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={DRILL_COLUMNS}
            rows={drills}
            rowKey={(d: any) => d.id}
            searchable
            searchPlaceholder="Search drills…"
            exportFileName="drills"
            empty={{ icon: Plus, title: "No drills scheduled", body: "Schedule evacuation drills to stay prepared.", action: { label: "Schedule Drill", onClick: () => setShowDialog(true) } }}
          />
        </DataPanel>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule Emergency Drill</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Drill Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Annual Earthquake Drill" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Type</Label>
                  <AdvancedSelect
            value={form.drill_type}
            onChange={(v) => setForm({ ...form, drill_type: v })}
            options={[{ value: 'earthquake', label: 'Earthquake' }, { value: 'fire', label: 'Fire' }, { value: 'flood', label: 'Flood' }, { value: 'general', label: 'General' }]}
          />
                </div>
                <div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Scheduled Date</Label><BSDateInput value={form.scheduled_date} onChange={(v) => setForm({ ...form, scheduled_date: v })} /></div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !form.title || !form.scheduled_date}>{create.isPending ? <Spinner /> : "Schedule"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
