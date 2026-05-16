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
import { Award, Plus, Pencil } from "lucide-react";

export default function BadgesPage() {
  return <PluginGate slug="gamification"><BadgesContent /></PluginGate>;
}

function BadgesContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", criteria: "", points_value: "10", icon: "" });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["gamification-badges"],
    queryFn: async () => (await api.get("/gamification/badges")).data?.data || [],
  });

  const badges: any[] = data || [];

  const openAdd = () => { setForm({ name: "", description: "", criteria: "", points_value: "10", icon: "" }); setEditItem(null); setShowDialog(true); };
  const openEdit = (b: any) => { setForm({ name: b.name || "", description: b.description || "", criteria: b.criteria || "", points_value: String(b.points_value || 10), icon: b.icon || "" }); setEditItem(b); setShowDialog(true); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, points_value: parseInt(form.points_value) || 10 };
      if (editItem) return (await api.put(`/gamification/badges/${editItem.id}`, payload)).data;
      return (await api.post("/gamification/badges", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-badges"] });
      setShowDialog(false);
      toast.success(editItem ? "Badge updated" : "Badge created");
    },
    onError: () => toast.error("Failed to save badge"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="h-6 w-6" /> Badges</h1>
          <p className="text-muted-foreground">Define achievement badges awarded to students</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> New Badge</Button>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Badge</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Criteria</TableHead>
              <TableHead>Points</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {badges.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No badges created yet</TableCell></TableRow>
            ) : badges.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{b.icon || "🏅"}</span>
                    {b.name}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{b.description || "—"}</TableCell>
                <TableCell className="text-sm">{b.criteria || "—"}</TableCell>
                <TableCell><Badge variant="outline">{b.points_value} pts</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Edit Badge" : "New Badge"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2"><Label>Badge Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Star Performer" /></div>
              <div className="space-y-2"><Label>Icon (emoji)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🌟" /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Criteria</Label><Input value={form.criteria} onChange={(e) => setForm({ ...form, criteria: e.target.value })} placeholder="e.g. Score 90%+ in 3 consecutive exams" /></div>
            <div className="space-y-2"><Label>Points Value</Label><Input type="number" value={form.points_value} onChange={(e) => setForm({ ...form, points_value: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
              {save.isPending ? <Spinner className="mr-2" /> : null} {editItem ? "Update" : "Create Badge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
