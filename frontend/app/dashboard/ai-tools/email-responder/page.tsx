"use client";

/**
 * Email Responder — POST /ai/generate/email_responder.
 * Research: AI email tools for schools (MagicSchool "Parent Communication")
 * constrain the model to the teacher's own bullet points and then list the
 * commitments the draft makes for verification — the result panel keeps that
 * "verify these are yours" checklist; nothing sends from the app.
 */

import { Mail, Send, ShieldCheck } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface EmailResult {
  reply: string;
  subject_line?: string;
  key_points?: string[];
  tone_note?: string;
}

export default function EmailResponderPage() {
  return (
    <AiToolPage
      icon={Mail}
      title="Email Responder"
      subtitle="Professional parent/stakeholder replies from your bullet points"
      subtitleNe="तपाईंका बुँदाहरूबाट व्यावसायिक इमेल जवाफ"
      toolKey="email_responder"
      generateLabel="Draft reply"
      resultTitle="Draft"
      resultHint="Paste the message and your points — get a sendable draft."
      note="The reply may use only the facts you supply. Nothing is sent from here — review, copy, and send it yourself."
      fields={[
        {
          key: "incoming",
          label: "The incoming message (paste or summarize)",
          ne: "आएको सन्देश",
          type: "textarea",
          rows: 5,
          full: true,
          placeholder: "e.g. Parent asks why the bus was late twice this week…",
        },
        {
          key: "points",
          label: "Your points (one per line — the only facts it may use)",
          ne: "तपाईंका बुँदाहरू",
          type: "textarea",
          rows: 5,
          full: true,
          placeholder: "Bus 4 had a mechanical check on Tuesday\nRoute adjusted from Monday; pickup moves 10 min earlier",
        },
        {
          key: "tone",
          label: "Tone",
          ne: "शैली",
          type: "select",
          defaultValue: "warm",
          options: [
            { value: "warm", label: "Warm" },
            { value: "neutral", label: "Neutral" },
            { value: "formal", label: "Formal" },
            { value: "firm", label: "Firm" },
          ],
        },
        { key: "sender_role", label: "Signed as (optional)", ne: "हस्ताक्षर", placeholder: "Class Teacher — Grade 8" },
      ]}
      validate={(v) => (!v.incoming.trim() && !v.points.trim() ? "Paste the message or list your points first" : null)}
      buildPayload={(v) => ({
        incoming: v.incoming || undefined,
        points: String(v.points || "").split("\n").map((p) => p.trim()).filter(Boolean),
        tone: v.tone,
        sender_role: v.sender_role || undefined,
      })}
      toText={(d) => {
        const r = d as EmailResult;
        return `${r.subject_line ? `Subject: ${r.subject_line}\n\n` : ""}${r.reply}`;
      }}
      renderResult={(data) => {
        const result = data as EmailResult;
        return (
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
                  <ShieldCheck className="h-3.5 w-3.5" /> COMMITMENTS IN THIS DRAFT — verify these are yours
                </p>
                <ul className="list-disc space-y-1 pl-5 text-xs">
                  {result.key_points.map((k, i) => <li key={i}>{k}</li>)}
                </ul>
              </div>
            )}
            {result.tone_note && <p className="text-xs text-[color:var(--w11-text-secondary)]">{result.tone_note}</p>}
            <p className="flex items-center gap-1 text-[11px] text-[color:var(--w11-text-secondary)]">
              <Send className="h-3 w-3" /> Nothing is sent from here — copy it into your mail client after review.
            </p>
          </div>
        );
      }}
    />
  );
}
