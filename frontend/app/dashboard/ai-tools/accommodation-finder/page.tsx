"use client";

/**
 * Accommodation Finder — POST /ai/generate/accommodation_finder.
 * Research: MagicSchool's Barrier→Accommodation tool keeps input to ONE
 * free-text field and outputs a scannable adjustment list, never a diagnosis
 * (corpus law 31.0: answer "what can I do here" in one panel); A3 template —
 * inputs left, result right, empty = "Generate to see output".
 */

import { Accessibility, ShieldAlert } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface Accommodation { barrier: string; accommodation: string; category?: string }
interface Result { summary?: string; accommodations: Accommodation[] }

export default function AccommodationFinderPage() {
  return (
    <AiToolPage
      icon={Accessibility}
      title="Accommodation Finder"
      subtitle="Adjust the environment, not the child — never a diagnosis"
      subtitleNe="बाधा होइन, बालबालिका होइन — कक्षामा मिल्दो समायोजन"
      toolKey="accommodation_finder"
      generateLabel="Suggest accommodations"
      resultTitle="Suggestions"
      resultHint="Describe the barrier — get practical classroom adjustments."
      note="Describe what makes the task hard (behaviour, not labels). Suggestions are drafts for your professional judgement."
      fields={[
        {
          key: "barrier_description",
          label: "What makes the task hard?",
          ne: "कुन कामले समस्या दियो?",
          type: "textarea",
          rows: 6,
          required: true,
          full: true,
          placeholder: "e.g. Loses place in long dictations; copies from the board very slowly; understands everything when discussing aloud",
        },
      ]}
      renderResult={(data) => {
        const result = data as Result;
        return (
          <div className="space-y-3">
            {(result.accommodations || []).map((a, i) => (
              <div key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <p className="text-xs font-semibold capitalize text-[color:var(--w11-text-secondary)]">
                  {(a.category || "support").replace(/_/g, " ")}
                </p>
                <p className="text-sm mt-1 text-[color:var(--w11-text-primary)]">
                  <span className="font-medium">Barrier:</span> {a.barrier}
                </p>
                <p className="text-sm text-[color:var(--w11-text-primary)]">
                  <span className="font-medium">Try:</span> {a.accommodation}
                </p>
              </div>
            ))}
            {result.summary && (
              <div className="win11-infobar warning flex gap-1.5 p-3 text-xs">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {result.summary}
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
