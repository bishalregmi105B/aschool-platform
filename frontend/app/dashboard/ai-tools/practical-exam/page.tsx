"use client";

/**
 * Practical Exam Builder — POST /ai/generate/practical_exam.
 * Research: assessment generators (Diffit Quiz, MagicSchool) pair each task
 * with its materials + marking criteria so the lab can actually run it; the
 * total-marks badge answers "does this fit my 25-mark practical?" in one
 * glance (31.0: "what's the state" immediately).
 */

import { FlaskConical } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface Task { task: string; marks: number; materials?: string[]; criteria?: string[] }
interface Result { tasks: Task[]; total_marks?: number }

export default function PracticalExamPage() {
  return (
    <AiToolPage
      icon={FlaskConical}
      title="Practical Exam Builder"
      subtitle="Lab tasks, materials and marking criteria"
      subtitleNe="प्रयोगात्मक कार्य, सामग्री र अंकदण्ड"
      toolKey="practical_exam"
      generateLabel="Build assessment"
      resultTitle={(d: any) => (d?.total_marks ? `Assessment — ${d.total_marks} marks` : "Assessment")}
      resultHint="Tasks your lab can actually run — safety criteria included."
      layout="wide-result"
      fields={[
        { key: "subject", label: "Subject", ne: "विषय", required: true, placeholder: "e.g. Physics" },
        { key: "grade", label: "Grade", ne: "कक्षा", required: true, placeholder: "e.g. 9" },
        { key: "unit", label: "Unit (optional)", ne: "एकाइ", placeholder: "e.g. Electricity" },
        { key: "total_marks", label: "Total marks", ne: "कुल अंक", type: "number", defaultValue: "25" },
      ]}
      buildPayload={(v) => ({
        subject: v.subject,
        grade: v.grade,
        unit: v.unit || undefined,
        total_marks: Number(v.total_marks) || 25,
      })}
      renderResult={(data) => {
        const result = data as Result;
        return (
          <div className="space-y-3">
            {(result.tasks || []).map((t, i) => (
              <div key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{i + 1}. {t.task}</p>
                  <span className="text-sm font-semibold text-[color:var(--w11-accent)]">[{t.marks}]</span>
                </div>
                {t.materials?.length ? <p className="text-xs mt-1 text-[color:var(--w11-text-secondary)]">Materials: {t.materials.join(", ")}</p> : null}
                {t.criteria?.length ? <p className="text-xs mt-1 text-[color:var(--w11-text-primary)]">✓ {t.criteria.join(" · ")}</p> : null}
              </div>
            ))}
          </div>
        );
      }}
    />
  );
}
