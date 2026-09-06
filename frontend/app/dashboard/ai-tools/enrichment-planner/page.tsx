"use client";
/** Enrichment Planner — POST /ai/generate/enrichment_plan (wave-2). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Rocket, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Activity { title: string; description: string; difficulty?: string }
interface Result { activities: Activity[] }

const TONE: Record<string, string> = {
  stretch: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  challenge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  project: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Enrichment Planner</h1><p className="text-muted-foreground">Stretch activities for early finishers — no busywork</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Scope</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Maths" /></div>
              <div className="space-y-2"><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 7" /></div>
            </div>
            <div className="space-y-2"><Label>Current topic (optional)</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Fractions" /></div>
            <Button className="w-full" onClick={() => gen.mutate()} disabled={!subject || !grade || gen.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Designing…" : "Design activities"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Activities</CardTitle></CardHeader>
          <CardContent>
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't design activities" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground"><Rocket className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Every activity produces something students can show.</p></div>
            ) : (
              <div className="space-y-3">
                {result.activities?.map((a, i) => (
                  <div key={i} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{a.title}</p>
                      {a.difficulty && <Badge variant="outline" className={`shrink-0 ${TONE[a.difficulty] ?? ""}`}>{a.difficulty}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
