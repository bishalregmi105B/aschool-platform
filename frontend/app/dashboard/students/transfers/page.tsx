"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { ArrowLeftRight, Plus, Search } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
  student_id?: string;
  class_name?: string;
  status: string;
}

interface TransferRow {
  id: string;
  student_name?: string;
  student_code?: string;
  transfer_type: string;
  reason?: string;
  destination_school?: string;
  status: string;
  created_at?: string;
}

const TYPE_LABEL: Record<string, string> = {
  tc: "Transfer Certificate",
  withdrawal: "Withdrawal",
  migration: "Migration",
};

export default function TransfersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    student_id: "",
    transfer_type: "tc",
    reason: "",
    destination_school: "",
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["transfers", search],
    queryFn: async () => { const r = await api.get("/students/transfers", { params: { search: search || undefined } }); return r.data; },
  });

  const { data: studentOptions } = useQuery({
    queryKey: ["students-for-transfer"],
    queryFn: async () => {
      const r = await api.get("/students", { params: { per_page: 500 } });
      return (r.data?.data || []) as StudentOption[];
    },
    enabled: showDialog,
  });

  const transfers: TransferRow[] = data?.data || [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/students/transfers", form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setShowDialog(false);
      toast.success("Transfer initiated — student marked transferred out");
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || "Failed to create transfer");
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-3">
        <p className="text-sm text-destructive">Failed to load transfers. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Student Transfers</h1><p className="text-muted-foreground">Transfer certificates and student withdrawals</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> New Transfer</Button>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search transfers by student name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card>
        <CardHeader className="pb-0"><CardTitle className="text-base">Transfer Records</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Type</TableHead><TableHead>Reason</TableHead><TableHead>Destination</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transfers found</TableCell></TableRow>
              ) : transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.student_name || "—"}{t.student_code && <span className="ml-2 text-xs text-muted-foreground">{t.student_code}</span>}</TableCell>
                  <TableCell><Badge variant="outline">{TYPE_LABEL[t.transfer_type] || t.transfer_type}</Badge></TableCell>
                  <TableCell>{t.reason || "—"}</TableCell>
                  <TableCell>{t.destination_school || "—"}</TableCell>
                  <TableCell>{t.created_at ? displayBS(t.created_at) : "—"}</TableCell>
                  <TableCell><Badge variant={t.status === "completed" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Initiate Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student *</Label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              >
                <option value="">Select a student…</option>
                {(studentOptions || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}{s.class_name ? ` — ${s.class_name}` : ""}{s.student_id ? ` (${s.student_id})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Only active students at your school are listed.</p>
            </div>
            <div className="space-y-2">
              <Label>Transfer Type</Label>
              <select className="w-full border rounded-md p-2" value={form.transfer_type} onChange={(e) => setForm({ ...form, transfer_type: e.target.value })}>
                <option value="tc">Transfer Certificate</option><option value="withdrawal">Withdrawal</option><option value="migration">Migration</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Destination School</Label><Input value={form.destination_school} onChange={(e) => setForm({ ...form, destination_school: e.target.value })} /></div>
            <div className="space-y-2"><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.student_id || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />} Create Transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
