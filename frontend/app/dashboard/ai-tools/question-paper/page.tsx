"use client";

/**
 * AI Question Paper Generator — POST /ai-tools/question-paper (dedicated route).
 * Research: paper generators (MagicSchool "Multiple Choice"/Diffit Quiz) gate
 * on the two facts that matter (subject, grade), keep marks/duration/difficulty
 * as quick defaults, and — the key pre-work finding — must ACCEPT prefill:
 * Blueprint Builder deep-links here with ?subject=&grade=&total_marks= which
 * the old page ignored; the template reads declared field keys from the URL.
 */

import { FileQuestion } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

export default function QuestionPaperPage() {
  return (
    <AiToolPage
      icon={FileQuestion}
      title="AI Question Paper Generator"
      subtitle="Exam papers with Bloom's taxonomy and chapter-wise balance"
      subtitleNe="ब्लुम तह र पाठ्यक्रम सन्तुलनसहित प्रश्नपत्र"
      toolKey="question-paper"
      endpoint="/ai-tools/question-paper"
      generateLabel="Generate question paper"
      resultTitle="Generated paper"
      resultHint="Fill in the settings and press Generate."
      fields={[
        { key: "subject", label: "Subject", ne: "विषय", required: true, placeholder: "e.g. Mathematics" },
        { key: "grade", label: "Grade / class", ne: "कक्षा", required: true, placeholder: "e.g. Class 10" },
        { key: "total_marks", label: "Total marks", ne: "कुल अंक", type: "number", defaultValue: "100" },
        { key: "duration_minutes", label: "Duration (minutes)", ne: "अवधि", type: "number", defaultValue: "180" },
        {
          key: "difficulty",
          label: "Difficulty",
          ne: "कठिनाइ",
          type: "select",
          defaultValue: "medium",
          options: [
            { value: "easy", label: "Easy" },
            { value: "medium", label: "Medium" },
            { value: "hard", label: "Hard" },
            { value: "mixed", label: "Mixed" },
          ],
        },
        { key: "chapters", label: "Chapters (comma separated)", ne: "पाठहरू", placeholder: "e.g. Algebra, Geometry, Trigonometry", full: true },
        {
          key: "instructions",
          label: "Additional instructions",
          ne: "थप निर्देशन",
          type: "textarea",
          rows: 3,
          advanced: true,
          full: true,
          placeholder: "e.g. Include 5 MCQs, 3 short answers, 2 long answers",
        },
      ]}
      buildPayload={(v) => ({
        subject: v.subject,
        grade: v.grade,
        total_marks: parseInt(v.total_marks) || 100,
        duration_minutes: parseInt(v.duration_minutes) || 180,
        difficulty: v.difficulty,
        topics: String(v.chapters || "").split(",").map((c) => c.trim()).filter(Boolean),
        instructions: v.instructions || undefined,
      })}
      unwrap={(res: any) => {
        const d = res?.data?.data;
        return typeof d === "string" ? d : d?.content || d?.question_paper || JSON.stringify(d ?? res?.data, null, 2);
      }}
    />
  );
}
