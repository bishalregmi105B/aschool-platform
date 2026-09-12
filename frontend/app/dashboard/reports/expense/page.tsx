"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PieChart, Download, IndianRupee, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
} from "@/components/aos/kit/page-kit";

interface Expense {
  id: string;
  category_id: string;
  amount: number;
  date: string;
  description: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

export default function ExpenseReportsPage() {
  const [period, setPeriod] = useState("this_month");

  const { data: expenses, isLoading: expensesLoading, isError: expensesError, refetch: refetchExpenses } = useQuery({
    queryKey: ["expenses-all"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Expense[]>>("/hr/expenses");
      return res.data.data;
    },
    retry: 1,
  });

  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ExpenseCategory[]>>("/hr/expense-categories");
      return res.data.data;
    },
  });

  if (expensesError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<PieChart className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Expense Reports"
          subtitle="Financial breakdown of school expenditures"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load expense reports. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetchExpenses()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }
  if (expensesLoading) return <PageLoader />;

  const filteredExpenses = (expenses || []).filter((expense) => isExpenseInPeriod(expense.date, period));
  const totalExpense = filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

  const groupedByCategory = filteredExpenses.reduce((acc: Record<string, number>, curr) => {
    acc[curr.category_id] = (acc[curr.category_id] || 0) + Number(curr.amount);
    return acc;
  }, {});
  const distribution = Object.entries(groupedByCategory)
    .map(([catId, amount]) => ({
      catId,
      amount,
      name: categories?.find((c) => c.id === catId)?.name || "Unknown",
      percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const exportCsv = () => {
    const rows = [
      ["Category", "Amount", "Share"],
      ...distribution.map((item) => [
        item.name,
        item.amount.toString(),
        `${item.percentage.toFixed(1)}%`,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `expense-report-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const EXPENSE_DIST_COLUMNS: Column<any>[] = [
    { key: "name", label: "Category", sortable: true, value: (d) => d.name ?? "", render: (d) => <span className="font-medium">{d.name}</span> },
    { key: "amount", label: "Total Amount", align: "right", sortable: true, value: (d) => d.amount ?? 0, render: (d) => <span className="font-semibold">Rs. {d.amount.toLocaleString()}</span> },
    { key: "percentage", label: "Share", align: "right", sortable: true, value: (d) => d.percentage ?? 0, render: (d) => `${d.percentage?.toFixed?.(1) ?? d.percentage ?? 0}%` },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<PieChart className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Expense Reports"
        subtitle="Financial breakdown of school expenditures"
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={distribution.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        }
      />
      <AOSPageBody>
        <FilterCommandBar>
          <div className="space-y-2 w-64">
            <Label>Time Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="this_year">This Academic Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterCommandBar>

        <StatGrid min={220} className="mb-0">
          <KpiCard
            label="Total Expenditure"
            value={totalExpense.toLocaleString()}
            icon={<IndianRupee className="h-5 w-5" />}
            footnote="For the selected period"
          />
        </StatGrid>

        <div className="grid md:grid-cols-2 gap-4">
          <DataPanel title="Expenditure by Category">
            <DataTable
              columns={EXPENSE_DIST_COLUMNS}
              rows={distribution}
              rowKey={(d: any) => d.catId}
              searchable
              searchPlaceholder="Search categories…"
              exportFileName="expense-by-category"
              empty={{ icon: Receipt, title: "No expenses recorded for this period." }}
            />
          </DataPanel>

          <DataPanel title="Expense Distribution">
            {distribution.length === 0 ? (
              <p className="text-center py-8 text-[color:var(--w11-text-secondary)]">No expense distribution available.</p>
            ) : (
              <div className="space-y-4">
                {distribution.map((item) => (
                  <div key={item.catId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-[color:var(--w11-text-secondary)]">{item.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--w11-control-hover)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(2, item.percentage)}%`, background: "var(--w11-accent)" }}
                      />
                    </div>
                    <p className="text-xs text-[color:var(--w11-text-secondary)]">Rs. {item.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}

function isExpenseInPeriod(dateText: string, period: string) {
  if (!dateText) return true;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return true;

  const now = new Date();
  if (period === "this_month") {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  if (period === "last_month") {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.getFullYear() === lastMonth.getFullYear() && date.getMonth() === lastMonth.getMonth();
  }
  if (period === "this_year") {
    return date.getFullYear() === now.getFullYear();
  }
  return true;
}
