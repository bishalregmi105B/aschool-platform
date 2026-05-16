"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  const { data, isLoading } = useQuery({
    queryKey: ["library-overdue"],
    queryFn: async () => {
      const r = await api.get("/library/issues", { params: { status: "issued" } });
      const all: any[] = r.data?.data || [];
      const today = new Date();
      return all.filter((issue: any) => issue.due_date && new Date(issue.due_date) < today);
    },
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

  const overdue = data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" /> Overdue Books
          </h1>
          <p className="text-muted-foreground">Books past their due date — {overdue.length} overdue</p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Days Overdue</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdue.map((issue: any) => {
                const daysOverdue = Math.floor((new Date().getTime() - new Date(issue.due_date).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <TableRow key={issue.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        {issue.book?.title || issue.book_id}
                      </div>
                    </TableCell>
                    <TableCell>{issue.student?.name || issue.student_id}</TableCell>
                    <TableCell className="text-sm">{issue.issue_date ? displayBS(issue.issue_date) : "—"}</TableCell>
                    <TableCell className="text-sm">{issue.due_date ? displayBS(issue.due_date) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{daysOverdue} day{daysOverdue !== 1 ? "s" : ""}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => returnMutation.mutate(issue.id)} disabled={returnMutation.isPending}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Return
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
