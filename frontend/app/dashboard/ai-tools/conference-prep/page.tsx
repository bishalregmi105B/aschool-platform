"use client";

/**
 * Conference Prep — POST /ai/generate/progress_conference.
 * Research: MagicSchool's conference tool frames the AI as an agenda draft
 * that must be fed REAL facts ("bring data, not AI summaries") — the form
 * says so in one line; output = agenda + talking points + open questions
 * (the guardian speaks too), per teacher-PT-meeting best practice.
 */

import { Users, HelpCircle } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface Result {
  agenda: string[];
  talking_points?: string[];
  questions_to_ask?: string[];
  follow_up_note?: string;
}

function Block({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
      <p className="mb-1.5 text-xs font-semibold text-[color:var(--w11-text-secondary)]">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

export default function ConferencePrepPage() {
  return (
    <AiToolPage
      icon={Users}
      title="Conference Prep"
      subtitle="Partner-tone agendas with open questions"
      subtitleNe="आमाबाबु बैठकको एजेन्डा — खुला प्रश्नसहित"
      toolKey="progress_conference"
      generateLabel="Prepare agenda"
      resultTitle="Agenda"
      resultHint="Strengths first — then open questions for the guardian."
      note="Share real facts only (marks, attendance). The AI phrases; it does not decide what is true."
      fields={[
        { key: "student", label: "Student (optional)", ne: "विद्यार्थी", placeholder: "Name or class" },
        {
          key: "known_facts",
          label: "Facts to share (marks, attendance — only real ones)",
          ne: "साझा गर्नुपर्ने तथ्य",
          type: "textarea",
          rows: 6,
          full: true,
          placeholder: "Attendance 82% this term\nMaths 54/100 (up from 48)\nStrong in group work",
        },
      ]}
      renderResult={(data) => {
        const result = data as Result;
        return (
          <div className="space-y-3">
            <Block title="AGENDA" items={result.agenda} />
            <Block title="TALKING POINTS" items={result.talking_points} />
            <div className="win11-infobar info p-3">
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold">
                <HelpCircle className="h-3.5 w-3.5" /> ASK THE GUARDIAN
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {(result.questions_to_ask || []).map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
            {result.follow_up_note && <p className="text-xs text-[color:var(--w11-text-secondary)]">{result.follow_up_note}</p>}
          </div>
        );
      }}
    />
  );
}
