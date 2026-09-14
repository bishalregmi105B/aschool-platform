"use client";

/**
 * AI Lesson Plan — POST /ai-tools/lesson-plan (dedicated route, pre-workbench).
 * Research: teacher lesson planners (MagicSchool, Diffit) keep the four
 * essentials visible — subject, grade, topic, duration — and collapse
 * objectives to an optional advanced field; the generated plan renders as
 * markdown with copy/save so it can move into a register or the Writer.
 */

import { BookOpen } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

export default function LessonPlanPage() {
  return (
    <AiToolPage
      icon={BookOpen}
      title="AI Lesson Plan"
      subtitle="Structured lesson plans for any subject and grade"
      subtitleNe="कुनै पनि विषय र कक्षाका लागि संरचित पाठ योजना"
      toolKey="lesson-plan"
      endpoint="/ai-tools/lesson-plan"
      generateLabel="Generate lesson plan"
      resultTitle="Generated plan"
      resultHint="Fill in details and press Generate."
      fields={[
        { key: "subject", label: "Subject", ne: "विषय", required: true, placeholder: "e.g. Science" },
        { key: "grade", label: "Grade", ne: "कक्षा", placeholder: "e.g. Class 8" },
        { key: "topic", label: "Topic", ne: "पाठ्यवस्तु", required: true, placeholder: "e.g. Photosynthesis", full: true },
        { key: "duration", label: "Duration (minutes)", ne: "अवधि (मिनेट)", type: "number", defaultValue: "45" },
        {
          key: "objectives",
          label: "Learning objectives",
          ne: "सिकाइ उद्देश्य",
          type: "textarea",
          rows: 3,
          advanced: true,
          full: true,
          placeholder: "Optional: specific learning objectives",
        },
      ]}
      buildPayload={(v) => ({
        subject: v.subject,
        grade: v.grade,
        topic: v.topic,
        duration_minutes: parseInt(v.duration) || 45,
        learning_objectives: v.objectives || undefined,
      })}
      unwrap={(res: any) => {
        const d = res?.data?.data;
        return typeof d === "string" ? d : d?.content || d?.lesson_plan || JSON.stringify(d ?? res?.data, null, 2);
      }}
    />
  );
}
