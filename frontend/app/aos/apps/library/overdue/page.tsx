"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { PaginationMeta } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { AlertCircle, BookOpen, RotateCcw } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function OverduePage() {
  return <PluginGate slug="library"><OverdueContent /></PluginGate>;
}

function OverdueContent() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  // FC-A04: the backend computes overdue live (status=overdue = issued AND
  // due_date < today). The old client-side filter fetched every issued issue,
  // dropped the pagination envelope, and only ever showed page 1.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["library-overdue", page],
    queryFn: async () => {
      const r = await api.get("/library/issues", {
        params: { status: "overdue", page },
      });
      return {
        rows: (r.data?.data || []) as any[],
        meta: (r.data?.meta as any)?.pagination as PaginationMeta | undefined,
      };
    },
    retry: 1,
  });

  const returnMutation = useMutation({
    mutationFn: async (issueId: string) => (await api.post(`/library/issues/${issueId}/return`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-overdue"] });
      toast.success("Book returned");
    },
    onError: () => toast.error("Failed to process return"),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load overdue books. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  const overdue = data?.rows || [];
  const meta = data?.meta;

  const OVERDUE_COLUMNS: Column<any>[] = [
    { key: "book", label: "Book", sortable: true, value: (i) => i.book_title ?? "", render: (i) => (
      <div className="flex items-center gap-2 font-medium">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        {i.book_title || i.book_id}
      </div>
    ) },
    { key: "student", label: "Student", sortable: true, value: (i) => i.student_name ?? "", render: (i) => i.student_name || i.student_id },
    { key: "issued_date", label: "Issue Date", sortable: true, value: (i) => i.issued_date ?? "", render: (i) => <span className="text-sm">{i.issued_date ? displayBS(i.issued_date) : "—"}</span> },
    { key: "due_date", label: "Due Date", sortable: true, value: (i) => i.due_date ?? "", render: (i) => <span className="text-sm">{i.due_date ? displayBS(i.due_date) : "—"}</span> },
    {
      key: "days_overdue",
      label: "Days Overdue",
      align: "right",
      sortable: true,
      value: (i) => Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000),
      render: (i) => {
        const daysOverdue = Math.floor((Date.now() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24));
        return <Badge variant="destructive">{daysOverdue} day{daysOverdue !== 1 ? "s" : ""}</Badge>;
      },
    },
    {
      key: "action",
      label: "Action",
      noExport: true,
      render: (i) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); returnMutation.mutate(i.id); }} disabled={returnMutation.isPending}>
          <RotateCcw className="h-3 w-3 mr-1" /> Return
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" /> Overdue Books
          </h1>
          <p className="text-muted-foreground">Books past their due date — {meta?.total ?? overdue.length} overdue</p>
        </div>
      </div>

      {overdue.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No overdue books</p>
          <p className="text-sm">All borrowed books are within their due date.</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6">
          <DataTable
            columns={OVERDUE_COLUMNS}
            rows={overdue}
            rowKey={(i: any) => i.id}
            searchable
            searchPlaceholder="Search books or students…"
            exportFileName="library-overdue"
            pagination={meta}
            onPageChange={setPage}
          />
        </CardContent></Card>
      )}
    </div>
  );
}
