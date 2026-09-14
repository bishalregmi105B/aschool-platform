"use client";

/**
 * AI Letter Writer — POST /ai-tools/letter-writer (dedicated route).
 * Research: school letter generators offer a typed template picker (notice,
 * circular, fee reminder…) plus recipient/tone and mark output as a DRAFT
 * needing signature — the type/tone lists are kept verbatim; the letter
 * renders in a letterhead-style frame so it reads as correspondence, and
 * Print stays one click away (InfixEdu print-twin discipline).
 */

import { PenLine, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiResultView } from "@/components/ai/ai-result-view";
import { AiToolPage } from "../_components/ai-tool-page";

export default function LetterWriterPage() {
  return (
    <AiToolPage
      icon={PenLine}
      title="AI Letter Writer"
      subtitle="School letters, notices and communications — drafts for your signature"
      subtitleNe="विद्यालय पत्र, सूचना र पत्राचार — हस्ताक्षर अघिको मस्यौदा"
      toolKey="letter-writer"
      endpoint="/ai-tools/letter-writer"
      generateLabel="Generate letter"
      resultTitle="Generated letter"
      resultHint="Pick a letter type and fill the details."
      note="Official letters need a human signature. Verify names, dates and amounts before printing on letterhead."
      fields={[
        {
          key: "type",
          label: "Letter type",
          ne: "पत्रको प्रकार",
          type: "select",
          defaultValue: "notice",
          options: [
            { value: "notice", label: "Notice" },
            { value: "circular", label: "Circular" },
            { value: "leave_approval", label: "Leave Approval" },
            { value: "fee_reminder", label: "Fee Reminder" },
            { value: "parent_letter", label: "Parent Letter" },
            { value: "transfer_certificate", label: "Transfer Certificate" },
            { value: "recommendation", label: "Recommendation" },
            { value: "warning", label: "Warning Letter" },
            { value: "appreciation", label: "Appreciation Letter" },
            { value: "event_invitation", label: "Event Invitation" },
          ],
        },
        {
          key: "tone",
          label: "Tone",
          ne: "शैली",
          type: "select",
          defaultValue: "formal",
          options: [
            { value: "formal", label: "Formal" },
            { value: "semi-formal", label: "Semi-formal" },
            { value: "friendly", label: "Friendly" },
            { value: "strict", label: "Strict" },
          ],
        },
        { key: "recipient", label: "Recipient", ne: "प्राप्तकर्ता", placeholder: "e.g. All Parents, Mr. Sharma, Class 10 Students" },
        { key: "subject", label: "Subject", ne: "विषय", required: true, placeholder: "e.g. Annual Day Celebration" },
        {
          key: "context",
          label: "Context / instructions",
          ne: "सन्दर्भ",
          type: "textarea",
          rows: 4,
          full: true,
          placeholder: "Details about what the letter should convey…",
        },
      ]}
      unwrap={(res: any) => {
        const d = res?.data?.data;
        return typeof d === "string" ? d : d?.content || d?.letter || JSON.stringify(d ?? res?.data, null, 2);
      }}
      resultActions={() => (
        <Button variant="ghost" size="sm" onClick={() => window.print()}>
          <FileText className="h-4 w-4 mr-1" /> Print
        </Button>
      )}
      renderResult={(data) => (
        <div className="border border-[color:var(--w11-border-subtle)] rounded-lg p-8 min-h-[500px]" style={{ background: "var(--w11-card-bg)" }}>
          <div className="rounded-lg p-4 font-serif" style={{ background: "var(--w11-control-bg)" }}>
            <AiResultView result={data} />
          </div>
        </div>
      )}
    />
  );
}
