"use client";

/**
 * Transition Guide — POST /ai/generate/transition_guide.
 * Research: MagicSchool's transition tool is a two-field generator whose
 * output is shared with families — so the page carries an explicit
 * "general national guidance, verify school rules" honesty line (corpus
 * Part 2.8: labeled fallbacks, never silent overclaim).
 */

import { Compass } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface Section { heading: string; content: string }
interface Result { sections: Section[] }

export default function TransitionGuidePage() {
  return (
    <AiToolPage
      icon={Compass}
      title="Transition Guide"
      subtitle="Grade-transition prep for students and guardians"
      subtitleNe="कक्षा-संक्रमण तयारी — विद्यार्थी र संरक्षकका लागि"
      toolKey="transition_guide"
      generateLabel="Write guide"
      resultTitle="Guide"
      resultHint="General national guidance — verify school-specific rules."
      fields={[
        { key: "from_grade", label: "From grade", ne: "कुन कक्षाबाट", required: true, defaultValue: "10" },
        { key: "to_grade", label: "To grade", ne: "कुन कक्षामा", required: true, defaultValue: "11" },
      ]}
      renderResult={(data) => {
        const result = data as Result;
        return (
          <div className="space-y-3">
            {(result.sections || []).map((s, i) => (
              <div key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <p className="text-sm font-semibold text-[color:var(--w11-text-primary)]">{s.heading}</p>
                <p className="text-sm mt-1 whitespace-pre-wrap text-[color:var(--w11-text-secondary)]">{s.content}</p>
              </div>
            ))}
          </div>
        );
      }}
    />
  );
}
