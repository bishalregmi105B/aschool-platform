"use client";
/** Conference Prep — POST /ai/generate/progress_conference (wave-2). */
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
import { ArrowLeft, HelpCircle, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface Result {
  agenda: string[];
  talking_points?: string[];
  questions_to_ask?: string[];
  follow_up_note?: string;
}

function Block({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
      <p className="mb-1.5 text-xs font-semibold text-[color:var(--w11-text-secondary)]">{title}</p>
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
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Conference Prep"
        subtitle="Partner-tone agendas — bring real data, not AI summaries"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="What you know">
            <div className="space-y-4">
              <div className="space-y-2"><Label>Student (optional)</Label><Input value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Name or class" /></div>
              <div className="space-y-2"><Label>Facts to share (marks, attendance — only real ones)</Label>
                <Textarea rows={6} value={facts} onChange={(e) => setFacts(e.target.value)}
                  placeholder={"Attendance 82% this term\nMaths 54/100 (up from 48)\nStrong in group work"} /></div>
              <Button className="w-full" onClick={() => gen.mutate()} disabled={gen.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Preparing…" : "Prepare agenda"}
              </Button>
            </div>
          </FormSection>
          <DataPanel title="Agenda">
            <div className="space-y-3">
              {gen.isPending ? <PageLoader /> : error ? (
                <EmptyState title="Couldn't prepare" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
              ) : !result ? (
                <div className="text-center py-16 text-[color:var(--w11-text-secondary)]"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Strengths first — then open questions for the guardian.</p></div>
              ) : (
                <>
                  <Block title="AGENDA" items={result.agenda} />
                  <Block title="TALKING POINTS" items={result.talking_points} />
                  <div className="win11-infobar info p-3">
                    <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold"><HelpCircle className="h-3.5 w-3.5" /> ASK THE GUARDIAN</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm">{(result.questions_to_ask || []).map((q, i) => <li key={i}>{q}</li>)}</ul>
                  </div>
                  {result.follow_up_note && <p className="text-xs text-[color:var(--w11-text-secondary)]">{result.follow_up_note}</p>}
                </>
              )}
            </div>
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
