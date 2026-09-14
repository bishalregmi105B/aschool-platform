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
  KpiCard,
  StatGrid,
} from "@/components/aos/kit/page-kit";
import { ErrorState, DependencyMissingEmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton";
import { undoableDelete } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n";
import { formatNepaliCurrency } from "@/lib/nepali-utils";
import { Plus, Receipt, Pencil, Trash2 } from "lucide-react";

import { BSDateInput } from "@/components/ui/bs-date-input";
import { displayBS } from "@/lib/nepali_date";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
  const { t } = useI18n();
  const confirm = useConfirm();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
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
      toast.success(t("Expense recorded", "खर्च पुन्जियो"));
      setShowAdd(false);
    },
    onError: () => toast.error(t("Failed to record expense", "पुन्जाउन सकिएन")),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put(`/hr/expenses/${editItem?.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(t("Expense updated", "अपडेट भए"));
      setEditItem(null);
    },
    onError: () => toast.error(t("Failed to update expense", "अपडेट सकिएन")),
  });

  const removeExpense = (e: Expense) => {
    undoableDelete({
      label: `${t("expense", "खर्च")} "${e.title}"`,
      optimistic: () => setHiddenIds((prev) => new Set(prev).add(e.id)),
      rollback: () =>
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(e.id);
          return next;
        }),
      commit: async () => {
        await api.delete(`/hr/expenses/${e.id}`);
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
      },
    });
  };

  const expensesAll = (data || []).filter((e: Expense) => !hiddenIds.has(e.id));
  const expenses = (expensesAll || []).filter((e: Expense) =>
    e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.category_name?.toLowerCase().includes(search.toLowerCase())
  );
  const totalAmount = expenses.reduce((sum: number, e: Expense) => sum + (e.amount || 0), 0);

  const EXPENSE_COLUMNS: Column<Expense>[] = [
    { key: "date", label: t("Date", "मिति"), sortable: true, value: (e) => e.date, render: (e) => <span className="whitespace-nowrap">{e.date ? displayBS(e.date) : "—"}</span> },
    { key: "title", label: t("Title", "शीर्षक"), sortable: true, value: (e) => e.title, render: (e) => <span className="font-medium">{e.title}</span> },
    { key: "category_name", label: t("Category", "श्रेणी"), sortable: true, value: (e) => e.category_name ?? "", render: (e) => (
      <span className="win11-chip subtle">{e.category_name}</span>
    ) },
    { key: "amount", label: t("Amount (Rs.)", "रकम (रु.)"), align: "right", sortable: true, value: (e) => e.amount, render: (e) => <span className="font-bold tabular-nums">Rs. {e.amount.toLocaleString()}</span> },
    { key: "recorded_by_name", label: t("Recorded By", "पुन्जीकरण"), value: (e) => e.recorded_by_name ?? "", render: (e) => <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{e.recorded_by_name}</span> },
    {
      key: "actions",
      label: t("Actions", "कार्य"),
      noExport: true,
      render: (e) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); setEditItem(e); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(ev) => {
            ev.stopPropagation();
            removeExpense(e);
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
        title={t("Expenses", "खर्चहरु")}
        subtitle={`${formatNepaliCurrency(totalAmount)} · ${expenses.length} ${t("records", "रटहर")}`}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t("Record Expense", "खर्च पुन्जाउनु")}
          </Button>
        }
      />
      <AOSPageBody className="space-y-4">
        <StatGrid className="mb-0" min={180}>
          <KpiCard label={t("Total Spent", "कुल खर्च")} value={formatNepaliCurrency(totalAmount)} color="#d83b01" />
          <KpiCard label={t("Records", "रटहर")} value={expenses.length} />
        </StatGrid>
        {isLoading ? (
          <div className="win11-card p-4"><SkeletonTable rows={6} columns={6} /></div>
        ) : (categoriesData || []).length === 0 ? (
          <DataPanel>
            <DependencyMissingEmptyState
              title={t("No expense categories exist", "खर्च श्रेणी छेन")}
              body={t("Create a category before recording expenses.", "खर्च पुन्जाउनपुर्व श्रेणी बनइन।")}
              prerequisiteName={t("Expense Categories", "खर्च श्रेणी")}
              setupHref="/dashboard/hr/expense-categories"
              setupLabel={t("Manage categories", "श्रेणी लाग्नुहोस्")}
            />
          </DataPanel>
        ) : (
        <DataPanel bodyClassName="p-0">
          <DataTable<Expense>
            columns={EXPENSE_COLUMNS}
            rows={expenses}
            rowKey={(e) => e.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t("Search expenses…", "खर्च खोज्नु…")}
            exportFileName="expenses"
            empty={{ icon: Receipt, title: t("No expenses found", "कुनै खर्च छेन"), body: t("Record your first school expenditure.", "पहिलो खर्च पुन्जाउनु।"), action: { label: t("Record Expense", "पुन्जाउनु"), onClick: () => setShowAdd(true) } }}
          />
        </DataPanel>
        )}

        <Dialog open={showAdd || !!editItem} onOpenChange={(open) => {
          if (!open) { setShowAdd(false); setEditItem(null); }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? t("Edit Expense", "सम्पादन") : t("Record Expense", "खर्च पुन्जाउनु")}</DialogTitle>
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
                <Label>{t("Title / Description", "शीर्षक / विवरण")}</Label>
                <Input name="title" required defaultValue={editItem?.title} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("Amount (Rs.)", "रकम (रु.)")}</Label>
                  <Input name="amount" type="number" step="0.01" required defaultValue={editItem?.amount} />
                </div>
                <div className="space-y-2">
                  <Label>{t("Date", "मिति")}</Label>
                  <BSDateInput name="date" required value={editItem?.date ? editItem.date.split("T")[0] : undefined} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("Category", "श्रेणी")}</Label>
                <Select name="category_id" defaultValue={editItem?.category_id} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select a category", "श्रेणी छान्नु")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(categoriesData || []).map((c: Category) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("Notes (Optional)", "टिप्पणी")}</Label>
                <Input name="notes" defaultValue={editItem?.notes} />
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
