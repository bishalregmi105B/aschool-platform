"use client";

/**
 * S-A5 (A-35): dynamic registration/custom-field manager — schools add
 * fields to the student/staff registration forms (and the public admission
 * wizard) without code; values validate server-side.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Trash2, ClipboardList } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { AppGate } from "@/lib/apps";
import {
  FilterCommandBar,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { SettingsPage } from "../settings-page";

interface FieldDef {
  id: string;
  form_name: string;
  label: string;
  label_nepali?: string | null;
  field_type: string;
  required: boolean;
  choices: string[];
  rank: number;
  is_active: boolean;
}

const FORMS = ["student_registration", "staff_registration"];
const TYPES = ["text", "textarea", "number", "date", "select", "multiselect", "checkbox"];

export default function CustomFieldsPage() {
  return (
    <AppGate slug="settings_core">
      <CustomFieldsInner />
    </AppGate>
  );
}

function CustomFieldsInner() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [form, setForm] = useState("student_registration");
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [creating, setCreating] = useState(false);

  const defs = useQuery({
    queryKey: ["custom-field-defs", form],
    queryFn: async () => {
      const res = await api.get("/custom-fields/defs", {
        params: { form_name: form },
      });
      return res.data.data.defs as FieldDef[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["custom-field-defs"] });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/custom-fields/defs/${id}`);
    },
    onSuccess: () => {
      toast.success("Field deleted");
      invalidate();
    },
    onError: () => toast.error("Delete failed"),
  });

  const rows = defs.data ?? [];

  const fieldColumns: Column<FieldDef>[] = [
    {
      key: "label",
      label: "Label",
      sortable: true,
      value: (d) => d.label,
      render: (d) => (
        <span>
          {d.label}
          {d.label_nepali ? (
            <span style={{ color: "var(--w11-text-tertiary)" }}> · {d.label_nepali}</span>
          ) : null}
          {d.field_type.includes("select") && d.choices?.length ? (
            <span className="text-xs" style={{ color: "var(--w11-text-tertiary)" }}>
              {" "}
              ({d.choices.join(", ")})
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "type",
      label: "Type",
      value: (d) => d.field_type,
      render: (d) => (
        <span style={{ color: "var(--w11-text-secondary)" }}>{d.field_type}</span>
      ),
    },
    {
      key: "required",
      label: "Required",
      align: "center",
      value: (d) => (d.required ? 1 : 0),
      render: (d) => (d.required ? <StatusChip status="active" label="Yes" /> : "—"),
    },
    {
      key: "active",
      label: "Active",
      align: "center",
      value: (d) => (d.is_active ? 1 : 0),
      render: (d) => (d.is_active ? <StatusChip status="active" label="Yes" /> : "—"),
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (d) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(d)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              confirm({
                title: "Delete field",
                body: `Delete "${d.label}"? Existing values already saved on students stay in the database but are no longer shown or editable.`,
                confirmLabel: "Delete",
              }).then((ok) => {
                if (ok) remove.mutate(d.id);
              });
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <SettingsPage
      active="custom-fields"
      icon={<ClipboardList className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
      title="Custom Registration Fields"
      subtitle="Extra fields added to enrollment forms — values validate server-side"
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add field
        </Button>
      }
    >
      <FilterCommandBar>
        {FORMS.map((f) => (
          <button
            key={f}
            onClick={() => setForm(f)}
            className={`win11-chip ${form === f ? "accent" : ""} cursor-pointer`}
            style={{ textTransform: "capitalize" }}
          >
            {f.replace("_", " ")}
          </button>
        ))}
        <span className="text-[11px]" style={{ color: "var(--w11-text-tertiary)" }}>
          Fields below apply to the selected form, in list order.
        </span>
      </FilterCommandBar>

      {defs.isLoading ? (
        <AOSModuleLoadingState label="Loading fields…" />
      ) : rows.length === 0 ? (
        <DataPanel>
          <AOSEmptyState
            title="No custom fields yet"
            description="Added fields appear on the registration forms and the public admission wizard."
            action={{ label: "Add first field", onClick: () => setCreating(true) }}
          />
        </DataPanel>
      ) : (
          <DataPanel bodyClassName="p-0">
            <DataTable
              columns={fieldColumns}
              rows={rows}
              rowKey={(d) => d.id}
              dense
              empty={{ title: "No custom fields yet" }}
            />
          </DataPanel>
        )}

        {(creating || editing) && (
          <FieldDialog
            form={form}
            existing={editing}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        )}
    </SettingsPage>
  );
}

function FieldDialog({
  form,
  existing,
  onClose,
}: {
  form: string;
  existing: FieldDef | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(existing?.label ?? "");
  const [labelNepali, setLabelNepali] = useState(existing?.label_nepali ?? "");
  const [fieldType, setFieldType] = useState(existing?.field_type ?? "text");
  const [required, setRequired] = useState(existing?.required ?? false);
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [choices, setChoices] = useState((existing?.choices ?? []).join(", "));

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        form_name: existing?.form_name ?? form,
        label,
        label_nepali: labelNepali || undefined,
        field_type: fieldType,
        required,
        is_active: isActive,
        choices:
          fieldType === "select" || fieldType === "multiselect"
            ? choices.split(",").map((c) => c.trim()).filter(Boolean)
            : [],
        rank: existing?.rank ?? 0,
      };
      if (existing) {
        return api.put(`/custom-fields/defs/${existing.id}`, payload);
      }
      return api.post("/custom-fields/defs", payload);
    },
    onSuccess: () => {
      toast.success("Field saved");
      qc.invalidateQueries({ queryKey: ["custom-field-defs"] });
      onClose();
    },
    onError: () => toast.error("Save failed"),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit field" : "New field"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cf-label">Label (English)</Label>
            <Input
              id="cf-label"
              placeholder="e.g. Blood Group"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            {!label.trim() && (
              <p className="text-[11px] mt-1" style={{ color: "var(--w11-danger, #c42b1c)" }}>
                Label is required.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="cf-label-ne">Label (नेपाली)</Label>
            <Input
              id="cf-label-ne"
              placeholder="जस्तै: रगत समूह"
              value={labelNepali}
              onChange={(e) => setLabelNepali(e.target.value)}
            />
            <p className="text-[11px] mt-1" style={{ color: "var(--w11-text-tertiary)" }}>
              Shown alongside the English label when the form is in Nepali.
            </p>
          </div>
          <div>
            <Label>Field type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(fieldType === "select" || fieldType === "multiselect") && (
            <div>
              <Label htmlFor="cf-choices">Choices</Label>
              <Input
                id="cf-choices"
                placeholder="Comma separated (e.g. Red, Blue, Green)"
                value={choices}
                onChange={(e) => setChoices(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="cf-required">Required</Label>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--w11-text-tertiary)" }}>
                  Registration can&rsquo;t be submitted until this field is filled.
                </p>
              </div>
              <Switch
                id="cf-required"
                checked={required}
                onCheckedChange={setRequired}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="cf-active">Active</Label>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--w11-text-tertiary)" }}>
                  Inactive fields stop appearing on forms but keep their data.
                </p>
              </div>
              <Switch
                id="cf-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !label.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
