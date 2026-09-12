"use client";
/** Practical Exam Builder — POST /ai/generate/practical_exam (wave-2). */
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
import { ArrowLeft, FlaskConical, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Task { task: string; marks: number; materials?: string[]; criteria?: string[] }
interface Result { tasks: Task[]; total_marks?: number }

export default function PracticalExamPage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [unit, setUnit] = useState("");
  const [total, setTotal] = useState("25");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/practical_exam", {
        subject, grade, unit: unit || undefined, total_marks: Number(total) || 25,
      })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Assessment built"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Practical Exam Builder</h1><p className="text-muted-foreground">Lab tasks, materials and marking criteria</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Setup</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Physics" /></div>
              <div className="space-y-2"><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 9" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Unit (optional)</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
              <div className="space-y-2"><Label>Total marks</Label><Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} /></div>
            </div>
            <Button className="w-full" onClick={() => gen.mutate()} disabled={!subject || !grade || gen.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Building…" : "Build assessment"}
            </Button>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Assessment</CardTitle>
              {result && <span className="text-sm font-semibold">{result.total_marks} marks</span>}
            </div>
          </CardHeader>
          <CardContent>
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't build the assessment" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground"><FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Tasks your lab can actually run — safety criteria included.</p></div>
            ) : (
              <div className="space-y-3">
                {result.tasks?.map((t, i) => (
                  <div key={i} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{i + 1}. {t.task}</p>
                      <span className="text-sm font-semibold">[{t.marks}]</span>
                    </div>
                    {t.materials?.length ? <p className="text-xs text-muted-foreground mt-1">Materials: {t.materials.join(", ")}</p> : null}
                    {t.criteria?.length ? <p className="text-xs mt-1">✓ {t.criteria.join(" · ")}</p> : null}
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
