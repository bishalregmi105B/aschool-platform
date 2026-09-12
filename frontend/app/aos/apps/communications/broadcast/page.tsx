"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Send, Users, MessageSquare, Mail, Phone } from "lucide-react";

export default function BroadcastPage() {
  return <PluginGate slug="communications"><BroadcastContent /></PluginGate>;
}

function BroadcastContent() {
  const [form, setForm] = useState({ channel: "sms", audience: "all_parents", class_id: "", subject: "", message: "" });

  const send = useMutation({
    mutationFn: async () =>
      (
        await api.post("/communications/broadcast", {
          ...form,
          class_id: form.class_id || undefined,
        })
      ).data,
    onSuccess: (d) => {
      // E122: surface the honest per-channel outcome — push delivers in-app
      // notifications, SMS queues logs, email/WhatsApp may honestly skip or
      // fail (no credentials) and the UI must not claim success then.
      const r = d?.data || {};
      if (r.status === "skipped" || r.status === "failed") {
        const reason =
          r.reason === "whatsapp_not_configured"
            ? "WhatsApp is not configured for this school"
            : r.reason === "email_not_configured_or_smtp_error"
              ? "Email could not be sent — SMTP is not configured or failed"
              : "Delivery was skipped";
        toast.error(`${reason}. Nothing was sent.`);
        return;
      }
      if (r.channel === "push") {
        toast.success(
          r.queued > 0
            ? `In-app notification delivered to ${r.queued} recipient${r.queued === 1 ? "" : "s"}`
            : "No matching recipients in this audience",
        );
      } else if (r.channel === "email") {
        toast.success(
          r.queued > 0
            ? `Email sent to ${r.queued} recipient${r.queued === 1 ? "" : "s"}${r.failed ? ` (${r.failed} failed)` : ""}`
            : "No matching recipients with an email address",
        );
      } else if (r.status === "partial") {
        toast.warning(
          `WhatsApp sent to ${r.queued} of ${r.recipients} recipients (${r.failed} skipped)`,
        );
      } else {
        toast.success(
          r.queued > 0
            ? `Broadcast queued for ${r.queued} recipient${r.queued === 1 ? "" : "s"}`
            : "No matching recipients in this audience",
        );
      }
      setForm({ ...form, subject: "", message: "" });
    },
    onError: () => toast.error("Failed to send broadcast"),
  });

  const channels = [
    { value: "sms", label: "SMS", icon: Phone },
    { value: "email", label: "Email", icon: Mail },
    { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
    { value: "push", label: "Push Notification", icon: Send },
  ];

  const audiences = [
    { value: "all_parents", label: "All Parents" },
    { value: "all_students", label: "All Students" },
    { value: "all_staff", label: "All Staff" },
    { value: "class_parents", label: "Specific Class Parents" },
    { value: "fee_defaulters", label: "Fee Defaulters" },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Broadcast Message</h1><p className="text-muted-foreground">Send messages to groups of parents, students, or staff</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Channel</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {channels.map((c: any) => (
                  <button key={c.value} onClick={() => setForm({ ...form, channel: c.value })} className={`p-4 rounded-lg border text-center transition-colors ${form.channel === c.value ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                    <c.icon className="h-6 w-6 mx-auto mb-2" /><span className="text-sm font-medium">{c.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Message</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {form.channel === "email" && <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Email subject" /></div>}
              <div className="space-y-2"><Label>Message</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Type your message..." rows={6} /></div>
              <p className="text-xs text-muted-foreground">Variables: {"{{student_name}}, {{parent_name}}, {{school_name}}, {{class}}"}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Audience</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {audiences.map((a: any) => (
                <button key={a.value} onClick={() => setForm({ ...form, audience: a.value })} className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${form.audience === a.value ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>{a.label}</button>
              ))}
              {form.audience === "class_parents" && <div className="space-y-2 mt-2"><Label>Class ID</Label><Input value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} placeholder="Enter class ID" /></div>}
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={() => send.mutate()} disabled={!form.message || send.isPending}>
            {send.isPending ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />} Send Broadcast
          </Button>
        </div>
      </div>
    </div>
  );
}
