"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ApiResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Plus, BookOpen, Pencil, Trash2, Tag } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

interface DiaryCategory {
  id: string;
  name: string;
  color: string;
  active: boolean;
}

const colors = ["red", "blue", "green", "yellow", "purple", "gray"] as const;

const colorHex: Record<string, string> = {
  red: "#c42b1c",
  blue: "#0067c0",
  green: "#107c10",
  yellow: "#ffb900",
  purple: "#8764b8",
  gray: "#5d5d5d",
};

export default function DiaryCategoriesPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<DiaryCategory | null>(null);
  const [selectedColor, setSelectedColor] = useState("blue");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["diary-categories"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DiaryCategory[]>>("/communications/diary/categories");
      return res.data.data ?? [];
    },
  });

  const saveCategory = useMutation({
    mutationFn: async (formData: FormData) => {
      const payload = {
        name: String(formData.get("name") || "").trim(),
        color: selectedColor,
        active: true,
      };
      if (!payload.name) throw new Error("Category name is required");

      if (editItem) {
        return api.put(`/communications/diary/categories/${editItem.id}`, payload);
      }
      return api.post("/communications/diary/categories", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary-categories"] });
      setShowAdd(false);
      setEditItem(null);
      toast.success("Diary category saved");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.message || "Failed to save category");
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => api.delete(`/communications/diary/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary-categories"] });
      toast.success("Diary category deleted");
    },
    onError: () => toast.error("Failed to delete category"),
  });

  const openCreate = () => {
    setEditItem(null);
    setSelectedColor("blue");
    setShowAdd(true);
  };

  const openEdit = (category: DiaryCategory) => {
    setEditItem(category);
    setSelectedColor(category.color || "blue");
    setShowAdd(true);
  };

  const CATEGORY_COLUMNS: Column<DiaryCategory>[] = [
    {
      key: "name",
      label: "Category Name",
      sortable: true,
      value: (c) => c.name,
      render: (c) => (
        <span className="font-medium flex items-center gap-2">
          <Tag className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} /> {c.name}
        </span>
      ),
    },
    {
      key: "color",
      label: "Color Tag",
      value: (c) => c.color,
      render: (c) => <div className="w-4 h-4 rounded-full" style={{ background: colorHex[c.color] ?? colorHex.blue }} />,
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      value: (c) => (c.active ? "active" : "inactive"),
      render: (c) => (
        <StatusChip status={c.active ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (c) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); deleteCategory.mutate(c.id); }}
            disabled={deleteCategory.isPending}
          >
            <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading diary categories…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Diary Categories"
        subtitle={`${categories.length} ${categories.length === 1 ? "category" : "categories"} for student diary remarks`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Add Category
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable<DiaryCategory>
            columns={CATEGORY_COLUMNS}
            rows={categories}
            rowKey={(c) => c.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search categories..."
            exportFileName="diary-categories"
            empty={{
              icon: BookOpen,
              title: "No diary categories found",
              body: "Create categories like Health Issue, Good Work, Needs Attention.",
              action: { label: "Add Category", onClick: openCreate },
            }}
          />
        </DataPanel>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? "Edit Category" : "Add Category"}</DialogTitle>
            </DialogHeader>
            <form action={(formData) => saveCategory.mutate(formData)} className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input name="name" required defaultValue={editItem?.name} placeholder="e.g. Health Issue" />
              </div>
              <div className="space-y-2">
                <Label>Color Code</Label>
                <div className="flex gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Use ${color}`}
                      onClick={() => setSelectedColor(color)}
                      className="w-8 h-8 rounded-full border-2"
                      style={{
                        background: colorHex[color],
                        borderColor: selectedColor === color ? "var(--w11-text-primary)" : "transparent",
                      }}
                    />
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit" disabled={saveCategory.isPending}>
                  {saveCategory.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
