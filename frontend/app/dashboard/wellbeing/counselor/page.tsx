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
import { Brain, Plus } from "lucide-react";

export default function CounselorPage() {
  return <PluginGate slug="wellbeing"><CounselorContent /></PluginGate>;
}

function CounselorContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ student_id: "", note: "", session_type: "individual", action_taken: "" });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["counselor-notes"],
    queryFn: async () => (await api.get("/wellbeing/counselor-notes")).data?.data || [],
  });

  const notes: any[] = Array.isArray(data) ? data : [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/wellbeing/counselor-notes", form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counselor-notes"] });
      setShowDialog(false);
      toast.success("Note saved");
    },
    onError: () => toast.error("Failed to save note"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6" /> Counselor Notes</h1>
          <p className="text-muted-foreground">Record counseling sessions and follow-ups</p>
        </div>
        <Button onClick={() => { setForm({ student_id: "", note: "", session_type: "individual", action_taken: "" }); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Note
        </Button>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Session Type</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Action Taken</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No counselor notes yet</TableCell></TableRow>
            ) : notes.map((n: any) => (
              <TableRow key={n.id}>
                <TableCell className="font-medium">{n.student?.name || n.student_id}</TableCell>
                <TableCell className="capitalize text-sm">{n.session_type || "individual"}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">{n.note || "—"}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">{n.action_taken || "—"}</TableCell>
                <TableCell className="text-sm">{n.created_at ? new Date(n.created_at).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Counselor Note</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Student ID</Label><Input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} placeholder="STU-2023-001" /></div>
              <div className="space-y-2">
                <Label>Session Type</Label>
                <select className="w-full border rounded-md p-2" value={form.session_type} onChange={(e) => setForm({ ...form, session_type: e.target.value })}>
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                  <option value="parent">Parent Meeting</option>
                  <option value="referral">External Referral</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Action Taken</Label><Textarea value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.student_id || !form.note || create.isPending}>
              {create.isPending ? <Spinner className="mr-2" /> : null} Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
