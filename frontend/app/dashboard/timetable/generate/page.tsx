"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Spinner, PageLoader } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FormSection,
} from "@/components/aos/kit/page-kit";
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
    <AOSPage>
      <AOSPageHeader
        icon={<Wand2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Timetable Generator"
        subtitle="Auto-generate a clash-free timetable — assigns subjects to periods while keeping each teacher to one class per period."
      />
      <AOSPageBody>
        <div className="max-w-2xl space-y-4">
          <DataPanel title="Generation Options">
            <div className="space-y-4">
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

              <div className="rounded-[var(--w11-radius-lg)] p-4 space-y-2 bg-[var(--w11-control-hover)]">
                <h4 className="text-sm font-medium">What the generator considers:</h4>
                <ul className="text-xs text-[color:var(--w11-text-secondary)] space-y-1 list-disc list-inside">
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
            </div>
          </DataPanel>

          {/* Result preview */}
          {result && (
            <DataPanel
              title={
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" style={{ color: "#107c10" }} /> Generated Preview
                </span>
              }
            >
              <div className="space-y-3">
                <p className="text-xs text-[color:var(--w11-text-secondary)]">
                  {previewSlotCount} slots for {previewClasses.length} class section(s)
                  {classId ? " (filtered by class)" : ""} — review before saving.
                </p>
                {previewClasses.length === 0 ? (
                  <p className="text-sm text-[color:var(--w11-text-secondary)]">
                    No sections matched the selected class.
                  </p>
                ) : (
                  previewClasses.map((c) => (
                    <div
                      key={`${c.class_id}-${c.section_id}`}
                      className="flex items-center justify-between border border-[var(--w11-border-subtle)] rounded-[var(--w11-radius-lg)] px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        {c.class_name || c.class_id} {c.section_name ? `- ${c.section_name}` : ""}
                      </span>
                      <span className="text-[color:var(--w11-text-secondary)]">{c.slots?.length ?? 0} slots</span>
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
              </div>
            </DataPanel>
          )}

          {/* Info note */}
          <div
            className="win11-card flex gap-3 p-4"
            style={{ borderColor: "rgba(216,59,1,0.3)", background: "rgba(216,59,1,0.06)" }}
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#d83b01" }} />
            <p className="text-xs" style={{ color: "#d83b01" }}>
              Saving replaces the existing slots for the saved class sections only.
              Classes not included in the save keep their current slots. Review the result in the
              Timetable view before saving.
            </p>
          </div>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
