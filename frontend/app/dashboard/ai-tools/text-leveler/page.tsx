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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Text Leveler</h1>
          <p className="text-muted-foreground">
            Same content, different reading level — for mixed-ability classes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Source text</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Rewritten</CardTitle>
              {result && (
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
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generate.isPending ? (
              <PageLoader />
            ) : error ? (
              <EmptyState
                title="Couldn't rewrite the text"
                body={error}
                action={{ label: "Try again", onClick: () => generate.mutate() }}
              />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground">
                <Gauge className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Paste a passage and pick a direction.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap">
                  {result.text}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {result.grade_band && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                      {result.grade_band}
                    </span>
                  )}
                  {result.stats && (
                    <>
                      <span className="rounded-full bg-muted px-2.5 py-1">
                        {result.stats.words} words
                      </span>
                      <span className="rounded-full bg-muted px-2.5 py-1">
                        {result.stats.avg_sentence_words} words/sentence avg
                      </span>
                    </>
                  )}
                </div>
                {(result.changes_made?.length ?? 0) > 0 && (
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
