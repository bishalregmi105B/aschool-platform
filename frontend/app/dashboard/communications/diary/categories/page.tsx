"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ApiResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, BookOpen, Search, Pencil, Trash2, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";

interface DiaryCategory {
  id: string;
  name: string;
  color: string;
  active: boolean;
}

const colors = ["red", "blue", "green", "yellow", "purple", "gray"] as const;

const colorClass: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  gray: "bg-gray-500",
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

  const filtered = categories.filter((category) =>
    category.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Diary Categories
          </h1>
          <p className="text-muted-foreground">Manage categories for student diary remarks</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Category
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search categories..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category Name</TableHead>
                <TableHead>Color Tag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" /> {category.name}
                  </TableCell>
                  <TableCell>
                    <div className={`w-4 h-4 rounded-full ${colorClass[category.color] ?? colorClass.blue}`} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={category.active ? "success" : "secondary"}>
                      {category.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCategory.mutate(category.id)}
                      disabled={deleteCategory.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No diary categories found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                    className={`w-8 h-8 rounded-full ${colorClass[color]} border-2 ${
                      selectedColor === color ? "border-foreground" : "border-transparent"
                    }`}
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
    </div>
  );
}
