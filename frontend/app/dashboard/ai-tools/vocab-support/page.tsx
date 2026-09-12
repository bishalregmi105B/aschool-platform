"use client";

/**
 * Vocabulary Builder — dedicated tool page (wave-2, bilingual word banks).
 * API: POST /ai/generate/vocab_support (generic workbench dispatcher).
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, BookOpen, Download, Languages, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface VocabTerm {
  term: string;
  definition: string;
  definition_ne?: string;
  example?: string;
}

export default function VocabSupportPage() {
  return (
    <PluginGate slug="ai_suite">
      <VocabContent />
    </PluginGate>
  );
}

function VocabContent() {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [unit, setUnit] = useState("");
  const [count, setCount] = useState("10");
  const [result, setResult] = useState<{ title?: string; terms: VocabTerm[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai/generate/vocab_support", {
        subject,
        grade,
        unit: unit || undefined,
        count: Number(count) || 10,
      });
      return res.data?.data as { title?: string; terms: VocabTerm[] };
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      toast.success(`${data.terms?.length ?? 0} terms generated`);
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Generation failed — try again",
      );
    },
  });

  const exportCsv = () => {
    if (!result) return;
    const rows = [
      ["Term", "Definition (EN)", "परिभाषा (NE)", "Example"],
      ...result.terms.map((t) => [
        t.term,
        t.definition,
        t.definition_ne ?? "",
        t.example ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocabulary_${subject || "unit"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Languages className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Vocabulary Builder"
        subtitle="Bilingual (EN/NE) term banks for any unit"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <FormSection title="Word bank scope" className="lg:col-span-2">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Grade</Label>
                  <Input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g. 8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Unit / topic</Label>
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. Photosynthesis"
                />
              </div>
              <div className="space-y-2">
                <Label>How many terms</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => generate.mutate()}
                disabled={!subject || !grade || generate.isPending}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generate.isPending ? "Building bank…" : "Generate word bank"}
              </Button>
            </div>
          </FormSection>

          <DataPanel
            className="lg:col-span-3"
            title={result?.title || "Word bank"}
            actions={result && result.terms.length > 0 ? (
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            ) : undefined}
            bodyClassName="p-0"
          >
            {generate.isPending ? (
              <div className="p-4"><PageLoader /></div>
            ) : error ? (
              <div className="p-4">
                <EmptyState
                  title="Couldn't build the word bank"
                  body={error}
                  action={{ label: "Try again", onClick: () => generate.mutate() }}
                />
              </div>
            ) : !result || result.terms.length === 0 ? (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Pick a subject, grade and unit to build the bank.</p>
              </div>
            ) : (
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
                  {result.terms.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{t.term}</TableCell>
                      <TableCell className="text-sm">{t.definition}</TableCell>
                      <TableCell className="text-sm" lang="ne">
                        {t.definition_ne || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-[color:var(--w11-text-secondary)]">
                        {t.example || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
