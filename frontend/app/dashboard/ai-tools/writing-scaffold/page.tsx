"use client";
/** Writing Scaffold — POST /ai/generate/text_scaffolder (wave-2). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, ListOrdered, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

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
    <AOSPage>
      <AOSPageHeader
        icon={<ListOrdered className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Writing Scaffold"
        subtitle="Step-by-step support with sentence starters"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="The writing task">
            <div className="space-y-4">
              <div className="space-y-2"><Label>Task</Label><Textarea rows={4} value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Write a paragraph about a festival you attended" /></div>
              <div className="space-y-2"><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 6" /></div>
              <Button className="w-full" onClick={() => gen.mutate()} disabled={!task.trim() || gen.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Building…" : "Build scaffold"}
              </Button>
            </div>
          </FormSection>
          <DataPanel title={result?.title || "Scaffold"}>
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't build the scaffold" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]"><ListOrdered className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Describe the task — get supported steps.</p></div>
            ) : (
              <ol className="space-y-3">
                {result.steps.map((s, i) => (
                  <li key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                    <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{i + 1}. {s.prompt}</p>
                    <p className="text-xs mt-1 text-[color:var(--w11-text-secondary)]">{s.support}</p>
                    {s.sentence_starter && <p className="mt-1.5 rounded px-2 py-1 font-mono text-xs" style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)" }}>{s.sentence_starter}</p>}
                  </li>
                ))}
              </ol>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
