"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FormSection,
} from "@/components/aos/kit/page-kit";
import { Send, MessageSquare, Mail, Phone, Radio } from "lucide-react";

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
    <AOSPage>
      <AOSPageHeader
        icon={<Radio className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Broadcast Message"
        subtitle="Send messages to groups of parents, students, or staff"
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <DataPanel title="Channel">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {channels.map((c: any) => (
                  <button
                    key={c.value}
                    onClick={() => setForm({ ...form, channel: c.value })}
                    className="p-4 rounded-lg border text-center transition-colors"
                    style={
                      form.channel === c.value
                        ? {
                            borderColor: "var(--w11-accent)",
                            background: "var(--w11-accent-light)",
                          }
                        : {
                            borderColor: "var(--w11-border-default)",
                          }
                    }
                  >
                    <c.icon className="h-6 w-6 mx-auto mb-2" style={{ color: form.channel === c.value ? "var(--w11-accent)" : "var(--w11-text-secondary)" }} />
                    <span className="text-sm font-medium" style={{ color: form.channel === c.value ? "var(--w11-accent)" : "var(--w11-text-primary)" }}>{c.label}</span>
                  </button>
                ))}
              </div>
            </DataPanel>

            <FormSection title="Message">
              <div className="space-y-4">
                {form.channel === "email" && <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Email subject" /></div>}
                <div className="space-y-2"><Label>Message</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Type your message..." rows={6} /></div>
                <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Variables: {"{{student_name}}, {{parent_name}}, {{school_name}}, {{class}}"}</p>
              </div>
            </FormSection>
          </div>

          <div className="space-y-4">
            <DataPanel title="Audience">
              <div className="space-y-2">
                {audiences.map((a: any) => (
                  <button
                    key={a.value}
                    onClick={() => setForm({ ...form, audience: a.value })}
                    className="w-full p-3 rounded-lg border text-left text-sm transition-colors"
                    style={
                      form.audience === a.value
                        ? {
                            borderColor: "var(--w11-accent)",
                            background: "var(--w11-accent-light)",
                            color: "var(--w11-accent)",
                          }
                        : {
                            borderColor: "var(--w11-border-default)",
                            color: "var(--w11-text-primary)",
                          }
                    }
                  >
                    {a.label}
                  </button>
                ))}
                {form.audience === "class_parents" && <div className="space-y-2 mt-2"><Label>Class ID</Label><Input value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} placeholder="Enter class ID" /></div>}
              </div>
            </DataPanel>

            <Button className="w-full" size="lg" onClick={() => send.mutate()} disabled={!form.message || send.isPending}>
              {send.isPending ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />} Send Broadcast
            </Button>
          </div>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
