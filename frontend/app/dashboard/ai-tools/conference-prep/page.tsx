"use client";
/** Conference Prep — POST /ai/generate/progress_conference (wave-2). */
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
import { ArrowLeft, HelpCircle, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Result {
  agenda: string[];
  talking_points?: string[];
  questions_to_ask?: string[];
  follow_up_note?: string;
}

function Block({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-md border p-3">
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

export default function ConferencePrepPage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [student, setStudent] = useState("");
  const [facts, setFacts] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/progress_conference", {
        student: student || undefined,
        known_facts: facts || undefined,
      })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Agenda ready"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Conference Prep</h1><p className="text-muted-foreground">Partner-tone agendas — bring real data, not AI summaries</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>What you know</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Student (optional)</Label><Input value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Name or class" /></div>
            <div className="space-y-2"><Label>Facts to share (marks, attendance — only real ones)</Label>
              <Textarea rows={6} value={facts} onChange={(e) => setFacts(e.target.value)}
                placeholder={"Attendance 82% this term\nMaths 54/100 (up from 48)\nStrong in group work"} /></div>
            <Button className="w-full" onClick={() => gen.mutate()} disabled={gen.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Preparing…" : "Prepare agenda"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Agenda</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't prepare" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Strengths first — then open questions for the guardian.</p></div>
            ) : (
              <>
                <Block title="AGENDA" items={result.agenda} />
                <Block title="TALKING POINTS" items={result.talking_points} />
                <div className="rounded-md border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-400"><HelpCircle className="h-3.5 w-3.5" /> ASK THE GUARDIAN</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{(result.questions_to_ask || []).map((q, i) => <li key={i}>{q}</li>)}</ul>
                </div>
                {result.follow_up_note && <p className="text-xs text-muted-foreground">{result.follow_up_note}</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
