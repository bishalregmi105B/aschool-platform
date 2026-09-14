"use client";

/**
 * Meeting Minutes — POST /ai/generate/meeting_minutes.
 * Research: minutes tools (MagicSchool "Meeting Minutes", Diffit-style raw
 * paste) deliberately under-extract: "decisions" only appear when notes said
 * "agreed" — that honesty line lives in the empty state; the result separates
 * DISCUSSED / DECIDED / ACTION ITEMS with owners and due dates for follow-up.
 */

import { ClipboardList, ListChecks } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface MinutesResult {
  title: string;
  date_note?: string;
  discussion: string[];
  decisions?: string[];
  action_items?: Array<{ task: string; owner?: string; due?: string }>;
}

function Section({ title, items, tone }: { title: string; items: string[]; tone?: "success" }) {
  if (!items?.length) return null;
  return tone === "success" ? (
    <div className="win11-infobar success p-3">
      <p className="mb-1.5 text-xs font-semibold">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </div>
  ) : (
    <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
      <p className="mb-1.5 text-xs font-semibold text-[color:var(--w11-text-secondary)]">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </div>
  );
}

export default function MeetingMinutesPage() {
  return (
    <AiToolPage
      icon={ClipboardList}
      title="Meeting Minutes"
      subtitle="Raw notes → decisions, discussion and action items"
      subtitleNe="काचे टिप्पणी → निर्णय, छलफल र कार्यभार"
      toolKey="meeting_minutes"
      generateLabel="Structure minutes"
      resultTitle={(d: any) => d?.title || "Minutes"}
      resultHint="Paste raw notes — decisions are only extracted when the notes said “agreed”."
      fields={[
        { key: "meeting_title", label: "Meeting title (optional)", ne: "बैठकको नाम", placeholder: "e.g. Monthly staff meeting" },
        { key: "date", label: "Date (optional)", ne: "मिति", type: "date" },
        {
          key: "notes",
          label: "Paste your notes as-is (shorthand is fine)",
          ne: "टिप्पणी जस्ताको तस्तै",
          type: "textarea",
          rows: 12,
          required: true,
          full: true,
          placeholder: "- bus route: discussed delay\n- R. Sharma: need new whiteboards B-wing\n- agreed fees reminder 15th monthly\n- sports day date TBD",
        },
      ]}
      buildPayload={(v) => ({
        meeting_title: v.meeting_title || undefined,
        date: v.date || undefined,
        notes: v.notes,
      })}
      toText={(d) => {
        const r = d as MinutesResult;
        return [
          r.title,
          r.date_note ?? "",
          "",
          "DISCUSSION",
          ...(r.discussion || []).map((x) => `- ${x}`),
          "",
          "DECISIONS",
          ...(r.decisions || []).map((x) => `- ${x}`),
          "",
          "ACTION ITEMS",
          ...(r.action_items || []).map((a) => `- ${a.task}${a.owner ? ` (${a.owner})` : ""}${a.due ? ` — due ${a.due}` : ""}`),
        ].join("\n");
      }}
      renderResult={(data) => {
        const result = data as MinutesResult;
        return (
          <div className="space-y-4">
            {result.date_note && <p className="text-xs text-[color:var(--w11-text-secondary)]">{result.date_note}</p>}
            <Section title="DISCUSSED" items={result.discussion} />
            {(result.decisions?.length ?? 0) > 0 && <Section title="DECIDED" items={result.decisions!} tone="success" />}
            {(result.action_items?.length ?? 0) > 0 && (
              <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-[color:var(--w11-text-secondary)]">
                  <ListChecks className="h-3.5 w-3.5" /> ACTION ITEMS
                </p>
                <ul className="space-y-1.5 text-sm">
                  {result.action_items!.map((a, i) => (
                    <li key={i}>
                      {a.task}
                      {a.owner && <span className="ml-1 text-[color:var(--w11-text-secondary)]">— {a.owner}</span>}
                      {a.due && <span className="ml-1 text-[color:var(--w11-text-secondary)]">· due {a.due}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
