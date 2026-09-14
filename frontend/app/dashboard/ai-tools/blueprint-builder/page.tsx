"use client";

/**
 * Blueprint Builder — POST /ai/generate/blueprint_builder.
 * Research: exam-design tools split "design the grid" from "write the paper"
 * and chain them — this page keeps the deterministic totals re-check
 * (count × marks_each, verified server-side) and the one-click "Continue to
 * paper" hand-off whose prefill question-paper now actually honours.
 */

import { useMemo } from "react";
import { ArrowRight, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiToolPage } from "../_components/ai-tool-page";

interface BlueprintSection {
  name: string;
  question_type: string;
  count: number;
  marks_each: number;
  difficulty: "easy" | "medium" | "hard";
  unit_hint?: string;
  section_total?: number;
}
interface BlueprintResult {
  title: string;
  total_marks: number;
  total_questions?: number;
  duration_minutes?: number;
  notes?: string;
  sections: BlueprintSection[];
}

const QUESTION_TYPES: Record<string, string> = {
  mcq: "MCQ",
  very_short: "Very short",
  short_answer: "Short answer",
  long_answer: "Long answer",
  fill_in_the_blanks: "Fill in the blanks",
  true_false: "True / False",
  matching: "Matching",
  case_study: "Case study",
  source_based: "Source based",
  diagram_based: "Diagram based",
  proof: "Proof",
  construction: "Construction",
  comprehension: "Comprehension",
  numerical: "Numerical",
};

function sectionTotal(s: BlueprintSection) {
  return s.section_total ?? s.count * s.marks_each;
}

export default function BlueprintBuilderPage() {
  return (
    <AiToolPage
      icon={Grid3X3}
      title="Blueprint Builder"
      subtitle="Design the marks grid of a paper before generating it"
      subtitleNe="प्रश्नपत्र बनाउनु अघि अंकको ढाँचा तयार पार्नुहोस्"
      toolKey="blueprint_builder"
      generateLabel="Generate blueprint"
      resultTitle={(d: any) => d?.title || "Blueprint"}
      resultHint="Fill in the paper setup and generate the marks grid — then send it to the paper generator."
      layout="wide-result"
      fields={[
        { key: "subject", label: "Subject", ne: "विषय", required: true, placeholder: "e.g. Science" },
        { key: "grade", label: "Grade", ne: "कक्षा", required: true, placeholder: "e.g. 8" },
        { key: "total_marks", label: "Total marks", ne: "कुल अंक", type: "number", defaultValue: "75" },
        { key: "duration_minutes", label: "Duration (minutes)", ne: "अवधि", type: "number", defaultValue: "180" },
        { key: "focus_unit", label: "Focus unit (optional)", ne: "केन्द्रित एकाइ", advanced: true, full: true, placeholder: "e.g. Unit 4" },
      ]}
      buildPayload={(v) => ({
        subject: v.subject,
        grade: v.grade,
        total_marks: Number(v.total_marks) || 75,
        duration_minutes: Number(v.duration_minutes) || 180,
        focus_unit: v.focus_unit || undefined,
      })}
      toText={(d) => {
        const r = d as BlueprintResult;
        return [
          `${r.title} — ${r.total_marks} marks`,
          ...(r.sections || []).map((s) => `- ${s.name} (${QUESTION_TYPES[s.question_type] || s.question_type}): ${s.count} × ${s.marks_each} = ${sectionTotal(s)} [${s.difficulty}]${s.unit_hint ? ` ${s.unit_hint}` : ""}`),
        ].join("\n");
      }}
      renderResult={(data, values) => <BlueprintView result={data as BlueprintResult} values={values} />}
    />
  );
}

function BlueprintView({ result, values }: { result: BlueprintResult; values: Record<string, string> }) {
  const computedTotal = useMemo(
    () => (result.sections || []).reduce((sum, s) => sum + sectionTotal(s), 0),
    [result],
  );
  const matchesTarget = Math.abs(computedTotal - (result.total_marks || 0)) < 0.01;

  return (
    <div className="space-y-3">
      <div
        className="text-sm font-semibold"
        style={{ color: matchesTarget ? "var(--w11-accent)" : "#9d5d00" }}
      >
        {computedTotal} / {result.total_marks} marks
      </div>
      {(result.sections || []).map((s, i) => (
        <div key={i} className="flex items-center justify-between rounded-md border border-[color:var(--w11-border-subtle)] p-3">
          <div>
            <p className="font-medium text-sm text-[color:var(--w11-text-primary)]">
              {s.name}{" "}
              <span className="text-[color:var(--w11-text-secondary)] font-normal">
                · {QUESTION_TYPES[s.question_type] || s.question_type}
              </span>
            </p>
            <p className="text-xs text-[color:var(--w11-text-secondary)]">
              {s.count} question{s.count === 1 ? "" : "s"} × {s.marks_each} marks
              {s.difficulty ? ` · ${s.difficulty}` : ""}
              {s.unit_hint ? ` · ${s.unit_hint}` : ""}
            </p>
          </div>
          <div className="font-semibold text-sm text-[color:var(--w11-accent)]">{sectionTotal(s)}</div>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-[color:var(--w11-border-subtle)] pt-3">
        <span className="text-sm text-[color:var(--w11-text-secondary)]">
          {result.total_questions} questions
          {result.duration_minutes ? ` · ${result.duration_minutes} min` : ""}
        </span>
        <Button asChild>
          <a
            href={`/dashboard/ai-tools/question-paper?subject=${encodeURIComponent(values.subject || "")}&grade=${encodeURIComponent(values.grade || "")}&total_marks=${computedTotal}`}
          >
            Continue to paper <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </Button>
      </div>
      {result.notes && <div className="win11-infobar warning p-3 text-xs">{result.notes}</div>}
    </div>
  );
}
