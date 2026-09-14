"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { BSDateInput } from "@/components/ui/bs-date-input";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { undoableDelete } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
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

  const removeStructure = (st: FeeStructure) => {
    undoableDelete({
      label: `${t("structure", "संरचना")} "${st.name}"`,
      optimistic: () => setHiddenIds((prev) => new Set(prev).add(st.id)),
      rollback: () =>
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(st.id);
          return next;
        }),
      commit: async () => {
        await api.delete(`/fees/structures/${st.id}`);
        queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      },
    });
  };

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

  if (isLoading) return <AOSPage><AOSModuleLoadingState label="Loading fee structures…" /></AOSPage>;

  const STRUCTURE_COLUMNS: Column<FeeStructure>[] = [
    {
      key: "name",
      label: t("Name", "नाम"),
      sortable: true,
      value: (s) => s.name,
      render: (s) => (
        <div>
          <p className="font-medium">{s.name}</p>
          {s.scope_label && <p className="text-xs text-[color:var(--w11-text-secondary)]">{s.scope_label}</p>}
          {s.effective_note && <p className="text-xs text-[color:var(--w11-text-secondary)] mt-1">{s.effective_note}</p>}
        </div>
      ),
    },
    { key: "fee_type", label: t("Type", "प्रकार"), sortable: true, value: (s) => s.fee_type, render: (s) => <Badge variant="outline">{formatLabel(s.fee_type)}</Badge> },
    { key: "class_name", label: t("Class", "कक्षा"), sortable: true, value: (s) => s.class_name ?? "", render: (s) => s.class_name || t("All", "सबै") },
    { key: "amount", label: t("Amount", "रकम"), align: "right", sortable: true, value: (s) => s.amount, render: (s) => <span className="tabular-nums">Rs. {s.amount?.toLocaleString()}</span> },
    {
      key: "frequency",
      label: t("Frequency", "आवृत्ति"),
      sortable: true,
      value: (s) => s.frequency,
      render: (s) => (
        <div>
          <p>{formatLabel(s.frequency)}</p>
          <p className="text-xs text-[color:var(--w11-text-secondary)]">{t("Due day", "मिति")}: {s.due_day || "—"}</p>
        </div>
      ),
    },
    {
      key: "applied",
      label: t("Effective", "लागू अवस्था"),
      sortable: true,
      value: (s) => s.applied_count ?? 0,
      render: (s) => (
        <div className="space-y-1">
          <Badge variant={s.applied_count ? "success" : "secondary"}>
            {s.applied_count ? t("Active Now", "अहिले सक्रिय") : t("Template Only", "डहाँचा मात्र")}
          </Badge>
          <p className="text-xs text-[color:var(--w11-text-secondary)]">
            {s.applied_count ? `${s.applied_count} ${t("billed", "बिजक")}` : t("Not billed yet", "अहैले बिल छेन")}
          </p>
        </div>
      ),
    },
    { key: "is_optional", label: t("Optional", "वैकल्पिक"), value: (s) => (s.is_optional ? "optional" : "required"), render: (s) => (s.is_optional ? <Badge variant="secondary">{t("Optional", "वैकल्पिक")}</Badge> : t("Required", "अनिवार्य")) },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (s) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setInstallmentsFor(s); }}>
            <CalendarRange className="h-3.5 w-3.5 mr-1" /> {t("Installments", "किस्ता")}
          </Button>
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); apply.mutate(s.id); }} disabled={apply.isPending}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> {t("Apply Now", "अहिले लागू")}
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeStructure(s); }} aria-label={t("Delete structure", "संरचना मेटाउनुहोस")}><Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} /></Button>
        </div>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Banknote className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Fee Structure", "शुल्क संरचना")}
        subtitle={t(
          `${structures.length} structures · Define reusable fee templates for each class and academic year`,
          `${structures.length} संरचना · कक्षा र शैक्षिक वर्ष अनुसर डहाँचा`
        )}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBatchDialog(true)}>
              <Banknote className="h-4 w-4 mr-2" /> {t("Generate Monthly Fees", "मासिक शुल्क")}
            </Button>
            <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> {t("Add Structure", "संरचना थप्नुहोस")}</Button>
          </div>
        }
      />
      <AOSPageBody className="space-y-4">
        <DataPanel>
          <div className="win11-infobar info">
            {t("New fee structures bill matching active students immediately for the current cycle. Use Apply Now to sync older templates.",
               "नयाँ संरचनाले मिल्न सक्रिय विद्यार्थीलाई तुरन्त बाप़ गर्दा बनाऊँ।")}
          </div>
        </DataPanel>

        <DataPanel>
          <DataTable<FeeStructure>
            columns={STRUCTURE_COLUMNS}
            rows={structures.filter((st) => !hiddenIds.has(st.id))}
            rowKey={(s) => s.id}
            searchable
            searchPlaceholder={t("Search structures…", "संरचना खोज्नुहोस…")}
            exportFileName="fee-structures"
            empty={{ icon: Banknote, title: t("No fee structures defined", "कुनै संरचना छेन"), body: t("Add your first structure — new ones bill matching students immediately.", "पहिलो संरचना थप्नुहोस।") }}
          />
        </DataPanel>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("Add Fee Structure", "नयाँ शुल्क संरचना")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>{t("Name", "नाम")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("e.g. Monthly Tuition", "जस्ताई: मासिक शुल्क")} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("Type", "प्रकार")}</Label>
                  <AdvancedSelect
            value={form.fee_type}
            onChange={(v) => setForm({ ...form, fee_type: v })}
            options={[{ value: 'tuition', label: 'Tuition' }, { value: 'admission', label: 'Admission' }, { value: 'exam', label: 'Exam' }, { value: 'transport', label: 'Transport' }, { value: 'hostel', label: 'Hostel' }, { value: 'library', label: 'Library' }, { value: 'lab', label: 'Lab' }, { value: 'sports', label: 'Sports' }, { value: 'other', label: 'Other' }]}
          />
                </div>
                <div className="space-y-2"><Label>{t("Amount (Rs.)", "रकम (रु.)")}</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("Class", "कक्षा")}</Label>
                  <AdvancedSelect
            value={form.class_id}
            onChange={(v) => setForm({ ...form, class_id: v })}
            options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
          />
                </div>
                <div className="space-y-2">
                  <Label>{t("Frequency", "आवृत्ति")}</Label>
                  <AdvancedSelect
            value={form.frequency}
            onChange={(v) => setForm({ ...form, frequency: v })}
            options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'semi-annual', label: 'Semi-Annual' }, { value: 'annual', label: 'Annual' }, { value: 'one-time', label: 'One-Time' }]}
          />
                </div>
              </div>
              <div className="space-y-2"><Label>{t("Due Day of Cycle", "चक्रको मिति")}</Label><Input type="number" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} min="1" max="28" /></div>
              <FormCheckbox label={t("Optional fee", "वैकल्पिक शुल्क")} checked={form.is_optional} onCheckedChange={(v) => setForm({ ...form, is_optional: v })} />
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name.trim() || !form.amount || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} {t("Create Structure", "संरचना बनाउनुहोस")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Batch Monthly Fees Dialog */}
        <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Generate Monthly Fees", "मासिक शुल्क बनाउनुहोस")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[color:var(--w11-text-secondary)]">
              {t("This bills every active student per their structures for the current cycle. Existing records are skipped — safe to re-run.",
                 "यसले हरेक सक्रिय विद्यार्थीलाई तिन्का संरचनाअनुसर बाप़ गर्दा बनईँ।")}
            </p>
            <div className="space-y-2">
              <Label>{t("Filter by Class (optional)", "कक्षा अनुसर (वैकल्पिक)")}</Label>
              <AdvancedSelect
                value={batchClassId}
                onChange={(v) => setBatchClassId(v)}
                clearable
                placeholder={t("All Classes", "सबै कक्षा")}
                options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBatchDialog(false)}>{t("Cancel", "रद्द")}</Button>
              <Button
                onClick={() => batchMonthly.mutate(batchClassId || undefined)}
                disabled={batchMonthly.isPending}
              >
                {batchMonthly.isPending ? <Spinner className="mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
                {t("Generate Now", "अहिले बनाउनुहोस")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Installment schedule editor */}
        <InstallmentsDialog
          structure={installmentsFor}
          onClose={() => setInstallmentsFor(null)}
        />
      </AOSPageBody>
    </AOSPage>
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
  const { t } = useI18n();
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
              {t("Installment Schedule", "किस्ता तालिका")} — {structure?.name}
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
                  {balanced ? t("Balanced", "बराबर") : `${t("Off by", "कम/बढी")} Rs. ${Math.abs(scheduledTotal - structureTotal).toLocaleString()}`}
                </Badge>
                <span className="text-[color:var(--w11-text-secondary)]">
                  {t("Scheduled", "तालिका")} <strong className="tabular-nums">Rs. {scheduledTotal.toLocaleString()}</strong> {t("of", "/")}{" "}
                  <strong className="tabular-nums">Rs. {structureTotal.toLocaleString()}</strong> {t("structure total", "कुल संरचना")}
                </span>
                {hasGenerated && (
                  <Badge variant="warning">{t("Applied — schedule is locked", "लागू भइसक्यो — तालिका निर्र्ढल")}</Badge>
                )}
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[2rem_1fr_9rem_11rem_2rem] gap-2 text-xs font-medium text-[color:var(--w11-text-secondary)]">
                  <span>#</span>
                  <span>{t("Label", "नाम")}</span>
                  <span>{t("Amount (Rs.)", "रकम")}</span>
                  <span>{t("Due Date (BS)", "मिति (बि.सं.)")}</span>
                  <span />
                </div>
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[2rem_1fr_9rem_11rem_2rem] gap-2 items-center">
                    <span className="text-sm text-[color:var(--w11-text-secondary)] tabular-nums">{idx + 1}</span>
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
                      <Trash2 className="h-3.5 w-3.5" style={{ color: "#c42b1c" }} />
                    </Button>
                  </div>
                ))}
                {rows.length === 0 && (
                  <p className="py-4 text-center text-sm text-[color:var(--w11-text-secondary)]">
                    {t("No installments yet — add rows to split the structure total.", "किस्ता छैन — कुल रकम बाँड्न पंक्ति थप्नुहोस्।")}
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
                  <Plus className="h-3.5 w-3.5 mr-1" /> {t("Add Installment", "किस्ता थप्नुहोस्")}
                </Button>
              </div>

              <p className="text-xs text-[color:var(--w11-text-secondary)]">
                {t("The schedule must sum to the structure total (Rs. {n}). Saving does not touch students — use Apply to Students to bill the split.".replace("{n}", structureTotal.toLocaleString()),
                   "किस्ताको जम्मा संरचनाको कुल रकम (रु. {n}) सँग बराबर हुनुपर्छ। सुरक्षित गर्दा विद्यार्थीमा असर पर्दैन — बाँड्न Apply to Students चलाउनुहोस्।".replace("{n}", structureTotal.toLocaleString()))}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={save.isPending || applySchedule.isPending}>
              {t("Close", "बन्द")}
            </Button>
            <Button
              variant="outline"
              disabled={!balanced || rows.length === 0 || hasGenerated || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? <Spinner className="mr-2" /> : null} {t("Save Schedule", "तालिका सुरक्षित")}
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
              {t("Apply to Students", "विद्यार्थीलाई लागू")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply confirmation */}
      <Dialog open={confirmApply} onOpenChange={setConfirmApply}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Apply Installments to Students?", "किस्ता विद्यार्थीलाई लागू गर्ने?")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-[color:var(--w11-text-secondary)]">
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
              {t("Cancel", "रद्द")}
            </Button>
            <Button onClick={() => applySchedule.mutate()} disabled={applySchedule.isPending}>
              {applySchedule.isPending ? <Spinner className="mr-2" /> : <CalendarCheck className="h-4 w-4 mr-2" />}
              {t("Generate Installment Bills", "किस्ता बीजक बनाउनुहोस्")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
