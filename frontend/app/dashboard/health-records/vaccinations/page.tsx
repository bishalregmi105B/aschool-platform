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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Syringe, Plus } from "lucide-react";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { displayBS } from "@/lib/nepali_date";

export default function VaccinationsPage() {
  return <PluginGate slug="health_records"><VaccinationsContent /></PluginGate>;
}

function VaccinationsContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ student_id: "", vaccine_name: "", dose_number: "1", date_administered: "", administered_by: "", next_due_date: "" });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["health-immunizations"],
    queryFn: async () => (await api.get("/health-records/immunizations")).data?.data || [],
    retry: 1,
  });

  const records: any[] = Array.isArray(data) ? data : [];

  const create = useMutation({
    mutationFn: async () => {
      const payload = { ...form, dose_number: parseInt(form.dose_number) || 1 };
      return (await api.post("/health-records/immunizations", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-immunizations"] });
      setShowDialog(false);
      toast.success("Vaccination recorded");
    },
    onError: () => toast.error("Failed to record vaccination"),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load vaccination records. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Syringe className="h-6 w-6" /> Vaccinations</h1>
          <p className="text-muted-foreground">Student immunization and vaccination records</p>
        </div>
        <Button onClick={() => { setForm({ student_id: "", vaccine_name: "", dose_number: "1", date_administered: "", administered_by: "", next_due_date: "" }); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Record Vaccination
        </Button>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Vaccine</TableHead>
              <TableHead>Dose</TableHead>
              <TableHead>Date Given</TableHead>
              <TableHead>Given By</TableHead>
              <TableHead>Next Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No vaccination records found</TableCell></TableRow>
            ) : records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.student_name || r.student_id}</TableCell>
                <TableCell>{r.vaccine_name}</TableCell>
                <TableCell><Badge variant="outline">Dose {r.dose_number}</Badge></TableCell>
                <TableCell className="text-sm">{r.date_administered ? displayBS(r.date_administered) : "—"}</TableCell>
                <TableCell className="text-sm">{r.administered_by || "—"}</TableCell>
                <TableCell className="text-sm">{r.next_due_date ? displayBS(r.next_due_date) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Vaccination</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Student ID</Label><Input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} /></div>
              <div className="space-y-2"><Label>Vaccine Name</Label><Input value={form.vaccine_name} onChange={(e) => setForm({ ...form, vaccine_name: e.target.value })} placeholder="BCG, DTP, MMR..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Dose #</Label><Input type="number" value={form.dose_number} onChange={(e) => setForm({ ...form, dose_number: e.target.value })} /></div>
              <div className="space-y-2"><Label>Administered By</Label><Input value={form.administered_by} onChange={(e) => setForm({ ...form, administered_by: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Date Given</Label><BSDateInput value={form.date_administered} onChange={(v) => setForm({ ...form, date_administered: v })} /></div>
              <div className="space-y-2"><Label>Next Due Date</Label><BSDateInput value={form.next_due_date} onChange={(v) => setForm({ ...form, next_due_date: v })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.student_id || !form.vaccine_name || create.isPending}>
              {create.isPending ? <Spinner className="mr-2" /> : null} Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
