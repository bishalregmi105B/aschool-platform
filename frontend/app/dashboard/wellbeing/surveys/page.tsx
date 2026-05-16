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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { ClipboardList, Plus } from "lucide-react";

export default function SurveysPage() {
  return <PluginGate slug="wellbeing"><SurveysContent /></PluginGate>;
}

function SurveysContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", target_group: "all", is_anonymous: true });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["wellbeing-surveys"],
    queryFn: async () => (await api.get("/wellbeing/surveys")).data?.data || [],
  });

  const surveys: any[] = Array.isArray(data) ? data : [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/wellbeing/surveys", form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellbeing-surveys"] });
      setShowDialog(false);
      toast.success("Survey created");
    },
    onError: () => toast.error("Failed to create survey"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6" /> Wellbeing Surveys</h1>
          <p className="text-muted-foreground">Create and manage student wellbeing surveys</p>
        </div>
        <Button onClick={() => { setForm({ title: "", description: "", target_group: "all", is_anonymous: true }); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Survey
        </Button>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Survey</TableHead>
              <TableHead>Target Group</TableHead>
              <TableHead>Anonymous</TableHead>
              <TableHead>Responses</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surveys.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No surveys created yet</TableCell></TableRow>
            ) : surveys.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>
                  <p className="font-medium">{s.title}</p>
                  {s.description && <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{s.description}</p>}
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{s.target_group || "all"}</Badge></TableCell>
                <TableCell><Badge variant={s.is_anonymous ? "secondary" : "outline"}>{s.is_anonymous ? "Anonymous" : "Named"}</Badge></TableCell>
                <TableCell>{s.response_count || 0}</TableCell>
                <TableCell className="text-sm">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Wellbeing Survey</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mid-term Wellbeing Check" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Group</Label>
                <select className="w-full border rounded-md p-2" value={form.target_group} onChange={(e) => setForm({ ...form, target_group: e.target.value })}>
                  <option value="all">All Students</option>
                  <option value="grade_1_5">Grade 1–5</option>
                  <option value="grade_6_10">Grade 6–10</option>
                  <option value="plus_two">+2 Level</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Anonymity</Label>
                <div className="flex items-center gap-2 h-10">
                  <input type="checkbox" id="anon" checked={form.is_anonymous} onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })} className="w-4 h-4" />
                  <label htmlFor="anon" className="text-sm">Anonymous responses</label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>
              {create.isPending ? <Spinner className="mr-2" /> : null} Create Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
