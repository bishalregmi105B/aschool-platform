"use client";
/** Annual Scheme — POST /ai/generate/annual_scheme (wave-2). */
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
import { ArrowLeft, CalendarRange, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Unit { month: string; topics: string[]; assessment?: string }
interface Result { units: Unit[] }

export default function AnnualSchemePage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/annual_scheme", { subject, grade })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Scheme drafted"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Annual Scheme</h1><p className="text-muted-foreground">Units across Baisakh–Chaitra, festival-aware</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Subject</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Science" /></div>
              <div className="space-y-2"><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 8" /></div>
            </div>
            <Button className="w-full" onClick={() => gen.mutate()} disabled={!subject || !grade || gen.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Drafting…" : "Draft scheme"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Month-by-month</CardTitle></CardHeader>
          <CardContent>
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't draft the scheme" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground"><CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Curriculum units distributed across the Nepali year.</p></div>
            ) : (
              <ol className="space-y-2">
                {result.units?.map((u, i) => (
                  <li key={i} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{u.month}</p>
                    <p className="text-sm text-muted-foreground">{(u.topics || []).join(" · ")}</p>
                    {u.assessment && <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">📌 {u.assessment}</p>}
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
