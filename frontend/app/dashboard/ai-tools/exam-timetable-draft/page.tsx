"use client";
/** Exam Timetable Drafter — POST /ai/generate/exam_timetable (wave-2). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertTriangle, ArrowLeft, CalendarDays, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

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
    <AOSPage>
      <AOSPageHeader
        icon={<CalendarDays className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Exam Timetable Drafter"
        subtitle="A starting draft — the constraint solver owns the final one"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="Subjects + start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Subjects (one per day order hint)</Label>
                <Textarea rows={6} value={subjects} onChange={(e) => setSubjects(e.target.value)}
                  placeholder={"Nepali\nEnglish\nMaths\nScience\nSocial"} />
              </div>
              <div className="space-y-2"><Label>Start date (optional)</Label>
                <BSDateInput value={startDate} onChange={(v) => setStartDate(v)} emit="bs" /></div>
              <Button className="w-full" onClick={() => gen.mutate()} disabled={!subjects.trim() || gen.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Drafting…" : "Draft timetable"}
              </Button>
            </div>
          </FormSection>
          <DataPanel title="Draft">
            <div className="space-y-3">
              {gen.isPending ? <PageLoader /> : error ? (
                <EmptyState title="Couldn't draft" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
              ) : !result ? (
                <div className="text-center py-16 text-[color:var(--w11-text-secondary)]"><CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Gap days and clash checks included.</p></div>
              ) : (
                <>
                  {(result.conflicts || []).length > 0 && (
                    <div className="win11-infobar warning flex gap-1.5 p-3 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {(result.conflicts ?? []).join(" · ")}
                    </div>
                  )}
                  {result.days?.map((d, i) => (
                    <div key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                      <p className="text-sm font-medium text-[color:var(--w11-text-primary)]">{d.date}</p>
                      <p className="text-sm text-[color:var(--w11-text-secondary)]">{(d.subjects || []).join(", ")}</p>
                      {d.notes && <p className="text-xs mt-1 text-[color:var(--w11-text-secondary)]">{d.notes}</p>}
                    </div>
                  ))}
                </>
              )}
            </div>
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
