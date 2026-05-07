"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Sparkles, Copy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function LessonPlanPage() {
  return (
    <PluginGate slug="ai_tools"><LessonPlanContent /></PluginGate>
  );
}

function LessonPlanContent() {
  const [form, setForm] = useState({ subject: "", grade: "", topic: "", duration: "45", objectives: "" });
  const [result, setResult] = useState("");

  const gen = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai-tools/lesson-plan", { ...form, duration_minutes: parseInt(form.duration) });
      return res.data;
    },
    onSuccess: (d) => { setResult(d?.data?.content || d?.data?.lesson_plan || JSON.stringify(d?.data, null, 2)); toast.success("Lesson plan generated!"); },
    onError: () => toast.error("Generation failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">AI Lesson Plan Generator</h1><p className="text-muted-foreground">Create structured lesson plans in seconds</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Lesson Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle>Generated Plan</CardTitle>{result && <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result); toast.success("Copied!"); }}><Copy className="h-4 w-4 mr-1" /> Copy</Button>}</div></CardHeader>
          <CardContent>
            {result ? <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[600px] overflow-y-auto">{result}</pre> : <div className="text-center py-16 text-muted-foreground"><Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Fill in details and click Generate</p></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
