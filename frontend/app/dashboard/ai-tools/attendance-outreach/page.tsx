"use client";

/**
 * Attendance Outreach — POST /ai/generate/attendance_outreach.
 * Research: MagicSchool's outreach-draft tools lead with a "drafts only — a
 * human sends them" disclaimer (corpus: AI must stay human-in-the-loop,
 * Part 19); input is one roster-shaped textarea so teachers paste what they
 * already keep, no new data model.
 */

import { Megaphone } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";
import { StatusChip } from "@/components/aos/kit/page-kit";

interface Message { student: string; message: string; escalation?: string }
interface Result { messages: Message[] }

export default function AttendanceOutreachPage() {
  return (
    <AiToolPage
      icon={Megaphone}
      title="Attendance Outreach"
      subtitle="Kind, escalating guardian follow-ups — drafts only, you send"
      subtitleNe="अनुहारपूर्ण संरक्षक पालना — मस्यौदा मात्र, पठाउने तपाईं"
      toolKey="attendance_outreach"
      generateLabel="Draft messages"
      resultTitle="Drafts"
      resultHint="Respectful notes with one clear ask each."
      note="Drafts only — a human reads and sends them. Never send an AI note about a child without checking the facts."
      fields={[
        {
          key: "attendance_summary",
          label: "One line per student (name + pattern)",
          ne: "विद्यार्थी प्रति एक लाइन (नाम + ढाँचा)",
          type: "textarea",
          rows: 8,
          required: true,
          full: true,
          placeholder: "Anish Karki — 3 days this week\nBina Rai — late 5 times this month\nChandra Tamang — absent 12 days since Baisakh",
        },
      ]}
      renderResult={(data) => {
        const result = data as Result;
        return (
          <div className="space-y-3">
            {(result.messages || []).map((m, i) => (
              <div key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{m.student}</p>
                  {m.escalation && <StatusChip status={m.escalation} label={m.escalation} />}
                </div>
                <p className="text-sm text-[color:var(--w11-text-secondary)]">{m.message}</p>
              </div>
            ))}
          </div>
        );
      }}
    />
  );
}
