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

export default function CheckoutPage() {
  return <PluginGate slug="library"><CheckoutContent /></PluginGate>;
}

function CheckoutContent() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"checkout" | "return">("checkout");
  const [bookId, setBookId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState<any>(null);

  const checkout = useMutation({
    mutationFn: async () => (await api.post("/library/issues", { book_id: parseInt(bookId), student_id: parseInt(studentId) })).data,
    onSuccess: (data) => { setResult(data.data || data); queryClient.invalidateQueries({ queryKey: ["library"] }); toast.success("Book issued successfully"); },
    onError: () => toast.error("Checkout failed"),
  });

  const returnBook = useMutation({
    mutationFn: async () => (await api.post("/library/issues/return", { book_id: parseInt(bookId), student_id: parseInt(studentId) })).data,
    onSuccess: (data) => { setResult(data.data || data); queryClient.invalidateQueries({ queryKey: ["library"] }); toast.success("Book returned successfully"); },
    onError: () => toast.error("Return failed"),
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
              <Label>Book ID / Barcode</Label>
              <div className="flex gap-2">
                <Input value={bookId} onChange={(e) => setBookId(e.target.value)} placeholder="Scan or enter book ID" />
                <Button variant="outline" size="icon"><ScanLine className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Student ID</Label>
              <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student enrollment no." />
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
              {result.due_date && <div><span className="text-muted-foreground">Due Date:</span> {new Date(result.due_date).toLocaleDateString()}</div>}
              {result.fine && <div><span className="text-muted-foreground">Fine:</span> Rs. {result.fine}</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
