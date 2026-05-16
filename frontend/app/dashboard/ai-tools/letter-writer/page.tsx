"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Sparkles, Copy, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function LetterWriterPage() {
  return (
    <PluginGate slug="ai_tools"><LetterContent /></PluginGate>
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">AI Letter Writer</h1><p className="text-muted-foreground">Generate school letters, notices, and communications</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Letter Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Letter Type</Label>
                <select className="w-full border rounded-md p-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {types.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <select className="w-full border rounded-md p-2" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
                  <option value="formal">Formal</option>
                  <option value="semi-formal">Semi-formal</option>
                  <option value="friendly">Friendly</option>
                  <option value="strict">Strict</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Recipient</Label><Input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="e.g. All Parents, Mr. Sharma, Class 10 Students" /></div>
            <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Annual Day Celebration" /></div>
            <div className="space-y-2"><Label>Context / Instructions</Label><Textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="Details about what the letter should convey..." rows={4} /></div>
            <Button className="w-full" onClick={() => gen.mutate()} disabled={!form.subject || gen.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Generating..." : "Generate Letter"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Letter</CardTitle>
              {result && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result); toast.success("Copied!"); }}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
                  <Button variant="ghost" size="sm" onClick={() => window.print()}><FileText className="h-4 w-4 mr-1" /> Print</Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="bg-white border rounded-lg p-8 shadow-sm min-h-[500px]">
                <pre className="whitespace-pre-wrap text-sm font-serif">{result}</pre>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Select type and fill details to generate</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
