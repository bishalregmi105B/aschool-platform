"use client";

/**
 * Meeting Minutes — dedicated tool page (wave-2, admin).
 * API: POST /ai/generate/meeting_minutes (generic workbench dispatcher).
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, ClipboardList, Copy, ListChecks, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface MinutesResult {
  title: string;
  date_note?: string;
  discussion: string[];
  decisions?: string[];
  action_items?: Array<{ task: string; owner?: string; due?: string }>;
}

export default function MeetingMinutesPage() {
  return (
    <PluginGate slug="ai_suite">
      <MinutesContent />
    </PluginGate>
  );
}

function MinutesContent() {
  const [meetingTitle, setMeetingTitle] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<MinutesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai/generate/meeting_minutes", {
        meeting_title: meetingTitle || undefined,
        date: date || undefined,
        notes,
      });
      return res.data?.data as MinutesResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      toast.success("Minutes structured");
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
        icon={<ClipboardList className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Meeting Minutes"
        subtitle="Raw notes → decisions, discussion and action items"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="Raw notes">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Meeting title (optional)</Label>
                  <Input
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="e.g. Monthly staff meeting"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date (optional)</Label>
                  <BSDateInput
                    value={date}
                    onChange={(v) => setDate(v)}
                    emit="bs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Paste your notes as-is (shorthand is fine)</Label>
                <Textarea
                  rows={12}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={"- bus route: discussed delay\n- R. Sharma: need new whiteboards B-wing\n- agreed fees reminder 15th monthly\n- sports day date TBD"}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => generate.mutate()}
                disabled={!notes.trim() || generate.isPending}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generate.isPending ? "Structuring…" : "Structure minutes"}
              </Button>
            </div>
          </FormSection>

          <DataPanel
            title={result?.title || "Minutes"}
            actions={result ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const text = [
                    result.title,
                    result.date_note ?? "",
                    "",
                    "DISCUSSION",
                    ...(result.discussion || []).map((d) => `- ${d}`),
                    "",
                    "DECISIONS",
                    ...(result.decisions || []).map((d) => `- ${d}`),
                    "",
                    "ACTION ITEMS",
                    ...(result.action_items || []).map(
                      (a) =>
                        `- ${a.task}${a.owner ? ` (${a.owner})` : ""}${a.due ? ` — due ${a.due}` : ""}`,
                    ),
                  ].join("\n");
                  navigator.clipboard.writeText(text);
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
                title="Couldn't structure the minutes"
                body={error}
                action={{ label: "Try again", onClick: () => generate.mutate() }}
              />
            ) : !result ? (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Paste raw notes — decisions are only extracted when the notes said &quot;agreed&quot;.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {result.date_note && (
                  <p className="text-xs text-[color:var(--w11-text-secondary)]">{result.date_note}</p>
                )}
                <Section title="DISCUSSED" items={result.discussion} />
                {(result.decisions?.length ?? 0) > 0 && (
                  <Section title="DECIDED" items={result.decisions!} tone="success" />
                )}
                {(result.action_items?.length ?? 0) > 0 && (
                  <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                    <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-[color:var(--w11-text-secondary)]">
                      <ListChecks className="h-3.5 w-3.5" /> ACTION ITEMS
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {result.action_items!.map((a, i) => (
                        <li key={i}>
                          {a.task}
                          {a.owner && (
                            <span className="ml-1 text-[color:var(--w11-text-secondary)]">— {a.owner}</span>
                          )}
                          {a.due && (
                            <span className="ml-1 text-[color:var(--w11-text-secondary)]">· due {a.due}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone?: "success";
}) {
  if (items.length === 0) return null;
  if (tone === "success") {
    return (
      <div className="win11-infobar success p-3">
        <p className="mb-1.5 text-xs font-semibold">{title}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
      <p className="mb-1.5 text-xs font-semibold text-[color:var(--w11-text-secondary)]">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
