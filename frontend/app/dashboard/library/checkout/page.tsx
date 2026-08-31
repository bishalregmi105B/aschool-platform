"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { BookMarked, RotateCcw, Search } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function CheckoutPage() {
  return <PluginGate slug="library"><CheckoutContent /></PluginGate>;
}

function CheckoutContent() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"checkout" | "return">("checkout");
  const [bookId, setBookId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [bookQuery, setBookQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [result, setResult] = useState<any>(null);

  const fail = (e: any, fallback: string) =>
    toast.error(e?.response?.data?.error || e?.message || fallback);

  // Searchable book picker (title / author / ISBN — backend matches all three)
  const { data: books = [] } = useQuery({
    queryKey: ["checkout-books", bookQuery],
    queryFn: async () => {
      const r = await api.get("/library/books", { params: { search: bookQuery, per_page: 20 } });
      return r.data?.data || [];
    },
  });

  // Searchable student picker (same endpoint the fee desk uses)
  const { data: students = [] } = useQuery({
    queryKey: ["checkout-students", studentQuery],
    enabled: studentQuery.trim().length >= 2,
    queryFn: async () => {
      const r = await api.get("/students", { params: { search: studentQuery.trim(), per_page: 20 } });
      return r.data?.data || [];
    },
  });

  // Per-school fine/circulation policy for the hint line — edited by school
  // admins at /dashboard/plugins/library_management/settings
  const { data: settings } = useQuery({
    queryKey: ["library-settings"],
    queryFn: async () => (await api.get("/library/settings")).data?.data,
    staleTime: 5 * 60 * 1000,
  });

  const selectedBook = books.find((b: any) => b.id === bookId);
  const selectedStudent = students.find((s: any) => s.id === studentId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["library-books"] });
    queryClient.invalidateQueries({ queryKey: ["library-issues"] });
    queryClient.invalidateQueries({ queryKey: ["library-overdue"] });
    queryClient.invalidateQueries({ queryKey: ["checkout-books"] });
  };

  const checkout = useMutation({
    mutationFn: async () => (await api.post("/library/issues", { book_id: bookId, student_id: studentId })).data,
    onSuccess: (data) => {
      setResult(data.data || data);
      invalidate();
      toast.success("Book issued successfully");
    },
    onError: (e) => fail(e, "Checkout failed — is the book still available?"),
  });

  const returnBook = useMutation({
    mutationFn: async () => {
      const res = await api.get("/library/issues", {
        params: { status: "issued", book_id: bookId, student_id: studentId },
      });
      const issues = res.data?.data ?? [];
      const issue = Array.isArray(issues) ? issues[0] : undefined;
      if (!issue?.id) throw new Error("No active issue found for that book + student pair");
      return (await api.post(`/library/issues/${issue.id}/return`, {})).data;
    },
    onSuccess: (data) => {
      setResult(data.data || data);
      invalidate();
      toast.success(
        data?.overdue_days > 0
          ? `Returned — ${data.overdue_days} day(s) late, fine Rs. ${data.fine}`
          : "Book returned successfully",
      );
    },
    onError: (e) => fail(e, "Return failed — no active issue for that book + student pair"),
  });

  const handleSubmit = () => {
    if (!bookId || !studentId) { toast.error("Pick both a book and a student"); return; }
    if (mode === "checkout") checkout.mutate(); else returnBook.mutate();
  };

  const isPending = checkout.isPending || returnBook.isPending;

  // "2" → "2", "2.5" → "2.50" — avoids floating-point noise in the hint
  const fmtNum = (v: any) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  };
  const perDay = fmtNum(settings?.fines?.per_day);
  const maxFine = fmtNum(settings?.fines?.max);
  const loanDays = Number(settings?.circulation?.loan_days);

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
          {/* Book picker */}
          <div className="space-y-1.5">
            <Label>Book</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by title, author or ISBN…"
                value={selectedBook ? `${selectedBook.title} (${selectedBook.available_copies}/${selectedBook.total_copies} available)` : bookQuery}
                onFocus={() => { setBookId(""); setBookQuery(""); }}
                onChange={(e) => { setBookId(""); setBookQuery(e.target.value); }}
                className="pl-7"
              />
            </div>
            {!selectedBook && bookQuery.trim() && (
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {books.length === 0 && <p className="text-xs text-muted-foreground p-3">No books match.</p>}
                {books.map((b: any) => (
                  <button key={b.id}
                    onClick={() => { setBookId(b.id); }}
                    disabled={(b.available_copies ?? 0) <= 0 && mode === "checkout"}
                    className="w-full flex items-center justify-between p-2 text-left text-sm hover:bg-muted disabled:opacity-40">
                    <span className="min-w-0 truncate">{b.title} <span className="text-muted-foreground">— {b.author}</span></span>
                    <Badge variant={(b.available_copies ?? 0) > 0 ? "secondary" : "destructive"} className="ml-2 shrink-0">
                      {b.available_copies}/{b.total_copies}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Student picker */}
          <div className="space-y-1.5">
            <Label>Student</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search student by name or ID (min 2 characters)…"
                value={selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : studentQuery}
                onFocus={() => { setStudentId(""); }}
                onChange={(e) => { setStudentId(""); setStudentQuery(e.target.value); }}
                className="pl-7"
              />
            </div>
            {!selectedStudent && studentQuery.trim().length >= 2 && (
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {students.length === 0 && <p className="text-xs text-muted-foreground p-3">No students match.</p>}
                {students.map((s: any) => (
                  <button key={s.id}
                    onClick={() => setStudentId(s.id)}
                    className="w-full flex items-center justify-between p-2 text-left text-sm hover:bg-muted">
                    <span>{s.first_name} {s.last_name}</span>
                    <span className="text-xs text-muted-foreground">{s.student_id || s.admission_number || ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={isPending || !bookId || !studentId} className="w-full">
            {isPending ? <Spinner className="mr-2" /> : null} {mode === "checkout" ? "Issue Book" : "Return Book"}
          </Button>

          {(perDay !== null || maxFine !== null || Number.isFinite(loanDays)) && (
            <p className="text-xs text-muted-foreground">
              {Number.isFinite(loanDays) && <>Loan period: {loanDays} day(s). </>}
              {perDay !== null && maxFine !== null && <>Fine: Rs {perDay}/day, max Rs {maxFine}. </>}
              {perDay !== null && maxFine === null && <>Fine: Rs {perDay}/day. </>}
              Configurable in plugin settings.
            </p>
          )}
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
              {!!result.overdue_days && <div className="text-red-700"><span className="text-muted-foreground">Overdue:</span> {result.overdue_days} day(s)</div>}
              {!!result.fine && <div className="text-red-700"><span className="text-muted-foreground">Fine:</span> Rs. {result.fine}</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
