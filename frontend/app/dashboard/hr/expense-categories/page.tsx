"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
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
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, Tags, Search, Pencil, Trash2 } from "lucide-react";

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

  if (isLoading) return <PageLoader />;

  const categories = (data || []).filter((c: Category) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tags className="h-6 w-6" /> Expense Categories
          </h1>
          <p className="text-muted-foreground">Manage classifications for school expenses</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
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
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c: Category) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.description || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setEditItem(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if(confirm("Are you sure?")) deleteMutation.mutate(c.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No categories found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
    </div>
  );
}
