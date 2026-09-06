"use client";
/** Observation Feedback — POST /ai/generate/lesson_observation (wave-2). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Search, Sparkles, ThumbsUp, TrendingUp } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Result {
  strengths: string[];
  growth_areas: string[];
  suggestions?: string[];
  summary?: string;
}

export default function ObservationFeedbackPage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/lesson_observation", { notes })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Feedback structured"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Observation Feedback</h1><p className="text-muted-foreground">Balanced strengths/growth from your raw notes — you own it</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Your raw notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>What you saw (fragments fine)</Label>
              <Textarea rows={10} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={"- warm greeting, seating chart used\n- 2 students at back not engaged during dictation\n- good pacing till group work, then 5 min lost on instructions"} />
            </div>
            <Button className="w-full" onClick={() => gen.mutate()} disabled={!notes.trim() || gen.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Structuring…" : "Structure feedback"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Feedback draft</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't structure feedback" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground"><Search className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No scores — next steps, not deficiencies.</p></div>
            ) : (
              <>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"><ThumbsUp className="h-3.5 w-3.5" /> STRENGTHS</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
                <div className="rounded-md border p-3">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> GROWTH AREAS</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{result.growth_areas.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
                {result.suggestions?.length ? (
                  <div className="rounded-md border p-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">LOW-PREP MOVES</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm">{result.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                ) : null}
                {result.summary && <p className="rounded-md bg-muted p-3 text-sm">{result.summary}</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
