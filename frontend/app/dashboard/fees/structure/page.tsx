"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

interface FeeStructure {
  id: string;
  name: string;
  scope_label?: string;
  fee_type: string;
  amount: number;
  class_name?: string;
  academic_year?: string;
  frequency: string;
  due_day?: number;
  is_optional: boolean;
  applied_count?: number;
  applied_cycle?: string;
  effective_note?: string;
}

const DEFAULT_FORM = {
  name: "",
  fee_type: "tuition",
  amount: "",
  class_id: "",
  frequency: "monthly",
  due_day: "10",
  is_optional: false,
};

function formatLabel(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function FeeStructurePage() {
  return <PluginGate slug="fees"><FeeStructureContent /></PluginGate>;
}

function FeeStructureContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ["fee-structures"],
    queryFn: async () => { const r = await api.get("/fees/structures"); return r.data; },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => { const r = await api.get("/academics/classes"); return r.data?.data || []; },
  });

  const structures: FeeStructure[] = data?.data || [];

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        due_day: parseInt(form.due_day),
        class_id: form.class_id || undefined,
      };
      return (await api.post("/fees/structures", payload)).data;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      setShowDialog(false);
      setForm(DEFAULT_FORM);
      const createdCount = response?.data?.applied_summary?.created_collections || 0;
      toast.success(
        createdCount > 0
          ? `Fee structure created and applied to ${createdCount} students.`
          : "Fee structure created. No matching active students were billed yet.",
      );
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || "Failed to create fee structure"),
  });

  const apply = useMutation({
    mutationFn: async (id: string) => (await api.post(`/fees/structures/${id}/apply`)).data,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      const summary = response?.data?.applied_summary;
      const createdCount = summary?.created_collections || 0;
      const matchedStudents = summary?.matched_students || 0;
      toast.success(
        createdCount > 0
          ? `Applied to ${createdCount} students for the current cycle.`
          : matchedStudents > 0
            ? "This structure is already applied for the current cycle."
            : "No matching active students found for this structure.",
      );
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || "Failed to apply fee structure"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/fees/structures/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["fee-structures"] }); toast.success("Deleted"); },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Fee Structure</h1><p className="text-muted-foreground">Define reusable fee templates for each class and academic year</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Structure</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            New fee structures now create the current pending dues immediately for matching active students. Use Apply Now for older templates or to sync the current cycle again.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Class</TableHead><TableHead>Amount</TableHead><TableHead>Frequency</TableHead><TableHead>Effective</TableHead><TableHead>Optional</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {structures.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No fee structures defined</TableCell></TableRow>
              ) : structures.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{s.name}</p>
                      {s.scope_label ? (
                        <p className="text-xs text-muted-foreground">{s.scope_label}</p>
                      ) : null}
                      {s.effective_note ? (
                        <p className="text-xs text-muted-foreground mt-1">{s.effective_note}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{formatLabel(s.fee_type)}</Badge></TableCell>
                  <TableCell>{s.class_name || "All"}</TableCell>
                  <TableCell>Rs. {s.amount?.toLocaleString()}</TableCell>
                  <TableCell>
                    <div>
                      <p>{formatLabel(s.frequency)}</p>
                      <p className="text-xs text-muted-foreground">Due day: {s.due_day || "—"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={s.applied_count ? "success" : "secondary"}>
                        {s.applied_count ? "Active Now" : "Template Only"}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {s.applied_count ? `${s.applied_count} billed` : "Not billed yet"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{s.is_optional ? <Badge variant="secondary">Optional</Badge> : "Required"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => apply.mutate(s.id)} disabled={apply.isPending}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Apply Now
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Fee Structure</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Monthly Tuition" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <select className="w-full border rounded-md p-2" value={form.fee_type} onChange={(e) => setForm({ ...form, fee_type: e.target.value })}>
                  <option value="tuition">Tuition</option><option value="admission">Admission</option><option value="exam">Exam</option><option value="transport">Transport</option><option value="hostel">Hostel</option><option value="library">Library</option><option value="lab">Lab</option><option value="sports">Sports</option><option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Amount (Rs.)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <select className="w-full border rounded-md p-2" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                  <option value="">All Classes</option>
                  {(classes || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <select className="w-full border rounded-md p-2" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="semi-annual">Semi-Annual</option><option value="annual">Annual</option><option value="one-time">One-Time</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Due Day of Cycle</Label><Input type="number" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} min="1" max="28" /></div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_optional} onChange={(e) => setForm({ ...form, is_optional: e.target.checked })} /> Optional fee</label>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name.trim() || !form.amount || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Create Structure</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
