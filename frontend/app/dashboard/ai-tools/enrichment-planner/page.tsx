"use client";

/**
 * Enrichment Planner — POST /ai/generate/enrichment_plan.
 * Research: MagicSchool's extension-activity tool requires every activity to
 * produce a showable artifact ("no busywork") — the result renderer keeps the
 * difficulty chips (stretch/challenge/project) so a teacher can pick per
 * student, and the empty state says it out loud.
 */

import { Rocket } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface Activity { title: string; description: string; difficulty?: string }
interface Result { activities: Activity[] }

const DIFF_TONE: Record<string, "success" | "warning" | "accent"> = {
  stretch: "success",
  challenge: "accent",
  project: "warning",
};

export default function EnrichmentPlannerPage() {
  return (
    <AiToolPage
      icon={Rocket}
      title="Enrichment Planner"
      subtitle="Stretch activities for early finishers — no busywork"
      subtitleNe="छिटो सक्ने विद्यार्थीका लागि थप चुनौती — बेकार काम होइन"
      toolKey="enrichment_plan"
      generateLabel="Design activities"
      resultTitle="Activities"
      resultHint="Every activity produces something students can show."
      fields={[
        { key: "subject", label: "Subject", ne: "विषय", required: true, placeholder: "e.g. Maths" },
        { key: "grade", label: "Grade", ne: "कक्षा", required: true, placeholder: "e.g. 7" },
        { key: "topic", label: "Current topic (optional)", ne: "हालको पाठ्यवस्तु", placeholder: "e.g. Fractions" },
      ]}
      renderResult={(data) => {
        const result = data as Result;
        return (
          <div className="space-y-3">
            {(result.activities || []).map((a, i) => (
              <div key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{a.title}</p>
                  {a.difficulty && (
                    <span className={`win11-chip ${DIFF_TONE[a.difficulty] ?? ""} shrink-0`}>{a.difficulty}</span>
                  )}
                </div>
                <p className="text-sm mt-1 text-[color:var(--w11-text-secondary)]">{a.description}</p>
              </div>
            ))}
          </div>
        );
      }}
    />
  );
}
