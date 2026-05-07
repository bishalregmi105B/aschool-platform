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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Sparkles, Download, Copy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function QuestionPaperPage() {
  return (
    <PluginGate slug="ai_tools">
      <QuestionPaperContent />
    </PluginGate>
  );
}

function QuestionPaperContent() {
  const [form, setForm] = useState({
    subject: "",
    grade: "",
    total_marks: "100",
    difficulty: "medium",
    chapters: "",
    instructions: "",
  });
  const [result, setResult] = useState("");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai-tools/question-paper", {
        ...form,
        total_marks: parseInt(form.total_marks),
        chapters: form.chapters.split(",").map((c) => c.trim()).filter(Boolean),
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold">AI Question Paper Generator</h1>
          <p className="text-muted-foreground">Generate exam papers with Bloom&apos;s taxonomy balance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Paper Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Paper</CardTitle>
              {result && (
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result); toast.success("Copied!"); }}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result ? (
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[600px] overflow-y-auto">{result}</pre>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Fill in the settings and click Generate</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
