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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, Copy, Trash2 } from "lucide-react";

export default function TemplatesPage() {
  return <PluginGate slug="communications"><TemplatesContent /></PluginGate>;
}

function TemplatesContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", category: "general", channel: "sms", content: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["comm-templates"],
    queryFn: async () => { const r = await api.get("/communications/templates"); return r.data; },
  });

  const templates = data?.data || [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/communications/templates", form)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["comm-templates"] }); setShowDialog(false); toast.success("Template created!"); },
    onError: () => toast.error("Failed to create"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/communications/templates/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["comm-templates"] }); toast.success("Deleted"); },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Message Templates</h1><p className="text-muted-foreground">Reusable templates for common communications</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> New Template</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <Card className="col-span-full"><CardContent className="py-16 text-center text-muted-foreground">No templates yet. Create one to get started.</CardContent></Card>
        ) : templates.map((t: any) => (
          <Card key={t.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <div className="flex gap-1">
                  <Badge variant="outline">{t.channel}</Badge>
                  <Badge variant="secondary">{t.category}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{t.content}</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(t.content); toast.success("Copied!"); }}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Template Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Fee Reminder" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <select className="w-full border rounded-md p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="general">General</option><option value="fee">Fee</option><option value="attendance">Attendance</option><option value="exam">Exam</option><option value="event">Event</option><option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <select className="w-full border rounded-md p-2" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                  <option value="sms">SMS</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="push">Push</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} placeholder="Use {{student_name}}, {{parent_name}}, {{school_name}} etc." /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || !form.content || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
