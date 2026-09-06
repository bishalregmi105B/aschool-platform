"use client";

/**
 * Lesson Hook — dedicated tool page (wave-2, planning).
 * API: POST /ai/generate/lesson_hook (generic workbench dispatcher).
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Copy, Lightbulb, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
    <PluginGate slug="ai_suite">
      <LessonHookContent />
    </PluginGate>
  );
}

function LessonHookContent() {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [materials, setMaterials] = useState("");
  const [result, setResult] = useState<HookResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai/generate/lesson_hook", {
        subject,
        grade,
        topic,
        materials_hint: materials || undefined,
      });
      return res.data?.data as HookResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      toast.success("Hook ready");
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
          <h1 className="text-2xl font-bold">Lesson Hook</h1>
          <p className="text-muted-foreground">
            A 3–7 minute opener students can't ignore
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today's lesson</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label>Topic</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Photosynthesis"
              />
            </div>
            <div className="space-y-2">
              <Label>Materials the class has (optional)</Label>
              <Input
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
                placeholder="e.g. chalk, torch, plastic bottle"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => generate.mutate()}
              disabled={!topic.trim() || generate.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {generate.isPending ? "Designing hook…" : "Design hook"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>The hook</CardTitle>
              {result && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(result.hook);
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
                title="Couldn't design a hook"
                body={error}
                action={{ label: "Try again", onClick: () => generate.mutate() }}
              />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Give the topic — get an opener with facilitation steps.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed">{result.hook}</p>
                {result.steps && result.steps.length > 0 && (
                  <div className="rounded-md border p-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                      HOW TO RUN IT
                    </p>
                    <ol className="list-decimal space-y-1 pl-5 text-sm">
                      {result.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  {result.timing_minutes && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                      {result.timing_minutes} min
                    </span>
                  )}
                  {result.materials?.map((m) => (
                    <span key={m} className="rounded-full bg-muted px-2.5 py-1">
                      {m}
                    </span>
                  ))}
                </div>
                {result.bridge_to_lesson && (
                  <p className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <span className="font-semibold">Bridge: </span>
                    {result.bridge_to_lesson}
                  </p>
                )}
                {result.alternatives && result.alternatives.length > 0 && (
                  <div className="rounded-md border p-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                      BACKUPS
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-xs">
                      {result.alternatives.map((a, i) => (
                        <li key={i}>{a}</li>
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
