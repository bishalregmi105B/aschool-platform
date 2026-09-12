"use client";

/**
 * Email Responder — dedicated tool page (wave-2, communication).
 * API: POST /ai/generate/email_responder (generic workbench dispatcher).
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Copy, Mail, Send, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface EmailResult {
  reply: string;
  subject_line?: string;
  key_points?: string[];
  tone_note?: string;
}

export default function EmailResponderPage() {
  return (
    <PluginGate slug="ai_suite">
      <EmailContent />
    </PluginGate>
  );
}

function EmailContent() {
  const [incoming, setIncoming] = useState("");
  const [points, setPoints] = useState("");
  const [tone, setTone] = useState("warm");
  const [senderRole, setSenderRole] = useState("");
  const [result, setResult] = useState<EmailResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai/generate/email_responder", {
        incoming: incoming || undefined,
        points: points
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean),
        tone,
        sender_role: senderRole || undefined,
      });
      return res.data?.data as EmailResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      toast.success("Draft ready — review key points before sending");
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Generation failed — try again",
      );
    },
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Mail className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Email Responder"
        subtitle="Professional replies from your bullet points — never invented facts"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="What you're replying to">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>The incoming message (paste or summarize)</Label>
                <Textarea
                  rows={5}
                  value={incoming}
                  onChange={(e) => setIncoming(e.target.value)}
                  placeholder="e.g. Parent asks why the bus was late twice this week…"
                />
              </div>
              <div className="space-y-2">
                <Label>Your points (one per line — the only facts it may use)</Label>
                <Textarea
                  rows={5}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder={"Bus 4 had a mechanical check on Tuesday\nRoute adjusted from Monday; pickup moves 10 min earlier"}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warm">Warm</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="firm">Firm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Signed as (optional)</Label>
                  <Input
                    value={senderRole}
                    onChange={(e) => setSenderRole(e.target.value)}
                    placeholder="Class Teacher — Grade 8"
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => generate.mutate()}
                disabled={(!incoming.trim() && !points.trim()) || generate.isPending}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generate.isPending ? "Drafting…" : "Draft reply"}
              </Button>
            </div>
          </FormSection>

          <DataPanel
            title="Draft"
            actions={result ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(result.reply);
                  toast.success("Copied!");
                }}
              >
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
            ) : undefined}
          >
            {generate.isPending ? (
              <PageLoader />
            ) : error ? (
              <EmptyState
                title="Couldn't draft the reply"
                body={error}
                action={{ label: "Try again", onClick: () => generate.mutate() }}
              />
            ) : !result ? (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Paste the message and your points — get a sendable draft.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {result.subject_line && (
                  <p className="text-sm">
                    <span className="font-semibold">Subject: </span>
                    {result.subject_line}
                  </p>
                )}
                <div className="rounded-lg p-4 text-sm whitespace-pre-wrap" style={{ background: "var(--w11-control-bg)" }}>
                  {result.reply}
                </div>
                {result.key_points && result.key_points.length > 0 && (
                  <div className="win11-infobar success p-3">
                    <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5" /> COMMITMENTS IN THIS
                      DRAFT — verify these are yours
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-xs">
                      {result.key_points.map((k, i) => (
                        <li key={i}>{k}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.tone_note && (
                  <p className="text-xs text-[color:var(--w11-text-secondary)]">{result.tone_note}</p>
                )}
                <p className="flex items-center gap-1 text-[11px] text-[color:var(--w11-text-secondary)]">
                  <Send className="h-3 w-3" /> Nothing is sent from here — copy
                  it into your mail client after review.
                </p>
              </div>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
