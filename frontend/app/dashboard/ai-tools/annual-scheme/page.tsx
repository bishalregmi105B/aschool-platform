"use client";

/**
 * Annual Scheme — POST /ai/generate/annual_scheme.
 * Research: Diffit-style two-field scope (subject+grade) then a full-page
 * artifact; MagicSchool planners output the artifact beside the form so the
 * teacher reads it without navigation. Festival-aware months kept verbatim
 * from the prompt contract (real Nepali calendar, Part 2.3 moat).
 */

import { CalendarRange } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface Unit { month: string; topics: string[]; assessment?: string }
interface Result { units: Unit[] }

export default function AnnualSchemePage() {
  return (
    <AiToolPage
      icon={CalendarRange}
      title="Annual Scheme"
      subtitle="Units across Baisakh–Chaitra, festival-aware"
      subtitleNe="बैशाख–चैत नतिजा-केन्द्रित वार्षिक योजना"
      toolKey="annual_scheme"
      generateLabel="Draft scheme"
      resultTitle="Month-by-month"
      resultHint="Curriculum units distributed across the Nepali year."
      fields={[
        { key: "subject", label: "Subject", ne: "विषय", required: true, placeholder: "e.g. Science" },
        { key: "grade", label: "Grade", ne: "कक्षा", required: true, placeholder: "e.g. 8" },
      ]}
      renderResult={(data) => {
        const result = data as Result;
        return (
          <ol className="space-y-2">
            {(result.units || []).map((u, i) => (
              <li key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{u.month}</p>
                <p className="text-sm text-[color:var(--w11-text-secondary)]">{(u.topics || []).join(" · ")}</p>
                {u.assessment && <p className="text-xs mt-1" style={{ color: "var(--w11-accent)" }}>📌 {u.assessment}</p>}
              </li>
            ))}
          </ol>
        );
      }}
    />
  );
}
