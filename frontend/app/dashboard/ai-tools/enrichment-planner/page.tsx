"use client";
/** Enrichment Planner — POST /ai/generate/enrichment_plan (wave-2). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Rocket, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface Activity { title: string; description: string; difficulty?: string }
interface Result { activities: Activity[] }

const DIFF_TONE: Record<string, "success" | "warning" | "accent"> = {
  stretch: "success",
  challenge: "accent",
  project: "warning",
};

export default function EnrichmentPlannerPage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/enrichment_plan", { subject, grade, topic: topic || undefined })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Activities ready"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Rocket className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Enrichment Planner"
        subtitle="Stretch activities for early finishers — no busywork"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="Scope">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Maths" /></div>
                <div className="space-y-2"><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 7" /></div>
              </div>
              <div className="space-y-2"><Label>Current topic (optional)</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Fractions" /></div>
              <Button className="w-full" onClick={() => gen.mutate()} disabled={!subject || !grade || gen.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Designing…" : "Design activities"}
              </Button>
            </div>
          </FormSection>
          <DataPanel title="Activities">
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't design activities" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]"><Rocket className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Every activity produces something students can show.</p></div>
            ) : (
              <div className="space-y-3">
                {result.activities?.map((a, i) => (
                  <div key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{a.title}</p>
                      {a.difficulty && (
                        <span className={`win11-chip ${DIFF_TONE[a.difficulty] ?? ""} shrink-0`}>{a.difficulty}</span>
                      )}
                    </div>
                    <p className="text-sm mt-1 text-[color:var(--w11-text-secondary)]">{a.description}</p>
                  </div>
                ))}
              </div>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
