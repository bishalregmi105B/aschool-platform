"use client";
/** Attendance Outreach — POST /ai/generate/attendance_outreach (wave-2). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Megaphone, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

interface Message { student: string; message: string; escalation?: string }
interface Result { messages: Message[] }

export default function AttendanceOutreachPage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [absences, setAbsences] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/attendance_outreach", {
        attendance_summary: absences,
      })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Drafts ready — a human sends them"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Megaphone className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Attendance Outreach"
        subtitle="Kind, escalating guardian follow-ups (drafts only — you send)"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="Absence summary">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>One line per student (name + pattern)</Label>
                <Textarea rows={8} value={absences} onChange={(e) => setAbsences(e.target.value)}
                  placeholder={"Anish Karki — 3 days this week\nBina Rai — late 5 times this month\nChandra Tamang — absent 12 days since Baisakh"} />
              </div>
              <Button className="w-full" onClick={() => gen.mutate()} disabled={!absences.trim() || gen.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Drafting…" : "Draft messages"}
              </Button>
            </div>
          </FormSection>
          <DataPanel title="Drafts">
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't draft messages" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]"><Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Respectful notes with one clear ask each.</p></div>
            ) : (
              <div className="space-y-3">
                {result.messages?.map((m, i) => (
                  <div key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{m.student}</p>
                      {m.escalation && <StatusChip status={m.escalation} label={m.escalation} />}
                    </div>
                    <p className="text-sm text-[color:var(--w11-text-secondary)]">{m.message}</p>
                  </div>
                ))}
              </div>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
