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

interface Category {
  id: string;
  name: string;
  description: string;
}

export default function ExpenseCategoriesPage() {
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
      toast.success("Category added");
      setShowAdd(false);
    },
    onError: () => toast.error("Failed to add category"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put(`/hr/expense-categories/${editItem?.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success("Category updated");
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update category"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/expense-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success("Category deleted");
    },
    onError: () => toast.error("Failed to delete category"),
  });

  const CATEGORY_COLUMNS: Column<Category>[] = [
    { key: "name", label: "Category Name", sortable: true, value: (c) => c.name ?? "", render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "description", label: "Description", value: (c) => c.description ?? "", render: (c) => <span style={{ color: "var(--w11-text-secondary)" }}>{c.description || "—"}</span> },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (c) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditItem(c); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => {
            e.stopPropagation();
            if(confirm("Are you sure?")) deleteMutation.mutate(c.id);
          }}>
            <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading categories…" />;

  const categories = (data || []).filter((c: Category) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Tags className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Expense Categories"
        subtitle={`${categories.length} ${categories.length === 1 ? "category" : "categories"} for school expenses`}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Category
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable<Category>
            columns={CATEGORY_COLUMNS}
            rows={categories}
            rowKey={(c) => c.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search categories..."
            exportFileName="expense-categories"
            empty={{ icon: Tags, title: "No categories found", body: "Add categories like Transport, Utilities, Maintenance.", action: { label: "Add Category", onClick: () => setShowAdd(true) } }}
          />
        </DataPanel>

        <Dialog open={showAdd || !!editItem} onOpenChange={(open) => {
          if (!open) { setShowAdd(false); setEditItem(null); }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? "Edit Category" : "Add Category"}</DialogTitle>
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
                <Label>Name</Label>
                <Input name="name" required defaultValue={editItem?.name} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input name="description" defaultValue={editItem?.description} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Spinner size="sm" /> : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
