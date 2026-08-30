"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Download, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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
      <div className="max-w-2xl mx-auto p-6">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load expense reports. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetchExpenses()}>Retry</Button>
        </CardContent></Card>
      </div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PieChart className="h-6 w-6" /> Expense Reports
          </h1>
          <p className="text-muted-foreground">Financial breakdown of school expenditures</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={distribution.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card className="md:col-span-1 bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Total Expenditure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center">
              <IndianRupee className="h-6 w-6 mr-1" />
              {totalExpense.toLocaleString()}
            </div>
            <p className="text-xs opacity-80 mt-1">For the selected period</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardContent className="p-4 flex gap-4 items-end">
            <div className="space-y-2 flex-1">
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
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Expenditure by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {distribution.map((item) => (
                    <TableRow key={item.catId}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right font-semibold">
                        Rs. {item.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                {distribution.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                      No expenses recorded for this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {distribution.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No expense distribution available.</p>
            ) : (
              <div className="space-y-4">
                {distribution.map((item) => (
                  <div key={item.catId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(2, item.percentage)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Rs. {item.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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
