"use client";

/**
 * Writing Scaffold — POST /ai/generate/text_scaffolder.
 * Research: scaffolding tools break a writing task into prompt + support +
 * sentence starter per step (MagicSchool "Writing Scaffold"); the monospace
 * starter box makes the copyable chunk obvious — students read step 1, not
 * a wall of instructions (31.0 ≤7-fields / scannable-output law).
 */

import { ListOrdered } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface Step { prompt: string; support: string; sentence_starter?: string }
interface Result { title: string; steps: Step[] }

export default function WritingScaffoldPage() {
  return (
    <AiToolPage
      icon={ListOrdered}
      title="Writing Scaffold"
      subtitle="Step-by-step support with sentence starters"
      subtitleNe="वाक्य-सुरुवातका साथ चरणबद्ध लेखन सहयोग"
      toolKey="text_scaffolder"
      generateLabel="Build scaffold"
      resultTitle={(d: any) => d?.title || "Scaffold"}
      resultHint="Describe the task — get supported steps."
      fields={[
        {
          key: "task",
          label: "The writing task",
          ne: "लेखन कार्य",
          type: "textarea",
          rows: 4,
          required: true,
          full: true,
          placeholder: "e.g. Write a paragraph about a festival you attended",
        },
        { key: "grade", label: "Grade", ne: "कक्षा", placeholder: "e.g. 6" },
      ]}
      buildPayload={(v) => ({ task: v.task, grade: v.grade || undefined })}
      renderResult={(data) => {
        const result = data as Result;
        return (
          <ol className="space-y-3">
            {(result.steps || []).map((s, i) => (
              <li key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{i + 1}. {s.prompt}</p>
                <p className="text-xs mt-1 text-[color:var(--w11-text-secondary)]">{s.support}</p>
                {s.sentence_starter && (
                  <p className="mt-1.5 rounded px-2 py-1 font-mono text-xs" style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)" }}>
                    {s.sentence_starter}
                  </p>
                )}
              </li>
            ))}
          </ol>
        );
      }}
    />
  );
}
