"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Plus, RefreshCw, Trash2, Banknote } from "lucide-react";

interface FeeStructure {
  id: string;
  name: string;
  scope_label?: string;
  fee_type: string;
  amount: number;
  class_name?: string;
  academic_year?: string;
  frequency: string;
  due_day?: number;
  is_optional: boolean;
  applied_count?: number;
  applied_cycle?: string;
  effective_note?: string;
}

const DEFAULT_FORM = {
  name: "",
  fee_type: "tuition",
  amount: "",
  class_id: "",
  frequency: "monthly",
  due_day: "10",
  is_optional: false,
};

function formatLabel(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function FeeStructurePage() {
  return <PluginGate slug="fees"><FeeStructureContent /></PluginGate>;
}

function FeeStructureContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchClassId, setBatchClassId] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ["fee-structures"],
    queryFn: async () => { const r = await api.get("/fees/structures"); return r.data; },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => { const r = await api.get("/academics/classes"); return r.data?.data || []; },
  });

  const structures: FeeStructure[] = data?.data || [];

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        due_day: parseInt(form.due_day),
        class_id: form.class_id || undefined,
      };
      return (await api.post("/fees/structures", payload)).data;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      setShowDialog(false);
      setForm(DEFAULT_FORM);
      const createdCount = response?.data?.applied_summary?.created_collections || 0;
      toast.success(
        createdCount > 0
          ? `Fee structure created and applied to ${createdCount} students.`
          : "Fee structure created. No matching active students were billed yet.",
      );
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || "Failed to create fee structure"),
  });

  const apply = useMutation({
    mutationFn: async (id: string) => (await api.post(`/fees/structures/${id}/apply`)).data,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      const summary = response?.data?.applied_summary;
      const createdCount = summary?.created_collections || 0;
      const matchedStudents = summary?.matched_students || 0;
      toast.success(
        createdCount > 0
          ? `Applied to ${createdCount} students for the current cycle.`
          : matchedStudents > 0
            ? "This structure is already applied for the current cycle."
            : "No matching active students found for this structure.",
      );
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || "Failed to apply fee structure"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/fees/structures/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["fee-structures"] }); toast.success("Deleted"); },
  });

  const batchMonthly = useMutation({
    mutationFn: async (classId?: string) =>
      (await api.post("/fees/batch-monthly", classId ? { class_id: classId } : {})).data,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      setShowBatchDialog(false);
      const d = res?.data;
      toast.success(
        `Done: ${d?.collections_created ?? 0} new fee records created, ${d?.collections_skipped ?? 0} already existed across ${d?.structures_processed ?? 0} structures.`
      );
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to generate fees"),
  });

  if (isLoading) return <PageLoader />;

  const STRUCTURE_COLUMNS: Column<FeeStructure>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      value: (s) => s.name,
      render: (s) => (
        <div>
          <p className="font-medium">{s.name}</p>
          {s.scope_label && <p className="text-xs text-muted-foreground">{s.scope_label}</p>}
          {s.effective_note && <p className="text-xs text-muted-foreground mt-1">{s.effective_note}</p>}
        </div>
      ),
    },
    { key: "fee_type", label: "Type", sortable: true, value: (s) => s.fee_type, render: (s) => <Badge variant="outline">{formatLabel(s.fee_type)}</Badge> },
    { key: "class_name", label: "Class", sortable: true, value: (s) => s.class_name ?? "", render: (s) => s.class_name || "All" },
    { key: "amount", label: "Amount", align: "right", sortable: true, value: (s) => s.amount, render: (s) => <>Rs. {s.amount?.toLocaleString()}</> },
    {
      key: "frequency",
      label: "Frequency",
      sortable: true,
      value: (s) => s.frequency,
      render: (s) => (
        <div>
          <p>{formatLabel(s.frequency)}</p>
          <p className="text-xs text-muted-foreground">Due day: {s.due_day || "—"}</p>
        </div>
      ),
    },
    {
      key: "applied",
      label: "Effective",
      sortable: true,
      value: (s) => s.applied_count ?? 0,
      render: (s) => (
        <div className="space-y-1">
          <Badge variant={s.applied_count ? "success" : "secondary"}>
            {s.applied_count ? "Active Now" : "Template Only"}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {s.applied_count ? `${s.applied_count} billed` : "Not billed yet"}
          </p>
        </div>
      ),
    },
    { key: "is_optional", label: "Optional", value: (s) => (s.is_optional ? "optional" : "required"), render: (s) => (s.is_optional ? <Badge variant="secondary">Optional</Badge> : "Required") },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (s) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); apply.mutate(s.id); }} disabled={apply.isPending}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Apply Now
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Fee Structure</h1><p className="text-muted-foreground">Define reusable fee templates for each class and academic year</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBatchDialog(true)}>
            <Banknote className="h-4 w-4 mr-2" /> Generate Monthly Fees
          </Button>
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Structure</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            New fee structures now create the current pending dues immediately for matching active students. Use Apply Now for older templates or to sync the current cycle again.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DataTable<FeeStructure>
            columns={STRUCTURE_COLUMNS}
            rows={structures}
            rowKey={(s) => s.id}
            searchable
            searchPlaceholder="Search structures…"
            exportFileName="fee-structures"
            empty={{ icon: Banknote, title: "No fee structures defined", body: "Add your first structure — new ones bill matching students immediately." }}
          />
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Fee Structure</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Monthly Tuition" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <AdvancedSelect
          value={form.fee_type}
          onChange={(v) => setForm({ ...form, fee_type: v })}
          options={[{ value: 'tuition', label: 'Tuition' }, { value: 'admission', label: 'Admission' }, { value: 'exam', label: 'Exam' }, { value: 'transport', label: 'Transport' }, { value: 'hostel', label: 'Hostel' }, { value: 'library', label: 'Library' }, { value: 'lab', label: 'Lab' }, { value: 'sports', label: 'Sports' }, { value: 'other', label: 'Other' }]}
        />
              </div>
              <div className="space-y-2"><Label>Amount (Rs.)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <AdvancedSelect
          value={form.class_id}
          onChange={(v) => setForm({ ...form, class_id: v })}
          options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
        />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <AdvancedSelect
          value={form.frequency}
          onChange={(v) => setForm({ ...form, frequency: v })}
          options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'semi-annual', label: 'Semi-Annual' }, { value: 'annual', label: 'Annual' }, { value: 'one-time', label: 'One-Time' }]}
        />
              </div>
            </div>
            <div className="space-y-2"><Label>Due Day of Cycle</Label><Input type="number" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} min="1" max="28" /></div>
            <FormCheckbox label="Optional fee" checked={form.is_optional} onCheckedChange={(v) => setForm({ ...form, is_optional: v })} />
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name.trim() || !form.amount || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Create Structure</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Monthly Fees Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Monthly Fees</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will generate pending fee records for all active students based on
            their active fee structures for the current billing cycle. Existing records
            are skipped (safe to re-run).
          </p>
          <div className="space-y-2">
            <Label>Filter by Class (optional)</Label>
            <AdvancedSelect
              value={batchClassId}
              onChange={(v) => setBatchClassId(v)}
              clearable
              placeholder="All Classes"
              options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchDialog(false)}>Cancel</Button>
            <Button
              onClick={() => batchMonthly.mutate(batchClassId || undefined)}
              disabled={batchMonthly.isPending}
            >
              {batchMonthly.isPending ? <Spinner className="mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
              Generate Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
