"use client";
/** Exam Timetable Drafter — POST /ai/generate/exam_timetable (wave-2). */
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
import { AlertTriangle, ArrowLeft, CalendarDays, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Day { date: string; subjects: string[]; notes?: string }
interface Result { days: Day[]; conflicts?: string[] }

export default function ExamTimetableDraftPage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [subjects, setSubjects] = useState("");
  const [startDate, setStartDate] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/exam_timetable", {
        subjects: subjects.split("\n").map((s) => s.trim()).filter(Boolean),
        start_date: startDate || undefined,
      })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Draft ready"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Exam Timetable Drafter</h1><p className="text-muted-foreground">A starting draft — the constraint solver owns the final one</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Subjects + start</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Subjects (one per day order hint)</Label>
              <Textarea rows={6} value={subjects} onChange={(e) => setSubjects(e.target.value)}
                placeholder={"Nepali\nEnglish\nMaths\nScience\nSocial"} />
            </div>
            <div className="space-y-2"><Label>Start date (optional)</Label>
              <Input value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="e.g. 2082-06-01" /></div>
            <Button className="w-full" onClick={() => gen.mutate()} disabled={!subjects.trim() || gen.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Drafting…" : "Draft timetable"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Draft</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't draft" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground"><CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Gap days and clash checks included.</p></div>
            ) : (
              <>
                {(result.conflicts || []).length > 0 && (
                  <p className="flex gap-1.5 rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {(result.conflicts ?? []).join(" · ")}
                  </p>
                )}
                {result.days?.map((d, i) => (
                  <div key={i} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{d.date}</p>
                    <p className="text-sm text-muted-foreground">{(d.subjects || []).join(", ")}</p>
                    {d.notes && <p className="text-xs text-muted-foreground mt-1">{d.notes}</p>}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
