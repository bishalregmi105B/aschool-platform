"use client";

import { useEffect, useState } from "react";
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
import { BSDateInput } from "@/components/ui/bs-date-input";
import {
  CalendarRange,
  CalendarCheck,
  Plus,
  RefreshCw,
  Trash2,
  Banknote,
  Loader2,
} from "lucide-react";

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
  const [installmentsFor, setInstallmentsFor] = useState<FeeStructure | null>(null);
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
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setInstallmentsFor(s); }}>
            <CalendarRange className="h-3.5 w-3.5 mr-1" /> Installments
          </Button>
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

      {/* Installment schedule editor */}
      <InstallmentsDialog
        structure={installmentsFor}
        onClose={() => setInstallmentsFor(null)}
      />
    </div>
  );
}

// ── Installment schedule editor ─────────────────────────────────────────────

interface InstallmentRow {
  id?: string;
  seq: number;
  label: string;
  amount: number;
  due_date_bs: string | null;
  is_generated?: boolean;
}

interface InstallmentsPayload {
  installments: InstallmentRow[];
  scheduled_total: number;
  structure_total: number;
  balanced: boolean;
}

function InstallmentsDialog({
  structure,
  onClose,
}: {
  structure: FeeStructure | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [confirmApply, setConfirmApply] = useState(false);

  const open = Boolean(structure);

  const { data, isLoading } = useQuery({
    enabled: open && Boolean(structure?.id),
    queryKey: ["fee-installments", structure?.id],
    retry: 1,
    queryFn: async () => {
      const r = await api.get(`/fees/structures/${structure!.id}/installments`);
      return r.data?.data as InstallmentsPayload | null;
    },
  });

  // Seed the editable rows from the saved schedule (or split the structure
  // total into two halves as a starting point). Local edits mark the form
  // dirty so a background refetch never clobbers what the user is typing;
  // saving/apply clears dirty so the fresh server rows flow back in.
  const [seeded, setSeeded] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (structure && data) {
      if (dirty || seeded === structure.id) return;
      if (data.installments.length) {
        setRows(data.installments.map((r) => ({ ...r })));
      } else {
        const half = Math.round((data.structure_total / 2) * 100) / 100;
        setRows([
          { seq: 1, label: "Installment 1", amount: half, due_date_bs: null },
          { seq: 2, label: "Installment 2", amount: data.structure_total - half, due_date_bs: null },
        ]);
      }
      setSeeded(structure.id);
    }
    if (!structure) {
      setSeeded(null);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, data, seeded, dirty]);

  const scheduledTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0);
  const structureTotal = data?.structure_total ?? 0;
  const balanced = structureTotal > 0 && Math.abs(scheduledTotal - structureTotal) < 0.01;
  const hasGenerated = rows.some((r) => r.is_generated);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        installments: rows.map((r, idx) => ({
          seq: idx + 1,
          label: r.label || `Installment ${idx + 1}`,
          amount: parseFloat(String(r.amount)) || 0,
          due_date_bs: r.due_date_bs || undefined,
        })),
      };
      const r = await api.put(`/fees/structures/${structure!.id}/installments`, payload);
      return r.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-installments", structure?.id] });
      setDirty(false);
      toast.success("Installment schedule saved.");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || e?.message || "Could not save the schedule"),
  });

  const applySchedule = useMutation({
    mutationFn: async () => {
      const r = await api.post(`/fees/structures/${structure!.id}/installments/apply`);
      return r.data?.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["fee-installments", structure?.id] });
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      setConfirmApply(false);
      setDirty(false);
      toast.success(
        `Applied: ${res?.created_collections ?? 0} bill(s) created, ${res?.skipped_existing ?? 0} already existed for ${res?.matched_students ?? 0} matched student(s).`,
      );
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || e?.message || "Could not apply the schedule"),
  });

  const updateRow = (idx: number, patch: Partial<InstallmentRow>) => {
    setDirty(true);
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Installment Schedule — {structure?.name}
            </DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant={balanced ? "success" : "destructive"}>
                  {balanced ? "Balanced" : `Off by Rs. ${Math.abs(scheduledTotal - structureTotal).toLocaleString()}`}
                </Badge>
                <span className="text-muted-foreground">
                  Scheduled <strong>Rs. {scheduledTotal.toLocaleString()}</strong> of{" "}
                  <strong>Rs. {structureTotal.toLocaleString()}</strong> structure total
                </span>
                {hasGenerated && (
                  <Badge variant="warning">Applied — schedule is locked</Badge>
                )}
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[2rem_1fr_9rem_11rem_2rem] gap-2 text-xs font-medium text-muted-foreground">
                  <span>#</span>
                  <span>Label</span>
                  <span>Amount (Rs.)</span>
                  <span>Due Date (BS)</span>
                  <span />
                </div>
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[2rem_1fr_9rem_11rem_2rem] gap-2 items-center">
                    <span className="text-sm text-muted-foreground tabular-nums">{idx + 1}</span>
                    <Input
                      className="h-8"
                      value={row.label}
                      onChange={(e) => updateRow(idx, { label: e.target.value })}
                      placeholder={`Installment ${idx + 1}`}
                      disabled={hasGenerated}
                    />
                    <Input
                      className="h-8"
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => updateRow(idx, { amount: parseFloat(e.target.value) || 0 })}
                      disabled={hasGenerated}
                    />
                    <BSDateInput
                      className="w-full"
                      value={row.due_date_bs || ""}
                      onChange={(v) => updateRow(idx, { due_date_bs: v })}
                      emit="bs"
                      disabled={hasGenerated}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={hasGenerated}
                      onClick={() => {
                        setDirty(true);
                        setRows((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      aria-label={`Remove installment ${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}
                {rows.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No installments yet — add rows below to split the structure total.
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={hasGenerated}
                  onClick={() => {
                    setDirty(true);
                    setRows((prev) => [
                      ...prev,
                      {
                        seq: prev.length + 1,
                        label: `Installment ${prev.length + 1}`,
                        amount: 0,
                        due_date_bs: null,
                      },
                    ]);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Installment
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                The schedule must sum to the structure total (Rs. {structureTotal.toLocaleString()}).
                BS due dates land on each generated bill. Saving does not touch
                students — use “Apply to Students” to bill the split.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={save.isPending || applySchedule.isPending}>
              Close
            </Button>
            <Button
              variant="outline"
              disabled={!balanced || rows.length === 0 || hasGenerated || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? <Spinner className="mr-2" /> : null} Save Schedule
            </Button>
            <Button
              disabled={!balanced || rows.length === 0 || save.isPending || applySchedule.isPending}
              onClick={() => setConfirmApply(true)}
            >
              {applySchedule.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CalendarCheck className="h-4 w-4 mr-2" />
              )}
              Apply to Students
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply confirmation */}
      <Dialog open={confirmApply} onOpenChange={setConfirmApply}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Installments to Students?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              This bills every student matched by “{structure?.name}” with{" "}
              <strong>{rows.length}</strong> installment bill(s) of the schedule
              amounts (totaling Rs. {scheduledTotal.toLocaleString()}). Students
              already billed from this schedule are skipped.
            </p>
            <p>
              Generated bills are replaced on each apply for uncollected lines,
              but money already paid stays untouched.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApply(false)} disabled={applySchedule.isPending}>
              Cancel
            </Button>
            <Button onClick={() => applySchedule.mutate()} disabled={applySchedule.isPending}>
              {applySchedule.isPending ? <Spinner className="mr-2" /> : <CalendarCheck className="h-4 w-4 mr-2" />}
              Generate Installment Bills
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
