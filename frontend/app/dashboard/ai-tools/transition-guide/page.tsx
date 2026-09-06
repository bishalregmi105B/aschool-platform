"use client";
/** Transition Guide — POST /ai/generate/transition_guide (wave-2). */
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
import { ArrowLeft, Compass, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Section { heading: string; content: string }
interface Result { sections: Section[] }

export default function TransitionGuidePage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [fromGrade, setFromGrade] = useState("10");
  const [toGrade, setToGrade] = useState("11");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/transition_guide", { from_grade: fromGrade, to_grade: toGrade })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Guide ready"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Transition Guide</h1><p className="text-muted-foreground">What changes between grades — for students and guardians</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Transition</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>From grade</Label><Input value={fromGrade} onChange={(e) => setFromGrade(e.target.value)} /></div>
              <div className="space-y-2"><Label>To grade</Label><Input value={toGrade} onChange={(e) => setToGrade(e.target.value)} /></div>
            </div>
            <Button className="w-full" onClick={() => gen.mutate()} disabled={!fromGrade || !toGrade || gen.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Writing…" : "Write guide"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Guide</CardTitle></CardHeader>
          <CardContent>
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't write the guide" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground"><Compass className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>General national guidance — verify school-specific rules.</p></div>
            ) : (
              <div className="space-y-3">
                {result.sections?.map((s, i) => (
                  <div key={i} className="rounded-md border p-3">
                    <p className="text-sm font-semibold">{s.heading}</p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{s.content}</p>
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
