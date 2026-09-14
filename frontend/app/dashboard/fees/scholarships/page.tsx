"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BSMonthInput } from "@/components/ui/bs-date-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { undoableDelete } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n";
import { Plus, Trash2, Pencil, GraduationCap } from "lucide-react";

interface Scholarship {
  id: string;
  student_id: string;
  student_name: string;
  roll_number?: string;
  class_name?: string;
  fee_type?: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  reason?: string;
  valid_from_bs?: string;
  valid_until_bs?: string;
  is_active: boolean;
  created_at?: string;
}

const DEFAULT_FORM = {
  student_id: "",
  fee_type: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: "",
  reason: "",
  valid_from_bs: "",
  valid_until_bs: "",
  is_active: true,
};

export default function ScholarshipsPage() {
  return (
    <PluginGate slug="fees">
      <ScholarshipsContent />
    </PluginGate>
  );
}

function ScholarshipsContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Scholarship | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [studentSearch, setStudentSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["scholarships"],
    queryFn: async () => {
      const r = await api.get("/fees/scholarships");
      return r.data?.data || [];
    },
  });

  const { data: studentsData } = useQuery({
    queryKey: ["students-search", studentSearch],
    queryFn: async () => {
      if (!studentSearch.trim()) return [];
      const r = await api.get("/students", {
        params: { search: studentSearch, per_page: 20 },
      });
      return r.data?.data || [];
    },
    enabled: studentSearch.trim().length >= 2,
  });

  const scholarships: Scholarship[] = data || [];

  const openCreate = () => {
    setEditTarget(null);
    setForm(DEFAULT_FORM);
    setStudentSearch("");
    setShowDialog(true);
  };

  const openEdit = (sc: Scholarship) => {
    setEditTarget(sc);
    setForm({
      student_id: sc.student_id,
      fee_type: sc.fee_type || "",
      discount_type: sc.discount_type,
      discount_value: String(sc.discount_value),
      reason: sc.reason || "",
      valid_from_bs: sc.valid_from_bs || "",
      valid_until_bs: sc.valid_until_bs || "",
      is_active: sc.is_active,
    });
    setStudentSearch(sc.student_name);
    setShowDialog(true);
  };

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post("/fees/scholarships", {
          ...form,
          discount_value: parseFloat(form.discount_value) || 0,
          fee_type: form.fee_type || undefined,
          valid_from_bs: form.valid_from_bs || undefined,
          valid_until_bs: form.valid_until_bs || undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scholarships"] });
      setShowDialog(false);
      toast.success(t("Scholarship created successfully.", "छात्रवृत्ति बन्ये।"));
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || t("Failed to create scholarship", "बनाउन सकिएन")),
  });

  const update = useMutation({
    mutationFn: async () =>
      (
        await api.put(`/fees/scholarships/${editTarget!.id}`, {
          ...form,
          discount_value: parseFloat(form.discount_value) || 0,
          fee_type: form.fee_type || undefined,
          valid_from_bs: form.valid_from_bs || undefined,
          valid_until_bs: form.valid_until_bs || undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scholarships"] });
      setShowDialog(false);
      toast.success(t("Scholarship updated.", "अपडेट भए।"));
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || t("Failed to update scholarship", "अपडेट सकिएन")),
  });

  const removeScholarship = (sc: Scholarship) => {
    undoableDelete({
      label: `${t("scholarship", "छात्रवृत्ति")} (${sc.student_name})`,
      optimistic: () => setHiddenIds((prev) => new Set(prev).add(sc.id)),
      rollback: () =>
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(sc.id);
          return next;
        }),
      commit: async () => {
        await api.delete(`/fees/scholarships/${sc.id}`);
        queryClient.invalidateQueries({ queryKey: ["scholarships"] });
      },
    });
  };

  const SCHOLARSHIP_COLUMNS: Column<any>[] = [
    {
      key: "student_name",
      label: t("Student", "विद्यार्थी"),
      sortable: true,
      value: (sc) => sc.student_name ?? "",
      render: (sc) => (
        <div>
          <p className="font-medium">{sc.student_name}</p>
          {sc.roll_number && <p className="text-xs text-[color:var(--w11-text-secondary)]">#{sc.roll_number}</p>}
        </div>
      ),
    },
    { key: "class_name", label: t("Class", "कक्षा"), sortable: true, value: (sc) => sc.class_name ?? "", render: (sc) => sc.class_name || "—" },
    { key: "fee_type", label: t("Fee Type", "शुल्क प्रकार"), value: (sc) => sc.fee_type ?? "", render: (sc) => <Badge variant="outline">{sc.fee_type || t("All Types", "सबै")}</Badge> },
    {
      key: "discount_value",
      label: t("Discount", "छुट"),
      align: "right",
      sortable: true,
      value: (sc) => sc.discount_value ?? 0,
      render: (sc) => (
        <span className="font-semibold tabular-nums" style={{ color: "#107c10" }}>
          {sc.discount_type === "percent" ? `${sc.discount_value}%` : `Rs. ${sc.discount_value.toLocaleString()}`}
        </span>
      ),
    },
    { key: "reason", label: t("Reason", "कारण"), value: (sc) => sc.reason ?? "", render: (sc) => sc.reason || "—" },
    {
      key: "valid_until_bs",
      label: t("Valid Until", "मितिसम्म"),
      sortable: true,
      value: (sc) => sc.valid_until_bs ?? "",
      render: (sc) => (sc.valid_until_bs ? <span className="text-sm">{sc.valid_until_bs}</span> : <Badge variant="secondary">{t("Open-ended", "कुललाई")}</Badge>),
    },
    {
      key: "is_active",
      label: t("Status", "अवस्था"),
      sortable: true,
      value: (sc) => (sc.is_active ? "active" : "inactive"),
      render: (sc) => <StatusChip status={sc.is_active ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (sc) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(sc); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeScholarship(sc); }} aria-label={t("Delete scholarship", "मेटाउनुहोस")}>
            <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
          </Button>
        </div>
      ),
    },
  ];

  const visibleScholarships = scholarships.filter((sc) => !hiddenIds.has(sc.id));

  const isMutating = create.isPending || update.isPending;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Scholarships & Discounts", "छात्रवृत्ति र छुट")}
        subtitle={t(
          `${scholarships.length} defined · Per-student fee discounts automatically applied during fee generation.`,
          `${scholarships.length} व्याप्त · शुल्क बनको बेला अनुसर आफैनाइनहरू छुट लगछ`
        )}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> {t("Add Scholarship", "छात्रवृत्ति थप्नुहोस")}
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel>
          <DataTable
            columns={SCHOLARSHIP_COLUMNS}
            rows={visibleScholarships}
            rowKey={(sc) => sc.id}
            loading={isLoading}
            searchable
            searchPlaceholder={t("Search scholarships…", "खोज्नुहोस…")}
            exportFileName="scholarships"
            empty={{
              icon: GraduationCap,
              title: t("No scholarships defined", "छात्रवृत्ति छेन"),
              body: t("Add one to auto-discount student fees.", "छुट अपल्य गर्न थप्नुहोस।"),
              action: { label: t("Add Scholarship", "थप्नुहोस"), onClick: openCreate },
            }}
          />
        </DataPanel>

        {/* Add / Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editTarget ? t("Edit Scholarship", "सम्पादन") : t("Add Scholarship / Discount", "छात्रवृत्ति थप्नुहोस")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Student search */}
              <div className="space-y-2">
                <Label>{t("Student", "विद्यार्थी")} <span style={{ color: "#c42b1c" }}>*</span></Label>
                <Input
                  placeholder={t("Search student by name or enrollment…", "नाम वा भर्ना नंबरबाट खोज्नुहोस")}
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    if (!editTarget) setForm({ ...form, student_id: "" });
                  }}
                  disabled={!!editTarget}
                />
                {!editTarget && studentSearch.trim().length >= 2 && (
                  <div className="border border-[var(--w11-border-subtle)] rounded-md max-h-36 overflow-y-auto divide-y divide-[var(--w11-border-subtle)]">
                    {(studentsData || []).map((s: any) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[color:var(--w11-control-hover)] transition-colors"
                        onClick={() => {
                          setForm({ ...form, student_id: s.id });
                          setStudentSearch(s.full_name || `${s.first_name} ${s.last_name || ""}`);
                        }}
                      >
                        <span className="font-medium">{s.full_name || `${s.first_name} ${s.last_name || ""}`}</span>
                        {s.class_name && (
                          <span className="text-[color:var(--w11-text-secondary)] ml-2">{s.class_name}</span>
                        )}
                      </button>
                    ))}
                    {studentsData?.length === 0 && (
                      <p className="px-3 py-2 text-sm text-[color:var(--w11-text-secondary)]">{t("No students found", "विद्यार्थी बेटिएन")}</p>
                    )}
                  </div>
                )}
                {!editTarget && form.student_id && (
                  <p className="text-xs" style={{ color: "#107c10" }}>✓ {t("Student selected", "विद्यार्थी छानिये")}</p>
                )}
              </div>

              {/* Fee Type */}
              <div className="space-y-2">
                <Label>{t("Fee Type (leave blank to apply to all)", "शुल्क प्रकार (सबैमा खालि छोड्नु)")}</Label>
                <Input
                  placeholder={t("e.g. Tuition Fee (blank = all types)", "जस्ताई: पाठ शुल्क")}
                  value={form.fee_type}
                  onChange={(e) => setForm({ ...form, fee_type: e.target.value })}
                />
              </div>

              {/* Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("Discount Type", "छुट प्रकार")}</Label>
                  <AdvancedSelect
                    value={form.discount_type}
                    onChange={(v) => setForm({ ...form, discount_type: v as "percent" | "fixed" })}
                    options={[
                      { value: "percent", label: "Percentage (%)" },
                      { value: "fixed", label: "Fixed Amount (Rs.)" },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {form.discount_type === "percent" ? t("Discount %", "छुट %") : t("Amount (Rs.)", "रकम (रु.)")}
                  </Label>
                  <Input
                    type="number"
                    value={form.discount_value}
                    onChange={(e) =>
                      setForm({ ...form, discount_value: e.target.value })
                    }
                    min="0"
                    max={form.discount_type === "percent" ? "100" : undefined}
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>{t("Reason", "कारण")}</Label>
                <Input
                  placeholder={t("e.g. Merit scholarship, Financial aid…", "जस्ताई: प्रतिभत्ती छात्रवृत्ति…")}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>

              {/* Validity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("Valid From (BS)", "सुरु (बि.सं.)")}</Label>
                  <BSMonthInput
                    value={form.valid_from_bs}
                    onChange={(v) => setForm({ ...form, valid_from_bs: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Valid Until (BS, blank = open-ended)", "सम्म (बि.सं.)")}</Label>
                  <BSMonthInput
                    value={form.valid_until_bs}
                    onChange={(v) => setForm({ ...form, valid_until_bs: v })}
                  />
                </div>
              </div>

              <FormCheckbox
                label={t("Scholarship active", "सक्रिय छ")}
                description={t("Will be auto-applied during fee generation", "शुल्क बनदमा आफैनाइनहरू लग्नेछ")}
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                {t("Cancel", "रद्द")}
              </Button>
              <Button
                onClick={() => (editTarget ? update.mutate() : create.mutate())}
                disabled={
                  isMutating ||
                  (!editTarget && !form.student_id) ||
                  !form.discount_value
                }
              >
                {isMutating ? <Spinner className="mr-2" /> : null}
                {editTarget ? t("Save Changes", "सुरक्ष") : t("Create", "बनाउनुहोस")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
