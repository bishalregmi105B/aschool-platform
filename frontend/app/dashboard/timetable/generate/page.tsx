"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Spinner, PageLoader } from "@/components/ui/spinner";
import { Wand2, CheckCircle, Calendar, AlertCircle } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
}

interface SolverSlot {
  day: string;
  period: number;
  subject_id: string;
  subject_name?: string;
  teacher_id?: string | null;
  teacher_name?: string;
}

interface SolverClass {
  class_id: string;
  class_name?: string;
  section_id: string;
  section_name?: string;
  slots: SolverSlot[];
}

interface GenerateResult {
  classes: SolverClass[];
  conflicts?: string[];
  days?: string[];
  periods_per_day?: number;
}

export default function TimetableGeneratePage() {
  return (
    <PluginGate slug="timetable">
      <GenerateContent />
    </PluginGate>
  );
}

function GenerateContent() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes-for-timetable"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ClassItem[]>>("/academics/classes");
      return res.data.data ?? [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      // The solver always works school-wide; class_id is applied as a preview/
      // save scope below (backend POST /timetable/save replaces only the
      // (class, section) pairs included in the payload).
      const res = await api.post<ApiResponse<GenerateResult>>("/timetable/generate", {
        periods_per_day: 8,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setResult(data ?? null);
      const totalSlots = (data?.classes ?? []).reduce((n, c) => n + (c.slots?.length ?? 0), 0);
      if (totalSlots === 0) {
        toast.error("The solver produced no slots — assign subjects to classes first.");
      } else {
        toast.success(`Preview ready: ${totalSlots} slots across ${(data?.classes ?? []).length} class sections`);
      }
    },
    onError: () => toast.error("Failed to generate timetable"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!result) return null;
      // Scoped save: when a class is selected only that class's slots are
      // replaced — other classes (and manual slots) are left untouched.
      const payload = {
        classes: classId
          ? (result.classes ?? []).filter((c) => c.class_id === classId)
          : (result.classes ?? []),
      };
      const res = await api.post<ApiResponse<{ saved_slots: number }>>("/timetable/save", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(`Saved ${data?.saved_slots ?? 0} slots to the timetable`);
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
    },
    onError: () => toast.error("Failed to save the timetable"),
  });

  if (isLoading) return <PageLoader />;

  const previewClasses = result
    ? classId
      ? (result.classes ?? []).filter((c) => c.class_id === classId)
      : (result.classes ?? [])
    : [];
  const previewSlotCount = previewClasses.reduce((n, c) => n + (c.slots?.length ?? 0), 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wand2 className="h-6 w-6" /> Timetable Generator
        </h1>
        <p className="text-muted-foreground mt-1">
          Auto-generate a clash-free timetable — assigns subjects to periods while keeping
          each teacher to one class per period.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generation Options</CardTitle>
          <CardDescription>Select scope for timetable generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Class (optional — scope the preview and save to one class)</Label>
            <Select value={classId || "all"} onValueChange={(v) => setClassId(v === "all" ? "" : v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {(classes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium">What the generator considers:</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Every subject assigned to each class section</li>
              <li>No teacher double-booking across classes</li>
              <li>Round-robin subject distribution across periods</li>
            </ul>
          </div>

          <Button
            className="w-full"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending
              ? <><Spinner size="sm" className="mr-2" /> Generating...</>
              : <><Wand2 className="h-4 w-4 mr-2" /> Generate Timetable</>}
          </Button>
        </CardContent>
      </Card>

      {/* Result preview */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5 text-green-600" /> Generated Preview
            </CardTitle>
            <CardDescription>
              {previewSlotCount} slots for {previewClasses.length} class section(s)
              {classId ? " (filtered by class)" : ""} — review before saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sections matched the selected class.
              </p>
            ) : (
              previewClasses.map((c) => (
                <div key={`${c.class_id}-${c.section_id}`} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium">
                    {c.class_name || c.class_id} {c.section_name ? `- ${c.section_name}` : ""}
                  </span>
                  <span className="text-muted-foreground">{c.slots?.length ?? 0} slots</span>
                </div>
              ))
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || previewSlotCount === 0}
              >
                {saveMutation.isPending
                  ? <><Spinner size="sm" className="mr-2" /> Saving...</>
                  : <><Calendar className="h-4 w-4 mr-2" /> Save to Timetable{classId ? " (selected class only)" : ""}</>}
              </Button>
              <Button variant="outline" asChild>
                <a href="/dashboard/timetable">View Timetable</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info note */}
      <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-500">
              Saving replaces the existing slots for the saved class sections only.
              Classes not included in the save keep their current slots. Review the result in the
              Timetable view before saving.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
