"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Stethoscope, Plus, Search } from "lucide-react";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { displayBS } from "@/lib/nepali_date";

export default function HealthRecordsPage() {
  return <PluginGate slug="health_records"><RecordsContent /></PluginGate>;
}

function RecordsContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ student_id: "", visit_date: "", reason: "", diagnosis: "", treatment: "" });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["health-visits"],
    queryFn: async () => (await api.get("/health-records/visits")).data?.data || [],
    retry: 1,
  });

  const visits: any[] = (Array.isArray(data) ? data : []).filter((v: any) =>
    v.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.reason?.toLowerCase().includes(search.toLowerCase())
  );

  const create = useMutation({
    mutationFn: async () => (await api.post("/health-records/visits", form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-visits"] });
      setShowDialog(false);
      toast.success("Visit recorded");
    },
    onError: () => toast.error("Failed to save visit"),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load medical visits. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Stethoscope className="h-6 w-6" /> Medical Visits</h1>
          <p className="text-muted-foreground">Student health visit records</p>
        </div>
        <Button onClick={() => { setForm({ student_id: "", visit_date: "", reason: "", diagnosis: "", treatment: "" }); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Record Visit
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search by student or reason..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Visit Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Diagnosis</TableHead>
              <TableHead>Treatment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No visit records found</TableCell></TableRow>
            ) : visits.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.student_name || v.student_id}</TableCell>
                <TableCell className="text-sm">{v.visit_date ? displayBS(v.visit_date) : "—"}</TableCell>
                <TableCell className="text-sm">{v.reason || "—"}</TableCell>
                <TableCell className="text-sm">{v.diagnosis || "—"}</TableCell>
                <TableCell className="text-sm">{v.treatment || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Medical Visit</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Student ID</Label><Input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} /></div>
              <div className="space-y-2"><Label>Visit Date</Label><BSDateInput value={form.visit_date} onChange={(v) => setForm({ ...form, visit_date: v })} /></div>
            </div>
            <div className="space-y-2"><Label>Reason for Visit</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <div className="space-y-2"><Label>Diagnosis</Label><Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Treatment Given</Label><Textarea value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.student_id || !form.visit_date || create.isPending}>
              {create.isPending ? <Spinner className="mr-2" /> : null} Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
