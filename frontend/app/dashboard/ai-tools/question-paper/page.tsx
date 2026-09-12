"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Sparkles, Copy, FileQuestion } from "lucide-react";
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

export default function QuestionPaperPage() {
  return (
    <PluginGate slug="ai_suite">
      <QuestionPaperContent />
    </PluginGate>
  );
}

function QuestionPaperContent() {
  const [form, setForm] = useState({
    subject: "",
    grade: "",
    total_marks: "100",
    duration_minutes: "180",
    difficulty: "medium",
    chapters: "",
    instructions: "",
  });
  const [result, setResult] = useState("");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai-tools/question-paper", {
        subject: form.subject,
        grade: form.grade,
        total_marks: parseInt(form.total_marks),
        duration_minutes: parseInt(form.duration_minutes) || 180,
        difficulty: form.difficulty,
        topics: form.chapters.split(",").map((c) => c.trim()).filter(Boolean),
        instructions: form.instructions || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data?.data?.content || data?.data?.question_paper || JSON.stringify(data?.data, null, 2));
      toast.success("Question paper generated!");
    },
    onError: () => toast.error("Generation failed"),
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileQuestion className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="AI Question Paper Generator"
        subtitle="Generate exam papers with Bloom's taxonomy balance"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="Paper Settings">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics" />
                </div>
                <div className="space-y-2">
                  <Label>Grade/Class</Label>
                  <Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="e.g. Class 10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Marks</Label>
                  <Input type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Chapters (comma separated)</Label>
                <Input value={form.chapters} onChange={(e) => setForm({ ...form, chapters: e.target.value })} placeholder="e.g. Algebra, Geometry, Trigonometry" />
              </div>
              <div className="space-y-2">
                <Label>Additional Instructions</Label>
                <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="e.g. Include 5 MCQs, 3 short answers, 2 long answers" rows={3} />
              </div>
              <Button className="w-full" onClick={() => generateMutation.mutate()} disabled={!form.subject || !form.grade || generateMutation.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> {generateMutation.isPending ? "Generating..." : "Generate Question Paper"}
              </Button>
            </div>
          </FormSection>

          <DataPanel
            title="Generated Paper"
            actions={result ? (
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result); toast.success("Copied!"); }}>
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
            ) : undefined}
          >
            {result ? (
              <div className="max-h-[600px] overflow-y-auto rounded-lg p-4" style={{ background: "var(--w11-control-bg)" }}><AiResultView result={result} /></div>
            ) : (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Fill in the settings and click Generate</p>
              </div>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
