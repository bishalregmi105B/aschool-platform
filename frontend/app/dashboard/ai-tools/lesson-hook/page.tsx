"use client";

/**
 * Lesson Hook — POST /ai/generate/lesson_hook.
 * Research: the 5-minute opener genre (MagicSchool "Lesson Hook") outputs one
 * runnable hook + facilitation steps + materials, NOT a list to scroll — the
 * result panel leads with the hook text, then the numbered run order, and a
 * success-toned "bridge to lesson" line so the opener lands into the topic.
 */

import { Lightbulb } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface HookResult {
  hook: string;
  timing_minutes?: number;
  materials?: string[];
  steps?: string[];
  bridge_to_lesson?: string;
  alternatives?: string[];
}

export default function LessonHookPage() {
  return (
    <AiToolPage
      icon={Lightbulb}
      title="Lesson Hook"
      subtitle="A 3–7 minute opener students can't ignore"
      subtitleNe="३–७ मिनेटको शुरुवात — विषयप्रति अरुचि असम्भव"
      toolKey="lesson_hook"
      generateLabel="Design hook"
      resultTitle="The hook"
      resultHint="Give the topic — get an opener with facilitation steps."
      layout="wide-result"
      fields={[
        { key: "subject", label: "Subject", ne: "विषय", placeholder: "e.g. Science" },
        { key: "grade", label: "Grade", ne: "कक्षा", placeholder: "e.g. 8" },
        { key: "topic", label: "Topic", ne: "पाठ्यवस्तु", required: true, placeholder: "e.g. Photosynthesis", full: true },
        { key: "materials_hint", label: "Materials the class has (optional)", ne: "सामग्री", placeholder: "e.g. chalk, torch, plastic bottle", full: true },
      ]}
      toText={(d) => {
        const r = d as HookResult;
        return [r.hook, "", ...(r.steps || []).map((s, i) => `${i + 1}. ${s}`), r.bridge_to_lesson ? `\nBridge: ${r.bridge_to_lesson}` : ""].join("\n");
      }}
      renderResult={(data) => {
        const result = data as HookResult;
        return (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">{result.hook}</p>
            {result.steps && result.steps.length > 0 && (
              <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <p className="mb-1.5 text-xs font-semibold text-[color:var(--w11-text-secondary)]">HOW TO RUN IT</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {result.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {result.timing_minutes && <span className="win11-chip accent">{result.timing_minutes} min</span>}
              {result.materials?.map((m) => <span key={m} className="win11-chip">{m}</span>)}
            </div>
            {result.bridge_to_lesson && (
              <div className="win11-infobar success p-3 text-xs">
                <span className="font-semibold">Bridge: </span>
                {result.bridge_to_lesson}
              </div>
            )}
            {result.alternatives && result.alternatives.length > 0 && (
              <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <p className="mb-1.5 text-xs font-semibold text-[color:var(--w11-text-secondary)]">BACKUPS</p>
                <ul className="list-disc space-y-1 pl-5 text-xs">
                  {result.alternatives.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
