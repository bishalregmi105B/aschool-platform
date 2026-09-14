"use client";

/**
 * Vocabulary Builder — POST /ai/generate/vocab_support.
 * Research: Diffit/MagicSchool word-bank tools earn trust with bilingual
 * term + definition + example rows a teacher can hand to a student, plus a
 * CSV export for print — table stays the primary view; CSV + Copy moved into
 * the standard result actions.
 */

import { BookOpen, Download, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AiToolPage } from "../_components/ai-tool-page";

interface VocabTerm { term: string; definition: string; definition_ne?: string; example?: string }
interface VocabResult { title?: string; terms: VocabTerm[] }

function toCsv(r: VocabResult): string {
  const rows = [
    ["Term", "Definition (EN)", "परिभाषा (NE)", "Example"],
    ...(r.terms || []).map((t) => [t.term, t.definition, t.definition_ne ?? "", t.example ?? ""]),
  ];
  return rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function VocabSupportPage() {
  return (
    <AiToolPage
      icon={Languages}
      title="Vocabulary Builder"
      subtitle="Bilingual (EN/NE) term banks for any unit"
      subtitleNe="कुनै पनि पाठका लागि द्विभाषी शब्दभण्डार"
      toolKey="vocab_support"
      generateLabel="Generate word bank"
      resultTitle={(d: any) => d?.title || "Word bank"}
      resultHint="Pick a subject, grade and unit to build the bank."
      layout="wide-result"
      fields={[
        { key: "subject", label: "Subject", ne: "विषय", required: true, placeholder: "e.g. Science" },
        { key: "grade", label: "Grade", ne: "कक्षा", required: true, placeholder: "e.g. 8" },
        { key: "unit", label: "Unit / topic", ne: "एकाइ", placeholder: "e.g. Photosynthesis", full: true },
        { key: "count", label: "How many terms", ne: "कति शब्द", type: "number", defaultValue: "10" },
      ]}
      buildPayload={(v) => ({
        subject: v.subject,
        grade: v.grade,
        unit: v.unit || undefined,
        count: Number(v.count) || 10,
      })}
      toText={(d) => toCsv(d as VocabResult)}
      resultActions={(d) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const blob = new Blob(["" + toCsv(d as VocabResult)], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `vocabulary_${(d as VocabResult).title || "unit"}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("CSV downloaded");
          }}
        >
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      )}
      renderResult={(data) => {
        const result = data as VocabResult;
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead>Definition (EN)</TableHead>
                <TableHead>परिभाषा (नेपाली)</TableHead>
                <TableHead>Example</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(result.terms || []).map((t, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{t.term}</TableCell>
                  <TableCell className="text-sm">{t.definition}</TableCell>
                  <TableCell className="text-sm" lang="ne">{t.definition_ne || "—"}</TableCell>
                  <TableCell className="text-sm text-[color:var(--w11-text-secondary)]">{t.example || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      }}
    />
  );
}
