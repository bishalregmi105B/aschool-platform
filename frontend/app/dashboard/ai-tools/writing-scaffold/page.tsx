"use client";
/** Writing Scaffold — POST /ai/generate/text_scaffolder (wave-2). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, ListOrdered, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Step { prompt: string; support: string; sentence_starter?: string }
interface Result { title: string; steps: Step[] }

export default function WritingScaffoldPage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [task, setTask] = useState("");
  const [grade, setGrade] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/text_scaffolder", { task, grade: grade || undefined })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Scaffold ready"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Writing Scaffold</h1><p className="text-muted-foreground">Step-by-step support with sentence starters</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>The writing task</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Task</Label><Textarea rows={4} value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Write a paragraph about a festival you attended" /></div>
            <div className="space-y-2"><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 6" /></div>
            <Button className="w-full" onClick={() => gen.mutate()} disabled={!task.trim() || gen.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Building…" : "Build scaffold"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{result?.title || "Scaffold"}</CardTitle></CardHeader>
          <CardContent>
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't build the scaffold" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground"><ListOrdered className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Describe the task — get supported steps.</p></div>
            ) : (
              <ol className="space-y-3">
                {result.steps.map((s, i) => (
                  <li key={i} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{i + 1}. {s.prompt}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.support}</p>
                    {s.sentence_starter && <p className="mt-1.5 rounded bg-muted px-2 py-1 font-mono text-xs">{s.sentence_starter}</p>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
