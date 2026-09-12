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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Plus, Receipt, Pencil, Trash2 } from "lucide-react";

import { BSDateInput } from "@/components/ui/bs-date-input";
import { displayBS } from "@/lib/nepali_date";
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

  const { data: categoriesData } = useQuery<any>({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Category[]>>("/hr/expense-categories");
      return res.data.data;
    },
  });

  const { data, isLoading } = useQuery<any>({
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

  if (isLoading) return <AOSModuleLoadingState label="Loading expenses…" />;

  const expenses = (data || []).filter((e: Expense) =>
    e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.category_name?.toLowerCase().includes(search.toLowerCase())
  );
  const totalAmount = expenses.reduce((sum: number, e: Expense) => sum + (e.amount || 0), 0);

  const EXPENSE_COLUMNS: Column<Expense>[] = [
    { key: "date", label: "Date", sortable: true, value: (e) => e.date, render: (e) => <span className="whitespace-nowrap">{e.date ? displayBS(e.date) : "—"}</span> },
    { key: "title", label: "Title", sortable: true, value: (e) => e.title, render: (e) => <span className="font-medium">{e.title}</span> },
    { key: "category_name", label: "Category", sortable: true, value: (e) => e.category_name ?? "", render: (e) => (
      <span className="win11-chip subtle">{e.category_name}</span>
    ) },
    { key: "amount", label: "Amount (Rs.)", align: "right", sortable: true, value: (e) => e.amount, render: (e) => <span className="font-bold">Rs. {e.amount.toLocaleString()}</span> },
    { key: "recorded_by_name", label: "Recorded By", value: (e) => e.recorded_by_name ?? "", render: (e) => <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{e.recorded_by_name}</span> },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (e) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); setEditItem(e); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(ev) => {
            ev.stopPropagation();
            if(confirm("Are you sure?")) deleteMutation.mutate(e.id);
          }}>
            <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Receipt className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Expenses"
        subtitle={`${expenses.length} ${expenses.length === 1 ? "record" : "records"} · Rs. ${totalAmount.toLocaleString()} total`}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Record Expense
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable<Expense>
            columns={EXPENSE_COLUMNS}
            rows={expenses}
            rowKey={(e) => e.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search expenses..."
            exportFileName="expenses"
            empty={{ icon: Receipt, title: "No expenses found", body: "Record your first school expenditure.", action: { label: "Record Expense", onClick: () => setShowAdd(true) } }}
          />
        </DataPanel>

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
                  <BSDateInput name="date" required value={editItem?.date ? editItem.date.split("T")[0] : undefined} />
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
      </AOSPageBody>
    </AOSPage>
  );
}
