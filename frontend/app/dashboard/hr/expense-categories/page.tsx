"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Plus, Tags, Pencil, Trash2 } from "lucide-react";
import { undoableDelete } from "@/components/ui/confirm-dialog";
import { SkeletonTable } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

interface Category {
  id: string;
  name: string;
  description: string;
}

export default function ExpenseCategoriesPage() {
  const { t } = useI18n();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Category[]>>("/hr/expense-categories");
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post("/hr/expense-categories", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success(t("Category added", "श्रेणी थपीको"));
      setShowAdd(false);
    },
    onError: () => toast.error(t("Failed to add category", "थपाउन सकिएन")),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put(`/hr/expense-categories/${editItem?.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success(t("Category updated", "अपडेट भए"));
      setEditItem(null);
    },
    onError: () => toast.error(t("Failed to update category", "अपडेट सकिएन")),
  });

  const removeCategory = (c: Category) => {
    undoableDelete({
      label: `${t("category", "श्रेणी")} "${c.name}"`,
      optimistic: () => setHiddenIds((prev) => new Set(prev).add(c.id)),
      rollback: () =>
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(c.id);
          return next;
        }),
      commit: async () => {
        await api.delete(`/hr/expense-categories/${c.id}`);
        queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      },
    });
  };

  const CATEGORY_COLUMNS: Column<Category>[] = [
    { key: "name", label: t("Category Name", "श्रेणी नाम"), sortable: true, value: (c) => c.name ?? "", render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "description", label: t("Description", "विवरण"), value: (c) => c.description ?? "", render: (c) => <span style={{ color: "var(--w11-text-secondary)" }}>{c.description || "—"}</span> },
    {
      key: "actions",
      label: t("Actions", "कार्य"),
      noExport: true,
      render: (c) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditItem(c); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => {
            e.stopPropagation();
            removeCategory(c);
          }}>
            <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
          </Button>
        </div>
      ),
    },
  ];

  const categories = (data || [])
    .filter((c: Category) => !hiddenIds.has(c.id))
    .filter((c: Category) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Tags className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Expense Categories", "खर्च श्रेणी")}
        subtitle={`${categories.length} ${t("categories", "श्रेणी")} · ${t("for school expenses", "विद्यालय खर्चका लागि")}`}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t("Add Category", "श्रेणी थप्नु")}
          </Button>
        }
      />
      <AOSPageBody>
        {isLoading ? (
          <div className="win11-card p-4"><SkeletonTable rows={5} columns={3} /></div>
        ) : (
        <DataPanel bodyClassName="p-0">
          <DataTable<Category>
            columns={CATEGORY_COLUMNS}
            rows={categories}
            rowKey={(c) => c.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t("Search categories…", "खोज्नु…")}
            exportFileName="expense-categories"
            empty={{ icon: Tags, title: t("No categories found", "कुनै श्रेणी छेन"), body: t("Add categories like Transport, Utilities, Maintenance.", "यातायत, सेवा, मरमत जस्ता श्रेणी थप्नु।"), action: { label: t("Add Category", "थप्नु"), onClick: () => setShowAdd(true) } }}
          />
        </DataPanel>
        )}

        <Dialog open={showAdd || !!editItem} onOpenChange={(open) => {
          if (!open) { setShowAdd(false); setEditItem(null); }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? t("Edit Category", "सम्पादन") : t("Add Category", "नयाँ श्रेणी")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload = {
                  name: fd.get("name"),
                  description: fd.get("description"),
                };
                if (editItem) updateMutation.mutate(payload);
                else createMutation.mutate(payload);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>{t("Name", "नाम")}</Label>
                <Input name="name" required defaultValue={editItem?.name} />
              </div>
              <div className="space-y-2">
                <Label>{t("Description", "विवरण")}</Label>
                <Input name="description" defaultValue={editItem?.description} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>
                  {t("Cancel", "रद्द")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Spinner size="sm" /> : t("Save", "सुरक्ष")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
