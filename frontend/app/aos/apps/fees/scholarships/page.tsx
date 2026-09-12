"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BSMonthInput } from "@/components/ui/bs-date-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { FormCheckbox } from "@/components/ui/form-checkbox";
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
  const queryClient = useQueryClient();
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
      toast.success("Scholarship created successfully.");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || "Failed to create scholarship"),
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
      toast.success("Scholarship updated.");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || "Failed to update scholarship"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/fees/scholarships/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scholarships"] });
      toast.success("Scholarship deleted.");
    },
  });

  const SCHOLARSHIP_COLUMNS: Column<any>[] = [
    {
      key: "student_name",
      label: "Student",
      sortable: true,
      value: (sc) => sc.student_name ?? "",
      render: (sc) => (
        <div>
          <p className="font-medium">{sc.student_name}</p>
          {sc.roll_number && <p className="text-xs text-muted-foreground">#{sc.roll_number}</p>}
        </div>
      ),
    },
    { key: "class_name", label: "Class", sortable: true, value: (sc) => sc.class_name ?? "", render: (sc) => sc.class_name || "—" },
    { key: "fee_type", label: "Fee Type", value: (sc) => sc.fee_type ?? "", render: (sc) => <Badge variant="outline">{sc.fee_type || "All Types"}</Badge> },
    {
      key: "discount_value",
      label: "Discount",
      align: "right",
      sortable: true,
      value: (sc) => sc.discount_value ?? 0,
      render: (sc) => (
        <span className="font-semibold text-emerald-700">
          {sc.discount_type === "percent" ? `${sc.discount_value}%` : `Rs. ${sc.discount_value.toLocaleString()}`}
        </span>
      ),
    },
    { key: "reason", label: "Reason", value: (sc) => sc.reason ?? "", render: (sc) => sc.reason || "—" },
    {
      key: "valid_until_bs",
      label: "Valid Until",
      sortable: true,
      value: (sc) => sc.valid_until_bs ?? "",
      render: (sc) => (sc.valid_until_bs ? <span className="text-sm">{sc.valid_until_bs}</span> : <Badge variant="secondary">Open-ended</Badge>),
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      value: (sc) => (sc.is_active ? "active" : "inactive"),
      render: (sc) => <Badge variant={sc.is_active ? "success" : "secondary"}>{sc.is_active ? "Active" : "Inactive"}</Badge>,
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
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove.mutate(sc.id); }} disabled={remove.isPending}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <PageLoader />;

  const isMutating = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-emerald-600" />
            Scholarships & Discounts
          </h1>
          <p className="text-muted-foreground">
            Per-student fee discounts automatically applied during fee generation.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Scholarship
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {scholarships.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
              <GraduationCap className="h-10 w-10 opacity-40" />
              <p>No scholarships defined. Add one to auto-discount student fees.</p>
            </div>
          ) : (
            <DataTable
              columns={SCHOLARSHIP_COLUMNS}
              rows={scholarships}
              rowKey={(sc) => sc.id}
              searchable
              searchPlaceholder="Search scholarships…"
              exportFileName="scholarships"
            />
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Scholarship" : "Add Scholarship / Discount"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Student search */}
            <div className="space-y-2">
              <Label>Student</Label>
              <Input
                placeholder="Search student by name or enrollment…"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  if (!editTarget) setForm({ ...form, student_id: "" });
                }}
                disabled={!!editTarget}
              />
              {!editTarget && studentSearch.trim().length >= 2 && (
                <div className="border rounded-md max-h-36 overflow-y-auto divide-y">
                  {(studentsData || []).map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => {
                        setForm({ ...form, student_id: s.id });
                        setStudentSearch(s.full_name || `${s.first_name} ${s.last_name || ""}`);
                      }}
                    >
                      <span className="font-medium">{s.full_name || `${s.first_name} ${s.last_name || ""}`}</span>
                      {s.class_name && (
                        <span className="text-muted-foreground ml-2">{s.class_name}</span>
                      )}
                    </button>
                  ))}
                  {studentsData?.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No students found</p>
                  )}
                </div>
              )}
              {!editTarget && form.student_id && (
                <p className="text-xs text-emerald-600">✓ Student selected</p>
              )}
            </div>

            {/* Fee Type */}
            <div className="space-y-2">
              <Label>Fee Type (leave blank to apply to all)</Label>
              <Input
                placeholder="e.g. Tuition Fee (blank = all types)"
                value={form.fee_type}
                onChange={(e) => setForm({ ...form, fee_type: e.target.value })}
              />
            </div>

            {/* Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
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
                  {form.discount_type === "percent" ? "Discount %" : "Amount (Rs.)"}
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
              <Label>Reason</Label>
              <Input
                placeholder="e.g. Merit scholarship, Financial aid…"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            {/* Validity */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From (BS)</Label>
                <BSMonthInput
                  value={form.valid_from_bs}
                  onChange={(v) => setForm({ ...form, valid_from_bs: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until (BS, blank = open-ended)</Label>
                <BSMonthInput
                  value={form.valid_until_bs}
                  onChange={(v) => setForm({ ...form, valid_until_bs: v })}
                />
              </div>
            </div>

            <FormCheckbox
                label="Scholarship active"
                description="Will be auto-applied during fee generation"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
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
              {editTarget ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
