"use client";

/**
 * Exam Timetable Drafter — POST /ai/generate/exam_timetable.
 * Research: AI scheduling tools must be honest about authority — the page
 * header says the constraint solver owns the final timetable (corpus Part
 * 2.8 honesty: labeled fallbacks, never overclaim); conflicts surface as a
 * warning infobar inside the result, not a silent list.
 */

import { AlertTriangle, CalendarDays } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface Day { date: string; subjects: string[]; notes?: string }
interface Result { days: Day[]; conflicts?: string[] }

export default function ExamTimetableDraftPage() {
  return (
    <AiToolPage
      icon={CalendarDays}
      title="Exam Timetable Drafter"
      subtitle="A starting draft — the constraint solver owns the final one"
      subtitleNe="सुरुवाती मस्यौदा — अन्तिम निर्णय solver को"
      toolKey="exam_timetable"
      generateLabel="Draft timetable"
      resultTitle="Draft"
      resultHint="Gap days and clash checks included."
      fields={[
        {
          key: "subjects",
          label: "Subjects (one per day — order hint)",
          ne: "विषयहरू (एक दिनमा एक)",
          type: "textarea",
          rows: 6,
          required: true,
          full: true,
          placeholder: "Nepali\nEnglish\nMaths\nScience\nSocial",
        },
        { key: "start_date", label: "Start date (optional)", ne: "सुरु मिति", type: "date" },
      ]}
      buildPayload={(v) => ({
        subjects: String(v.subjects || "").split("\n").map((s) => s.trim()).filter(Boolean),
        start_date: v.start_date || undefined,
      })}
      renderResult={(data) => {
        const result = data as Result;
        return (
          <div className="space-y-3">
            {(result.conflicts || []).length > 0 && (
              <div className="win11-infobar warning flex gap-1.5 p-3 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {(result.conflicts ?? []).join(" · ")}
              </div>
            )}
            {(result.days || []).map((d, i) => (
              <div key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{d.date}</p>
                <p className="text-sm text-[color:var(--w11-text-secondary)]">{(d.subjects || []).join(", ")}</p>
                {d.notes && <p className="text-xs mt-1 text-[color:var(--w11-text-secondary)]">{d.notes}</p>}
              </div>
            ))}
          </div>
        );
      }}
    />
  );
}
