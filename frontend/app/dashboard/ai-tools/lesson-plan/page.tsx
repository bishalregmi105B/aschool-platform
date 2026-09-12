"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Sparkles, Copy, BookOpen } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { AiResultView } from "@/components/ai/ai-result-view";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

export default function LessonPlanPage() {
  return (
    <PluginGate slug="ai_suite"><LessonPlanContent /></PluginGate>
  );
}

function LessonPlanContent() {
  const [form, setForm] = useState({ subject: "", grade: "", topic: "", duration: "45", objectives: "" });
  const [result, setResult] = useState("");

  const gen = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai-tools/lesson-plan", {
        subject: form.subject,
        grade: form.grade,
        topic: form.topic,
        duration_minutes: parseInt(form.duration) || 45,
        learning_objectives: form.objectives || undefined,
      });
      return res.data;
    },
    onSuccess: (d) => { setResult(d?.data?.content || d?.data?.lesson_plan || JSON.stringify(d?.data, null, 2)); toast.success("Lesson plan generated!"); },
    onError: () => toast.error("Generation failed"),
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="AI Lesson Plan Generator"
        subtitle="Create structured lesson plans in seconds"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="Lesson Details">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Science" /></div>
                <div className="space-y-2"><Label>Grade</Label><Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="e.g. Class 8" /></div>
              </div>
              <div className="space-y-2"><Label>Topic</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Photosynthesis" /></div>
              <div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
              <div className="space-y-2"><Label>Learning Objectives</Label><Textarea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} placeholder="Optional: specific learning objectives" rows={3} /></div>
              <Button className="w-full" onClick={() => gen.mutate()} disabled={!form.subject || !form.topic || gen.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Generating..." : "Generate Lesson Plan"}
              </Button>
            </div>
          </FormSection>
          <DataPanel
            title="Generated Plan"
            actions={result ? (
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result); toast.success("Copied!"); }}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
            ) : undefined}
          >
            {result ? (
              <div className="max-h-[600px] overflow-y-auto rounded-lg p-4" style={{ background: "var(--w11-control-bg)" }}>
                <AiResultView result={result} />
              </div>
            ) : (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Fill in details and click Generate</p>
              </div>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
