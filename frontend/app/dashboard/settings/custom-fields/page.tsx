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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PluginGate } from "@/lib/plugins";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

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
    <PluginGate slug="settings_core">
      <CustomFieldsInner />
    </PluginGate>
  );
}

function CustomFieldsInner() {
  const qc = useQueryClient();
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
  });

  const rows = defs.data ?? [];

  return (
    <AOSPage>
      <AOSPageHeader
        title="Custom Registration Fields"
        subtitle="Add fields to registration forms and the public admission wizard"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add field
          </Button>
        }
      />
      <AOSPageBody>
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
        </FilterCommandBar>

        {defs.isLoading ? (
          <AOSModuleLoadingState label="Loading fields…" />
        ) : rows.length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              title="No custom fields yet"
              description="Added fields appear on the registration forms and the public admission wizard."
            />
          </DataPanel>
        ) : (
          <DataPanel bodyClassName="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-[var(--w11-border-subtle)]"
                  style={{ background: "var(--w11-control-hover)" }}
                >
                  <th
                    className="text-left px-4 py-2 font-semibold"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    Label
                  </th>
                  <th
                    className="text-left px-4 py-2 font-semibold"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    Type
                  </th>
                  <th
                    className="text-center px-4 py-2 font-semibold"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    Required
                  </th>
                  <th
                    className="text-center px-4 py-2 font-semibold"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    Active
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-[var(--w11-border-subtle)]">
                    <td className="px-4 py-2" style={{ color: "var(--w11-text-primary)" }}>
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
                    </td>
                    <td className="px-4 py-2" style={{ color: "var(--w11-text-secondary)" }}>{d.field_type}</td>
                    <td className="text-center" style={{ color: "var(--w11-text-primary)" }}>
                      {d.required ? <StatusChip status="active" label="Yes" /> : "—"}
                    </td>
                    <td className="text-center" style={{ color: "var(--w11-text-primary)" }}>
                      {d.is_active ? <StatusChip status="active" label="Yes" /> : "—"}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(d)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove.mutate(d.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      </AOSPageBody>
    </AOSPage>
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
        <div className="space-y-3">
          <Input
            placeholder="Label (English)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input
            placeholder="लेबल (नेपाली)"
            value={labelNepali}
            onChange={(e) => setLabelNepali(e.target.value)}
          />
          <select
            className="win11-select w-full"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {(fieldType === "select" || fieldType === "multiselect") && (
            <Input
              placeholder="Choices, comma separated (e.g. Red, Blue, Green)"
              value={choices}
              onChange={(e) => setChoices(e.target.value)}
            />
          )}
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2" style={{ color: "var(--w11-text-primary)" }}>
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              />
              Required
            </label>
            <label className="flex items-center gap-2" style={{ color: "var(--w11-text-primary)" }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
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
