"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { TrendingUp, Plus, Users } from "lucide-react";
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["active-cases", search],
    queryFn: async () => { const r = await api.get("/incidents/management/active", { params: { search: search || undefined } }); return r.data?.data ?? r.data; },
    retry: 1,
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

  if (isLoading) return <AOSModuleLoadingState label="Loading active cases…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Active Cases" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load active cases. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<TrendingUp className="h-5 w-5" style={{ color: "#d83b01" }} />}
        title="Active Cases"
        subtitle={`${cases.length} open ${cases.length === 1 ? "case" : "cases"} requiring resolution or follow-up`}
        actions={
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />New Case</Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Case</TableHead><TableHead>Type</TableHead><TableHead>Severity</TableHead><TableHead>Student</TableHead><TableHead>Witnesses</TableHead><TableHead>Parent Notified</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {cases.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>No active cases</TableCell></TableRow>
              ) : cases.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{c.title}</TableCell>
                  <TableCell><span className="win11-chip subtle">{c.type}</span></TableCell>
                  <TableCell><StatusChip status={c.severity === "high" ? "failed" : c.severity === "medium" ? "pending" : "subtle"} label={c.severity} /></TableCell>
                  <TableCell>{c.student_name ?? "—"}</TableCell>
                  <TableCell><div className="flex items-center gap-1"><Users className="h-3 w-3" style={{ color: "var(--w11-text-secondary)" }} />{c.witness_count ?? 0}</div></TableCell>
                  <TableCell><StatusChip status={c.parent_notified ? "completed" : "pending"} label={c.parent_notified ? "Yes" : "No"} /></TableCell>
                  <TableCell>{c.created_at ? displayBS(c.created_at) : "—"}</TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => escalate.mutate(c.id)} disabled={escalate.isPending}><TrendingUp className="h-3 w-3 mr-1" />Escalate</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Case</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief incident description" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Type</Label>
                  <AdvancedSelect
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v })}
            options={[{ value: 'behavior', label: 'Behavior' }, { value: 'bullying', label: 'Bullying' }, { value: 'violence', label: 'Violence' }, { value: 'academic', label: 'Academic' }, { value: 'other', label: 'Other' }]}
          />
                </div>
                <div className="space-y-2"><Label>Severity</Label>
                  <AdvancedSelect
            value={form.severity}
            onChange={(v) => setForm({ ...form, severity: v })}
            options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
          />
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
      </AOSPageBody>
    </AOSPage>
  );
}
