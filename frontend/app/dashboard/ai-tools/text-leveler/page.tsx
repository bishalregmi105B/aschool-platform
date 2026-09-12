"use client";

/**
 * Text Leveler — dedicated tool page (wave-2, differentiation).
 *
 * Rewrites a passage up/down ~3 grade levels with a change log. API:
 * POST /ai/generate/text_leveler (generic workbench dispatcher).
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Copy, Gauge, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface LevelerResult {
  text: string;
  level: string;
  grade_band?: string;
  changes_made?: Array<{ kind: string; detail: string }>;
  stats?: { sentences: number; words: number; avg_sentence_words: number };
}

export default function TextLevelerPage() {
  return (
    <PluginGate slug="ai_suite">
      <TextLevelerContent />
    </PluginGate>
  );
}

function TextLevelerContent() {
  const [source, setSource] = useState("");
  const [direction, setDirection] = useState("easier");
  const [grade, setGrade] = useState("");
  const [result, setResult] = useState<LevelerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai/generate/text_leveler", {
        text: source,
        direction,
        grade: grade || undefined,
      });
      return res.data?.data as LevelerResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      toast.success("Rewritten");
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Generation failed — try again",
      );
    },
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Gauge className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Text Leveler"
        subtitle="Same content, different reading level — for mixed-ability classes"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="Source text">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Paste the passage</Label>
                <Textarea
                  rows={10}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Paste any passage, instructions or letter here…"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select value={direction} onValueChange={setDirection}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easier">Easier (−3 levels)</SelectItem>
                      <SelectItem value="same">Same level, clearer</SelectItem>
                      <SelectItem value="harder">Harder (+3 levels)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target grade</Label>
                  <Input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g. 5"
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => generate.mutate()}
                disabled={!source.trim() || generate.isPending}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generate.isPending ? "Rewriting…" : "Rewrite"}
              </Button>
            </div>
          </FormSection>

          <DataPanel
            title="Rewritten"
            actions={result ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(result.text);
                  toast.success("Copied!");
                }}
              >
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
            ) : undefined}
          >
            {generate.isPending ? (
              <PageLoader />
            ) : error ? (
              <EmptyState
                title="Couldn't rewrite the text"
                body={error}
                action={{ label: "Try again", onClick: () => generate.mutate() }}
              />
            ) : !result ? (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]">
                <Gauge className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Paste a passage and pick a direction.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg p-4 text-sm whitespace-pre-wrap" style={{ background: "var(--w11-control-bg)" }}>
                  {result.text}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {result.grade_band && (
                    <span className="win11-chip accent">{result.grade_band}</span>
                  )}
                  {result.stats && (
                    <>
                      <span className="win11-chip">
                        {result.stats.words} words
                      </span>
                      <span className="win11-chip">
                        {result.stats.avg_sentence_words} words/sentence avg
                      </span>
                    </>
                  )}
                </div>
                {(result.changes_made?.length ?? 0) > 0 && (
                  <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                    <p className="text-xs font-semibold mb-1.5 text-[color:var(--w11-text-secondary)]">
                      WHAT CHANGED
                    </p>
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
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
