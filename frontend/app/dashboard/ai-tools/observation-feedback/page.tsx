"use client";

/**
 * Observation Feedback — POST /ai/generate/lesson_observation.
 * Research: instructional-coaching tools (MagicSchool "classroom observer")
 * structure raw notes into strengths → growth → low-prep next steps; the
 * hard design rule is NO scores ("next steps, not deficiencies") — the
 * result keeps the strengths/suggestions separation explicit.
 */

import { Search, ThumbsUp, TrendingUp } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface Result {
  strengths: string[];
  growth_areas: string[];
  suggestions?: string[];
  summary?: string;
}

export default function ObservationFeedbackPage() {
  return (
    <AiToolPage
      icon={Search}
      title="Observation Feedback"
      subtitle="Balanced strengths/growth from your raw notes — you own it"
      subtitleNe="तपाईंका नोटबाट सन्तुलित प्रतिक्रिया — मालिक तपाईं"
      toolKey="lesson_observation"
      generateLabel="Structure feedback"
      resultTitle="Feedback draft"
      resultHint="No scores — next steps, not deficiencies."
      note="Paste only what you saw. The draft is yours to edit — feedback about a colleague should never ship unreviewed."
      fields={[
        {
          key: "notes",
          label: "What you saw (fragments fine)",
          ne: "के देख्नुभयो — सानै ठीक छ",
          type: "textarea",
          rows: 10,
          required: true,
          full: true,
          placeholder: "- warm greeting, seating chart used\n- 2 students at back not engaged during dictation\n- good pacing till group work, then 5 min lost on instructions",
        },
      ]}
      renderResult={(data) => {
        const result = data as Result;
        return (
          <div className="space-y-3">
            <div className="win11-infobar success p-3">
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold">
                <ThumbsUp className="h-3.5 w-3.5" /> STRENGTHS
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-[color:var(--w11-text-secondary)]">
                <TrendingUp className="h-3.5 w-3.5" /> GROWTH AREAS
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">{result.growth_areas.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            {result.suggestions?.length ? (
              <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <p className="mb-1.5 text-xs font-semibold text-[color:var(--w11-text-secondary)]">LOW-PREP MOVES</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">{result.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            ) : null}
            {result.summary && <p className="rounded-md p-3 text-sm" style={{ background: "var(--w11-control-bg)" }}>{result.summary}</p>}
          </div>
        );
      }}
    />
  );
}
