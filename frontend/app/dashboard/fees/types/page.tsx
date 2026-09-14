"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { undoableDelete } from "@/components/ui/confirm-dialog";
import { SkeletonTable } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel,
} from "@/components/aos/kit/page-kit";
import { Plus, Pencil, Trash2, Tag, Info } from "lucide-react";

interface FeeType {
  id?: string;
  name: string;
  description: string;
  is_system?: boolean;
}

/**
 * Fee types — A1 registry (plan 34-8): system defaults read-only, custom
 * types in a DataTable with undoable delete. ≤2 required fields.
 */
export default function FeeTypesPage() {
  return (
    <PluginGate slug="fees">
      <FeeTypesContent />
    </PluginGate>
  );
}

function FeeTypesContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<FeeType | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["fee-types"],
    queryFn: async () => {
      const res = await api.get("/fees/types");
      return (res.data.data || []) as FeeType[];
    },
  });

  const feeTypes: FeeType[] = data || [];
  const customTypes = feeTypes.filter((t) => t.id && !t.is_system);
  const systemTypes = feeTypes.filter((t) => !t.id || t.is_system);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setShowDialog(true);
  };

  const openEdit = (ft: FeeType) => {
    setEditing(ft);
    setForm({ name: ft.name, description: ft.description });
    setShowDialog(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => api.post("/fees/types", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      setShowDialog(false);
      toast.success(t("Fee type created", "शुल्क प्रकार बन्यो"));
    },
    onError: () => toast.error(t("Failed to create fee type", "बनाउन सकिएन")),
  });

  const updateMutation = useMutation({
    mutationFn: async () =>
      api.put(`/fees/types/${editing!.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      setShowDialog(false);
      toast.success(t("Fee type updated", "शुल्क प्रकार अद्यावधिक भयो"));
    },
    onError: () => toast.error(t("Failed to update fee type", "अद्यावधिक गर्न सकिएन")),
  });

  const removeFeeType = (ft: FeeType) => {
    if (!ft.id) return;
    const id = ft.id;
    undoableDelete({
      label: `${t("fee type", "शुल्क प्रकार")} "${ft.name}"`,
      optimistic: () => setHiddenIds((prev) => new Set(prev).add(id)),
      rollback: () =>
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
      commit: async () => {
        await api.delete(`/fees/types/${id}`);
        queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      },
    });
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (editing?.id) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const FEE_TYPE_COLUMNS: Column<FeeType>[] = [
    {
      key: "name",
      label: t("Name", "नाम"),
      sortable: true,
      value: (ft) => ft.name,
      render: (ft) => (
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5" style={{ color: "var(--w11-accent)" }} />
          <span className="font-medium">{ft.name}</span>
        </div>
      ),
    },
    { key: "description", label: t("Description", "विवरण"), value: (ft) => ft.description ?? "", render: (ft) => <span className="text-[color:var(--w11-text-secondary)] text-sm">{ft.description || "—"}</span> },
    {
      key: "actions",
      label: t("Actions", "कार्य"),
      noExport: true,
      render: (ft) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(ft); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              removeFeeType(ft);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" style={{ color: "#c42b1c" }} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Tag className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Fee Types", "शुल्क प्रकारहरू")}
        subtitle={t(
          "Manage fee categories — used when defining fee structures and collecting payments",
          "शुल्क श्रेणीहरू — संरचना र संकलनमा प्रयोग हुने"
        )}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> {t("Add Fee Type", "शुल्क प्रकार थप्नुहोस्")}
          </Button>
        }
      />
      <AOSPageBody className="space-y-4">
        {/* System Fee Types (read-only) */}
        {systemTypes.length > 0 && (
          <DataPanel
            title={
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                {t("Default Fee Types", "पूर्वनिर्धारित शुल्क प्रकार")}
                <Badge variant="secondary" className="ml-1">
                  {t("System", "सिस्टम")}
                </Badge>
              </span>
            }
            bodyClassName="p-0"
          >
            <p className="text-sm text-[color:var(--w11-text-secondary)] px-4 pt-3">
              {t("These are standard fee types included with ASchool. You can add custom types below.",
                 "यी ASchool का मानक शुल्क प्रकारहरू हुन्। तल आफ्नै प्रकार थप्न सक्नुहुन्छ।")}
            </p>
            <div className="flex flex-wrap gap-2 px-4 pt-3 pb-4">
              {systemTypes.map((st, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 border border-[var(--w11-border-default)] rounded-lg px-3 py-1.5"
                  style={{ background: "var(--w11-control-hover)" }}
                >
                  <Tag className="h-3.5 w-3.5 text-[color:var(--w11-text-secondary)]" />
                  <span className="text-sm font-medium">{st.name}</span>
                  {st.description && (
                    <span className="text-xs text-[color:var(--w11-text-secondary)]">
                      — {st.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </DataPanel>
        )}

        {/* Custom Fee Types */}
        <DataPanel title={t("Custom Fee Types", "आफ्नै शुल्क प्रकारहरू")} bodyClassName="p-0">
          {isLoading ? (
            <div className="p-4">
              <SkeletonTable rows={4} columns={3} />
            </div>
          ) : (
            <DataTable<FeeType>
              columns={FEE_TYPE_COLUMNS}
              rows={customTypes.filter((ft) => !ft.id || !hiddenIds.has(ft.id))}
              rowKey={(ft) => ft.id || ft.name}
              searchable
              searchPlaceholder={t("Search fee types…", "शुल्क प्रकार खोज्नुहोस्…")}
              exportFileName="fee-types"
              empty={{
                icon: Tag,
                title: t("No custom fee types yet", "अहिलेसम्म आफ्नै शुल्क प्रकार छैन"),
                body: t("Add custom types for school-specific fee categories.", "विद्यालय-विशिष्ट शुल्क श्रेणीका लागि प्रकार थप्नुहोस्।"),
                action: { label: t("Add Fee Type", "थप्नुहोस्"), onClick: openCreate },
              }}
            />
          )}
        </DataPanel>

        {/* Create / Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing?.id ? t("Edit Fee Type", "सम्पादन") : t("Create Fee Type", "नयाँ शुल्क प्रकार")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  {t("Name", "नाम")} <span style={{ color: "#c42b1c" }}>*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder={t("e.g. Computer Lab Fee", "जस्तै: कम्प्युटर ल्याब शुल्क")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Description", "विवरण")}</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm((d) => ({ ...d, description: e.target.value }))
                  }
                  placeholder={t("Brief description (optional)", "छोटो विवरण (वैकल्पिक)")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                {t("Cancel", "रद्द")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || !form.name.trim()}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="win11-spinner" />
                    {t("Saving…", "सुरक्षित हुँदै…")}
                  </span>
                ) : editing?.id ? (
                  t("Update", "अद्यावधिक")
                ) : (
                  t("Create", "बनाउनुहोस्")
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
