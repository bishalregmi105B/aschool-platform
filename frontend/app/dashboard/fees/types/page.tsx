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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fee Types</h1>
          <p className="text-muted-foreground">
            Manage fee categories — used when defining fee structures and
            collecting payments
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Fee Type
        </Button>
      </div>

      {/* System Fee Types (read-only) */}
      {systemTypes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Default Fee Types
              <Badge variant="secondary" className="ml-1">
                System
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              These are standard fee types included with ASchool. You can
              add custom types below.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-wrap gap-2 px-6 pb-4">
              {systemTypes.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-muted/50 border rounded-lg px-3 py-1.5"
                >
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{t.name}</span>
                  {t.description && (
                    <span className="text-xs text-muted-foreground">
                      — {t.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Fee Types */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Custom Fee Types</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : customTypes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No custom fee types yet</p>
              <p className="text-sm mt-1">
                Add custom types for school-specific fee categories
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customTypes.map((ft) => (
                  <TableRow key={ft.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        {ft.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {ft.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(ft)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            ft.id && deleteMutation.mutate(ft.id)
                          }
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                Name <span className="text-destructive">*</span>
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
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
    </div>
  );
}
