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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, Receipt, Search, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Category {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category_id: string;
  category_name?: string;
  notes?: string;
  recorded_by_name?: string;
}

export default function ExpensesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: categoriesData } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Category[]>>("/hr/expense-categories");
      return res.data.data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Expense[]>>("/hr/expenses");
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post("/hr/expenses", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense recorded");
      setShowAdd(false);
    },
    onError: () => toast.error("Failed to record expense"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put(`/hr/expenses/${editItem?.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense updated");
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update expense"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
    },
    onError: () => toast.error("Failed to delete expense"),
  });

  if (isLoading) return <PageLoader />;

  const expenses = (data || []).filter((e: Expense) =>
    e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.category_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" /> Expenses
          </h1>
          <p className="text-muted-foreground">Manage and track school expenditures</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" /> Record Expense
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search expenses..."
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
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount (Rs.)</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e: Expense) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">
                    {e.date ? format(new Date(e.date), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                      {e.category_name}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold">Rs. {e.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{e.recorded_by_name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setEditItem(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if(confirm("Are you sure?")) deleteMutation.mutate(e.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No expenses found.
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
            <DialogTitle>{editItem ? "Edit Expense" : "Record Expense"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const payload = {
                title: fd.get("title"),
                amount: Number(fd.get("amount")),
                date: fd.get("date"),
                category_id: fd.get("category_id"),
                notes: fd.get("notes"),
              };
              if (editItem) updateMutation.mutate(payload);
              else createMutation.mutate(payload);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Title / Description</Label>
              <Input name="title" required defaultValue={editItem?.title} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (Rs.)</Label>
                <Input name="amount" type="number" step="0.01" required defaultValue={editItem?.amount} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input name="date" type="date" required defaultValue={editItem?.date ? editItem.date.split("T")[0] : new Date().toISOString().split("T")[0]} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select name="category_id" defaultValue={editItem?.category_id} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {(categoriesData || []).map((c: Category) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input name="notes" defaultValue={editItem?.notes} />
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
