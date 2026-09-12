"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Plus, Copy, Trash2, FileText } from "lucide-react";

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

  if (isLoading) return <AOSModuleLoadingState label="Loading templates…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Message Templates"
        subtitle={`${templates.length} reusable ${templates.length === 1 ? "template" : "templates"} for common communications`}
        actions={
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> New Template</Button>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.length === 0 ? (
            <DataPanel className="col-span-full">
              <AOSEmptyState
                icon={<FileText className="h-10 w-10" />}
                title="No templates yet"
                description="Create one to get started."
              />
            </DataPanel>
          ) : templates.map((t: any) => (
            <div key={t.id} className="win11-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-semibold" style={{ color: "var(--w11-text-primary)" }}>{t.name}</span>
                <div className="flex gap-1">
                  <span className="win11-chip subtle">{t.channel}</span>
                  <span className="win11-chip accent">{t.category}</span>
                </div>
              </div>
              <p className="text-sm line-clamp-3 mb-4" style={{ color: "var(--w11-text-secondary)" }}>{t.content}</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(t.content); toast.success("Copied!"); }}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} /></Button>
              </div>
            </div>
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
                  <AdvancedSelect
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={[{ value: 'general', label: 'General' }, { value: 'fee', label: 'Fee' }, { value: 'attendance', label: 'Attendance' }, { value: 'exam', label: 'Exam' }, { value: 'event', label: 'Event' }, { value: 'emergency', label: 'Emergency' }]}
          />
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <AdvancedSelect
            value={form.channel}
            onChange={(v) => setForm({ ...form, channel: v })}
            options={[{ value: 'sms', label: 'SMS' }, { value: 'email', label: 'Email' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'push', label: 'Push' }]}
          />
                </div>
              </div>
              <div className="space-y-2"><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} placeholder="Use {{student_name}}, {{parent_name}}, {{school_name}} etc." /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || !form.content || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
