"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Sparkles, Copy, FileText, PenLine } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { AiResultView } from "@/components/ai/ai-result-view";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

export default function LetterWriterPage() {
  return (
    <PluginGate slug="ai_suite"><LetterContent /></PluginGate>
  );
}

function LetterContent() {
  const [form, setForm] = useState({ type: "notice", recipient: "", subject: "", context: "", tone: "formal" });
  const [result, setResult] = useState("");

  const types = [
    { value: "notice", label: "Notice" },
    { value: "circular", label: "Circular" },
    { value: "leave_approval", label: "Leave Approval" },
    { value: "fee_reminder", label: "Fee Reminder" },
    { value: "parent_letter", label: "Parent Letter" },
    { value: "transfer_certificate", label: "Transfer Certificate" },
    { value: "recommendation", label: "Recommendation" },
    { value: "warning", label: "Warning Letter" },
    { value: "appreciation", label: "Appreciation Letter" },
    { value: "event_invitation", label: "Event Invitation" },
  ];

  const gen = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai-tools/letter-writer", form);
      return res.data;
    },
    onSuccess: (d) => { setResult(d?.data?.content || d?.data?.letter || JSON.stringify(d?.data, null, 2)); toast.success("Letter generated!"); },
    onError: () => toast.error("Generation failed"),
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<PenLine className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="AI Letter Writer"
        subtitle="Generate school letters, notices, and communications"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="Letter Details">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Letter Type</Label>
                  <AdvancedSelect
                    value={form.type}
                    onChange={(v) => setForm({ ...form, type: v })}
                    options={(types || []).map((t: any) => ({ value: t.value, label: t.label }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <AdvancedSelect
            value={form.tone}
            onChange={(v) => setForm({ ...form, tone: v })}
            options={[{ value: 'formal', label: 'Formal' }, { value: 'semi-formal', label: 'Semi-formal' }, { value: 'friendly', label: 'Friendly' }, { value: 'strict', label: 'Strict' }]}
          />
                </div>
              </div>
              <div className="space-y-2"><Label>Recipient</Label><Input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="e.g. All Parents, Mr. Sharma, Class 10 Students" /></div>
              <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Annual Day Celebration" /></div>
              <div className="space-y-2"><Label>Context / Instructions</Label><Textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="Details about what the letter should convey..." rows={4} /></div>
              <Button className="w-full" onClick={() => gen.mutate()} disabled={!form.subject || gen.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Generating..." : "Generate Letter"}
              </Button>
            </div>
          </FormSection>
          <DataPanel
            title="Generated Letter"
            actions={result ? (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result); toast.success("Copied!"); }}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
                <Button variant="ghost" size="sm" onClick={() => window.print()}><FileText className="h-4 w-4 mr-1" /> Print</Button>
              </div>
            ) : undefined}
          >
            {result ? (
              <div className="border border-[color:var(--w11-border-subtle)] rounded-lg p-8 min-h-[500px]" style={{ background: "var(--w11-card-bg)" }}>
                <div className="rounded-lg p-4 font-serif" style={{ background: "var(--w11-control-bg)" }}><AiResultView result={result} /></div>
              </div>
            ) : (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Select type and fill details to generate</p>
              </div>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
