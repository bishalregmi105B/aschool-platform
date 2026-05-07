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

export default function TransfersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ student_id: "", transfer_type: "tc", reason: "", destination_school: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["transfers", search],
    queryFn: async () => { const r = await api.get("/students/transfers", { params: { search: search || undefined } }); return r.data; },
  });

  const transfers = data?.data || [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/students/transfers", { ...form, student_id: parseInt(form.student_id) })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["transfers"] }); setShowDialog(false); toast.success("Transfer initiated!"); },
    onError: () => toast.error("Failed to create transfer"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Student Transfers</h1><p className="text-muted-foreground">Transfer certificates and student withdrawals</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> New Transfer</Button>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search transfers..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Type</TableHead><TableHead>Reason</TableHead><TableHead>Destination</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transfers found</TableCell></TableRow>
              ) : transfers.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.student_name}</TableCell>
                  <TableCell><Badge variant="outline">{t.transfer_type === "tc" ? "TC" : t.transfer_type}</Badge></TableCell>
                  <TableCell>{t.reason || "—"}</TableCell>
                  <TableCell>{t.destination_school || "—"}</TableCell>
                  <TableCell>{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</TableCell>
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
            <div className="space-y-2"><Label>Student ID</Label><Input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} placeholder="Enter student ID" /></div>
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
