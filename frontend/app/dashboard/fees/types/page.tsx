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
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { Plus, Pencil, Trash2, Tag, Info } from "lucide-react";

interface FeeType {
  id?: string;
  name: string;
  description: string;
  is_system?: boolean;
}

export default function FeeTypesPage() {
  return (
    <PluginGate slug="fees">
      <FeeTypesContent />
    </PluginGate>
  );
}

function FeeTypesContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
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
      toast.success("Fee type created");
    },
    onError: () => toast.error("Failed to create fee type"),
  });

  const updateMutation = useMutation({
    mutationFn: async () =>
      api.put(`/fees/types/${editing!.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      setShowDialog(false);
      toast.success("Fee type updated");
    },
    onError: () => toast.error("Failed to update fee type"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      api.delete(`/fees/types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      toast.success("Fee type deleted");
    },
    onError: () => toast.error("Cannot delete this fee type"),
  });

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
      label: "Name",
      sortable: true,
      value: (ft) => ft.name,
      render: (ft) => (
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5" style={{ color: "var(--w11-accent)" }} />
          <span className="font-medium">{ft.name}</span>
        </div>
      ),
    },
    { key: "description", label: "Description", value: (ft) => ft.description ?? "", render: (ft) => <span className="text-[color:var(--w11-text-secondary)] text-sm">{ft.description || "—"}</span> },
    {
      key: "actions",
      label: "Actions",
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
              ft.id && deleteMutation.mutate(ft.id);
            }}
            disabled={deleteMutation.isPending}
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
        title="Fee Types"
        subtitle="Manage fee categories — used when defining fee structures and collecting payments"
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Fee Type
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
                Default Fee Types
                <Badge variant="secondary" className="ml-1">
                  System
                </Badge>
              </span>
            }
            bodyClassName="p-0"
          >
            <p className="text-sm text-[color:var(--w11-text-secondary)] px-4 pt-3">
              These are standard fee types included with ASchool. You can
              add custom types below.
            </p>
            <div className="flex flex-wrap gap-2 px-4 pt-3 pb-4">
              {systemTypes.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 border border-[var(--w11-border-default)] rounded-lg px-3 py-1.5"
                  style={{ background: "var(--w11-control-hover)" }}
                >
                  <Tag className="h-3.5 w-3.5 text-[color:var(--w11-text-secondary)]" />
                  <span className="text-sm font-medium">{t.name}</span>
                  {t.description && (
                    <span className="text-xs text-[color:var(--w11-text-secondary)]">
                      — {t.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </DataPanel>
        )}

        {/* Custom Fee Types */}
        <DataPanel title="Custom Fee Types" bodyClassName="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="win11-spinner" />
            </div>
          ) : customTypes.length === 0 ? (
            <AOSEmptyState
              icon={<Tag className="h-10 w-10" style={{ color: "var(--w11-text-tertiary)" }} />}
              title="No custom fee types yet"
              description="Add custom types for school-specific fee categories"
            />
          ) : (
            <DataTable<FeeType>
              columns={FEE_TYPE_COLUMNS}
              rows={customTypes}
              rowKey={(ft) => ft.id || ft.name}
              searchable
              searchPlaceholder="Search fee types…"
              exportFileName="fee-types"
              empty={{ icon: Tag, title: "No custom fee types yet", body: "Add custom types for school-specific fee categories." }}
            />
          )}
        </DataPanel>

        {/* Create / Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing?.id ? "Edit Fee Type" : "Create Fee Type"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Name <span style={{ color: "#c42b1c" }}>*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="e.g. Computer Lab Fee"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm((d) => ({ ...d, description: e.target.value }))
                  }
                  placeholder="Brief description (optional)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || !form.name.trim()}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="win11-spinner" />
                    Saving…
                  </span>
                ) : editing?.id ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
