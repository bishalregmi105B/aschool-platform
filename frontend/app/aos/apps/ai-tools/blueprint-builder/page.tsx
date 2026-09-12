"use client";

/**
 * Blueprint Builder — dedicated tool page (wave-2, W4/B3).
 *
 * Designs the marks blueprint of a question paper BEFORE generating it:
 * sections × question types × difficulty with deterministic totals
 * (count × marks_each) re-checked server-side by handle_blueprint_builder.
 *
 * API: POST /ai/generate/blueprint_builder (the generic workbench dispatcher
 * — one registry row, one prompt, one handler, zero dedicated routes).
 * From here a teacher jumps straight to the paper generator with the
 * blueprint pre-carried in the URL.
 */

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, ArrowRight, Grid3X3, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────

interface BlueprintSection {
  name: string;
  question_type: string;
  count: number;
  marks_each: number;
  difficulty: "easy" | "medium" | "hard";
  unit_hint?: string;
  section_total?: number;
}

interface BlueprintResult {
  title: string;
  total_marks: number;
  total_questions?: number;
  duration_minutes?: number;
  notes?: string;
  sections: BlueprintSection[];
}

const QUESTION_TYPES = [
  { value: "mcq", label: "MCQ" },
  { value: "very_short", label: "Very short" },
  { value: "short_answer", label: "Short answer" },
  { value: "long_answer", label: "Long answer" },
  { value: "fill_in_the_blanks", label: "Fill in the blanks" },
  { value: "true_false", label: "True / False" },
  { value: "matching", label: "Matching" },
  { value: "case_study", label: "Case study" },
  { value: "source_based", label: "Source based" },
  { value: "diagram_based", label: "Diagram based" },
  { value: "proof", label: "Proof" },
  { value: "construction", label: "Construction" },
  { value: "comprehension", label: "Comprehension" },
  { value: "numerical", label: "Numerical" },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function BlueprintBuilderPage() {
  return (
    <PluginGate slug="ai_suite">
      <BlueprintBuilderContent />
    </PluginGate>
  );
}

function BlueprintBuilderContent() {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [totalMarks, setTotalMarks] = useState("75");
  const [duration, setDuration] = useState("180");
  const [focusUnit, setFocusUnit] = useState("");
  const [result, setResult] = useState<BlueprintResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai/generate/blueprint_builder", {
        subject,
        grade,
        total_marks: Number(totalMarks) || 75,
        duration_minutes: Number(duration) || 180,
        focus_unit: focusUnit || undefined,
      });
      return res.data?.data as BlueprintResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      toast.success("Blueprint ready");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Generation failed — try again";
      setError(msg);
    },
  });

  const computedTotal = useMemo(
    () =>
      (result?.sections || []).reduce(
        (sum, s) => sum + (s.section_total ?? s.count * s.marks_each),
        0,
      ),
    [result],
  );

  const matchesTarget =
    result &&
    Math.abs(computedTotal - (Number(totalMarks) || 75)) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Blueprint Builder</h1>
          <p className="text-muted-foreground">
            Design the marks grid of a question paper before generating it
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Form ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Paper setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Science"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grade</Label>
                <Input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. 8"
                />
              </div>
              <div className="space-y-2">
                <Label>Total marks</Label>
                <Input
                  type="number"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Focus unit (optional)</Label>
                <Input
                  value={focusUnit}
                  onChange={(e) => setFocusUnit(e.target.value)}
                  placeholder="e.g. Unit 4"
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => generate.mutate()}
              disabled={!subject || !grade || generate.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {generate.isPending ? "Designing blueprint..." : "Generate blueprint"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Result ── */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{result?.title || "Blueprint"}</CardTitle>
              {result && (
                <div
                  className={`text-sm font-semibold ${
                    matchesTarget
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  {computedTotal} / {totalMarks} marks
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generate.isPending ? (
              <PageLoader />
            ) : error ? (
              <EmptyState
                title="Couldn't build the blueprint"
                body={error}
                action={{ label: "Try again", onClick: () => generate.mutate() }}
              />
            ) : !result ? (
              <div className="text-center py-16 text-muted-foreground">
                <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>
                  Fill in the paper setup and generate the marks grid — then
                  send it to the paper generator.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.sections.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {s.name}{" "}
                        <span className="text-muted-foreground font-normal">
                          · {QUESTION_TYPES.find((t) => t.value === s.question_type)?.label || s.question_type}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.count} question{s.count === 1 ? "" : "s"} × {s.marks_each} marks
                        {s.difficulty ? ` · ${s.difficulty}` : ""}
                        {s.unit_hint ? ` · ${s.unit_hint}` : ""}
                      </p>
                    </div>
                    <div className="font-semibold text-sm">
                      {s.section_total ?? s.count * s.marks_each}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm text-muted-foreground">
                    {result.total_questions} questions
                    {result.duration_minutes ? ` · ${result.duration_minutes} min` : ""}
                  </span>
                  <Button asChild>
                    <a
                      href={`/dashboard/ai-tools/question-paper?subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(grade)}&total_marks=${computedTotal}`}
                    >
                      Continue to paper <ArrowRight className="ml-1 h-4 w-4" />
                    </a>
                  </Button>
                </div>
                {result.notes && (
                  <p className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                    {result.notes}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
