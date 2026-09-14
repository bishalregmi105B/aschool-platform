"use client";

/**
 * Text Leveler — POST /ai/generate/text_leveler.
 * Research: Diffit's signature move is the change log — "same content,
 * different level" must be PROVEN (avg sentence length, words, what changed)
 * or teachers won't trust it; the rewritten passage is the primary text, the
 * changelog secondary. Kept: direction (−3/+3), grade target, stats chips.
 */

import { Gauge } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface LevelerResult {
  text: string;
  level: string;
  grade_band?: string;
  changes_made?: Array<{ kind: string; detail: string }>;
  stats?: { sentences: number; words: number; avg_sentence_words: number };
}

export default function TextLevelerPage() {
  return (
    <AiToolPage
      icon={Gauge}
      title="Text Leveler"
      subtitle="Same content, different reading level — for mixed-ability classes"
      subtitleNe="एउटै पाठ, फरक पठन स्तर — मिश्रित कक्षाका लागि"
      toolKey="text_leveler"
      generateLabel="Rewrite"
      resultTitle="Rewritten"
      resultHint="Paste a passage and pick a direction."
      fields={[
        {
          key: "source",
          label: "Paste the passage",
          ne: "पाठ टाँस्नुहोस्",
          type: "textarea",
          rows: 10,
          required: true,
          full: true,
          placeholder: "Paste any passage, instructions or letter here…",
        },
        {
          key: "direction",
          label: "Direction",
          ne: "दिशा",
          type: "select",
          defaultValue: "easier",
          options: [
            { value: "easier", label: "Easier (−3 levels)" },
            { value: "same", label: "Same level, clearer" },
            { value: "harder", label: "Harder (+3 levels)" },
          ],
        },
        { key: "grade", label: "Target grade", ne: "लक्ष्य कक्षा", placeholder: "e.g. 5" },
      ]}
      buildPayload={(v) => ({ text: v.source, direction: v.direction, grade: v.grade || undefined })}
      toText={(d) => (d as LevelerResult).text}
      renderResult={(data) => {
        const result = data as LevelerResult;
        return (
          <div className="space-y-4">
            <div className="rounded-lg p-4 text-sm whitespace-pre-wrap" style={{ background: "var(--w11-control-bg)" }}>
              {result.text}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {result.grade_band && <span className="win11-chip accent">{result.grade_band}</span>}
              {result.stats && (
                <>
                  <span className="win11-chip">{result.stats.words} words</span>
                  <span className="win11-chip">{result.stats.avg_sentence_words} words/sentence avg</span>
                </>
              )}
            </div>
            {(result.changes_made?.length ?? 0) > 0 && (
              <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <p className="text-xs font-semibold mb-1.5 text-[color:var(--w11-text-secondary)]">WHAT CHANGED</p>
                <ul className="space-y-1 text-xs">
                  {result.changes_made!.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium capitalize">{c.kind.replace(/_/g, " ")}</span>
                      {" — "}
                      {c.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
