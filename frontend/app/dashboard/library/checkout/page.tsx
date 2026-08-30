"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { BookMarked, ScanLine, RotateCcw } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function CheckoutPage() {
  return <PluginGate slug="library"><CheckoutContent /></PluginGate>;
}

function CheckoutContent() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"checkout" | "return">("checkout");
  const [bookId, setBookId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState<any>(null);

  // Backend ids are UUIDs and /library/issues expects {book_id, student_id};
  // returns must resolve the active issue first (POST /library/issues/return
  // does not exist — the real route is /library/issues/<id>/return).
  const fail = (e: any, fallback: string) =>
    toast.error(e?.response?.data?.error || fallback);

  const checkout = useMutation({
    mutationFn: async () => (await api.post("/library/issues", { book_id: bookId.trim(), student_id: studentId.trim() })).data,
    onSuccess: (data) => {
      setResult(data.data || data);
      // ["library"] is not an element-wise prefix of ["library-books"]/["library-issues"]
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      queryClient.invalidateQueries({ queryKey: ["library-issues"] });
      queryClient.invalidateQueries({ queryKey: ["library-overdue"] });
      toast.success("Book issued successfully");
    },
    onError: (e) => fail(e, "Checkout failed — check the Book and Student IDs"),
  });

  const returnBook = useMutation({
    mutationFn: async () => {
      const res = await api.get("/library/issues", {
        params: { status: "issued", book_id: bookId.trim(), student_id: studentId.trim() },
      });
      const issues = res.data?.data ?? [];
      const issue = Array.isArray(issues) ? issues[0] : undefined;
      if (!issue?.id) throw new Error("No active issue found for that Book and Student ID pair");
      return (await api.post(`/library/issues/${issue.id}/return`, {})).data;
    },
    onSuccess: (data) => {
      setResult(data.data || data);
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      queryClient.invalidateQueries({ queryKey: ["library-issues"] });
      queryClient.invalidateQueries({ queryKey: ["library-overdue"] });
      toast.success("Book returned successfully");
    },
    onError: (e) => fail(e, "Return failed — no active issue for that Book and Student ID pair"),
  });

  const handleSubmit = () => {
    if (!bookId || !studentId) { toast.error("Both Book ID and Student ID required"); return; }
    if (mode === "checkout") checkout.mutate(); else returnBook.mutate();
  };

  const isPending = checkout.isPending || returnBook.isPending;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Book Checkout / Return</h1><p className="text-muted-foreground">Issue and return library books</p></div>

      <div className="flex gap-2">
        <Button variant={mode === "checkout" ? "default" : "outline"} onClick={() => { setMode("checkout"); setResult(null); }}><BookMarked className="h-4 w-4 mr-2" /> Issue Book</Button>
        <Button variant={mode === "return" ? "default" : "outline"} onClick={() => { setMode("return"); setResult(null); }}><RotateCcw className="h-4 w-4 mr-2" /> Return Book</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{mode === "checkout" ? "Issue Book to Student" : "Return Book"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Book ID (UUID)</Label>
              <div className="flex gap-2">
                <Input value={bookId} onChange={(e) => setBookId(e.target.value)} placeholder="Book UUID (from Catalog)" />
                <Button variant="outline" size="icon"><ScanLine className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Student ID (UUID)</Label>
              <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student UUID" />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={isPending} className="w-full">
            {isPending ? <Spinner className="mr-2" /> : null} {mode === "checkout" ? "Issue Book" : "Return Book"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-green-800 mb-2">✅ {mode === "checkout" ? "Book Issued" : "Book Returned"} Successfully</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {result.book_title && <div><span className="text-muted-foreground">Book:</span> {result.book_title}</div>}
              {result.student_name && <div><span className="text-muted-foreground">Student:</span> {result.student_name}</div>}
              {result.due_date && <div><span className="text-muted-foreground">Due Date:</span> {displayBS(result.due_date)}</div>}
              {result.fine && <div><span className="text-muted-foreground">Fine:</span> Rs. {result.fine}</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
