"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import {
  findSuggestedPromotionClass,
  getNextAcademicYear,
  type PromotionAcademicYear,
  type PromotionClassOption,
} from "@/lib/promotion-utils";
import { TrendingUp, ArrowRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface PromotePreviewStudent {
  id: string;
  name: string;
  student_code?: string | null;
  roll_no?: number | null;
  status: string;
  will_promote: boolean;
  target_section_name?: string | null;
  target_roll_preview?: number | null;
}

interface RollConflictPreview {
  roll_number: number;
  section_name?: string | null;
  count: number;
  student_ids: string[];
  student_names: string[];
}

interface PromotePreview {
  students: PromotePreviewStudent[];
  target_class_student_count: number;
  conflicts_preview: RollConflictPreview[];
  section_mappings: Record<string, string | null>;
  target_section_count?: number;
}

type RollStrategy = "keep" | "renumber";

export default function PromotePage() {
  const queryClient = useQueryClient();
  const [fromClass, setFromClass] = useState("");
  const [toClass, setToClass] = useState("");
  const [rollStrategy, setRollStrategy] = useState<RollStrategy>("renumber");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PromotePreview | null>(null);
  const [previewReady, setPreviewReady] = useState(false);

  const { data: academicYears = [], isLoading: isLoadingYears } = useQuery({
    queryKey: ["academic-years", "promotion"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PromotionAcademicYear[]>>(
        "/academics/years?per_page=100"
      );
      return res.data.data;
    },
  });

  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes", "promotion"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PromotionClassOption[]>>(
        "/academics/classes?per_page=100"
      );
      return res.data.data;
    },
  });

  const currentYear = academicYears.find((year) => year.is_current) || academicYears[0] || null;
  const nextYear = getNextAcademicYear(academicYears, currentYear?.id || null);

  const currentYearClasses = currentYear
    ? classes.filter((klass) => klass.academic_year_id === currentYear.id)
    : classes;
  const nextYearClasses = nextYear
    ? classes.filter((klass) => klass.academic_year_id === nextYear.id)
    : classes.filter((klass) => klass.academic_year_id !== currentYear?.id);

  const fromClassOptions = currentYearClasses.length > 0 ? currentYearClasses : classes;
  const toClassOptions = nextYearClasses.length > 0 ? nextYearClasses : classes;

  useEffect(() => {
    if (fromClass && !fromClassOptions.some((klass) => klass.id === fromClass)) {
      setFromClass("");
    }
  }, [fromClass, fromClassOptions]);

  useEffect(() => {
    if (toClass && !toClassOptions.some((klass) => klass.id === toClass)) {
      setToClass("");
    }
  }, [toClass, toClassOptions]);

  useEffect(() => {
    const sourceClass = fromClassOptions.find((klass) => klass.id === fromClass);
    if (!sourceClass) {
      return;
    }

    const hasValidTarget = toClassOptions.some((klass) => klass.id === toClass);
    if (hasValidTarget) {
      return;
    }

    const suggestedTargetClass = findSuggestedPromotionClass(sourceClass, toClassOptions);
    if (suggestedTargetClass) {
      setToClass(suggestedTargetClass.id);
    }
  }, [fromClass, fromClassOptions, toClass, toClassOptions]);

  useEffect(() => {
    setPreviewReady(false);
    setPreview(null);
  }, [fromClass, toClass]);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get<ApiResponse<PromotePreview>>("/students/promote/preview", {
        params: {
          from_class_id: fromClass,
          to_class_id: toClass,
        },
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setPreview(data);
      setPreviewReady(true);
      setSelectedIds(
        new Set((data.students || []).filter((s) => s.will_promote).map((s) => s.id)),
      );
      toast.success(`Loaded ${(data.students || []).length} students for promotion preview.`);
    },
    onError: () => {
      toast.error("Could not load promotion preview.");
      setPreviewReady(false);
      setPreview(null);
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/students/promote", {
        from_class_id: fromClass,
        to_class_id: toClass,
        academic_year_id: nextYear?.id || undefined,
        roll_strategy: rollStrategy,
        student_ids: Array.from(selectedIds),
      });
      return res.data?.data || res.data;
    },
    onSuccess: (data: {
      promoted_count?: number;
      promoted?: number;
      skipped?: Array<{ student_id: string; name: string; reason: string }>;
      roll_conflicts?: RollConflictPreview[];
    }) => {
      const promotedCount = data?.promoted_count ?? data?.promoted ?? 0;
      const skippedCount = data?.skipped?.length ?? 0;
      toast.success(
        `Promoted ${promotedCount} student(s) to ${toClassName}` +
          (skippedCount ? ` (${skippedCount} skipped)` : "") +
          ".",
      );
      if (rollStrategy === "keep" && data?.roll_conflicts?.length) {
        toast.warning(
          `${data.roll_conflicts.length} duplicate roll number(s) remain in the target class — reseat via Batch Roll Numbers.`,
        );
      }
      setPreviewReady(false);
      setPreview(null);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || "Failed to promote students.");
    },
  });

  if (isLoadingYears || isLoadingClasses) return <PageLoader />;

  const classById = new Map(classes.map((klass) => [klass.id, klass]));
  const fromClassName = classById.get(fromClass)?.name || "Selected Class";
  const toClassName = classById.get(toClass)?.name || "Next Class";

  const students = preview?.students || [];
  const eligibleStudents = students.filter((s) => s.will_promote);
  const conflicts = preview?.conflicts_preview || [];
  const sectionMappings = Object.entries(preview?.section_mappings || {});

  const toggleStudent = (id: string, checked: boolean | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked === true) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleAll = (checked: boolean | string) => {
    if (checked) {
      setSelectedIds(new Set(eligibleStudents.map((s) => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const allSelected = eligibleStudents.length > 0 && selectedIds.size === eligibleStudents.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const canPromote = Boolean(fromClass && toClass && fromClass !== toClass && selectedIds.size > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6" /> Promote Students
        </h1>
        <p className="text-muted-foreground">Promote students from one class to the next academic year</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Promotion Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">From Class</label>
              <Select value={fromClass} onValueChange={setFromClass}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      currentYear ? `Select ${currentYear.name} class` : "Select current class"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {fromClassOptions.map((klass) => (
                    <SelectItem key={klass.id} value={klass.id}>
                      {klass.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground mt-6" />
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">To Class</label>
              <Select value={toClass} onValueChange={setToClass}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      nextYear ? `Select ${nextYear.name} class` : "Select next class"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {toClassOptions.map((klass) => (
                    <SelectItem key={klass.id} value={klass.id}>
                      {klass.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Roll Number Strategy</label>
              <Select value={rollStrategy} onValueChange={(v) => setRollStrategy(v as RollStrategy)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose roll strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="renumber">Renumber 1..N (per section)</SelectItem>
                  <SelectItem value="keep">Keep existing rolls</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {rollStrategy === "renumber"
                  ? "Rolls in the target class are renumbered 1..N per section (old roll order, then name)."
                  : "Existing roll numbers are kept; duplicates are reported after the move."}
              </p>
            </div>
          </div>
          {currentYear ? (
            <p className="text-xs text-muted-foreground">
              Source session: {currentYear.name}
              {nextYear ? ` • Target session: ${nextYear.name}` : " • Target classes are being chosen from the available class list."}
            </p>
          ) : null}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <strong>Note:</strong> Only active, transferred-in and on-leave students are moved. Left (transferred-out / dropped-out / graduated) students stay behind. This action can be reviewed before finalizing.
          </div>
          <Button
            disabled={!fromClass || !toClass || fromClass === toClass || previewMutation.isPending}
            className="w-full max-w-xs"
            onClick={() => {
              previewMutation.mutate();
            }}
          >
            {previewMutation.isPending ? "Loading Preview..." : "Preview Promotion"}
          </Button>
          {fromClass && toClass && fromClass === toClass ? (
            <p className="text-xs text-amber-700">
              Select a different target class to preview promotion.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {previewReady && preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Promotion Preview: {fromClassName} to {toClassName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-md bg-muted px-2 py-1">
                {toClassName} currently has <strong>{preview.target_class_student_count}</strong> student(s)
              </span>
              <span className="rounded-md bg-muted px-2 py-1">
                <strong>{selectedIds.size}</strong> of {eligibleStudents.length} eligible selected
              </span>
              <span className="rounded-md bg-muted px-2 py-1">
                {students.length - eligibleStudents.length} left student(s) will be skipped
              </span>
            </div>

            {sectionMappings.length > 0 && (
              <div className="text-sm">
                <p className="font-medium mb-1">Section mapping (by name)</p>
                <div className="flex flex-wrap gap-2">
                  {sectionMappings.map(([oldName, newName]) => (
                    <span key={oldName} className="rounded-md border px-2 py-1 text-xs">
                      {oldName} → {newName || "(no section)"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {conflicts.length} roll number conflict(s) in {toClassName}
                  </p>
                  <ul className="mt-1 list-disc list-inside text-xs">
                    {conflicts.map((c) => (
                      <li key={`${c.section_name}-${c.roll_number}`}>
                        Roll {c.roll_number} shared by {c.count} students
                        {c.section_name ? ` (Section ${c.section_name})` : ""}: {c.student_names.join(", ")}
                        {rollStrategy === "renumber" ? " — resolved by renumbering." : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {students.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No students were found in the selected source class.
              </p>
            ) : (
              <div className="rounded-lg border divide-y max-h-96 overflow-y-auto">
                <div className="px-3 py-2 flex items-center gap-3 bg-muted/40 text-sm font-medium">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(v)}
                    aria-label="Select all eligible students"
                  />
                  <span>Select all eligible</span>
                </div>
                {students.map((student) => (
                  <div key={student.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={selectedIds.has(student.id)}
                      onCheckedChange={(v) => toggleStudent(student.id, v)}
                      disabled={!student.will_promote}
                      aria-label={`Select ${student.name}`}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${student.will_promote ? "" : "line-through text-muted-foreground"}`}>
                        {student.name || "Student"}
                      </span>
                      {student.student_code ? (
                        <span className="text-muted-foreground ml-2 text-xs">{student.student_code}</span>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">
                      Roll {student.roll_no ?? "-"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${
                        student.will_promote
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {student.status}
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap w-40 text-right">
                      {student.will_promote
                        ? `→ ${student.target_section_name || "(no section)"} · Roll ${student.target_roll_preview ?? "-"}`
                        : "stays behind"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Confirm summary</p>
              <p className="text-muted-foreground">
                Move <strong>{selectedIds.size}</strong> student(s) from {fromClassName} to {toClassName}
                {nextYear ? ` for ${nextYear.name}` : ""} · Rolls:{" "}
                <strong>{rollStrategy === "renumber" ? "renumber 1..N per section" : "keep existing"}</strong>
                {rollStrategy === "keep" && conflicts.length > 0
                  ? ` · ${conflicts.length} conflict(s) will remain`
                  : ""}
                .
              </p>
            </div>

            <Button
              className="w-full max-w-xs"
              disabled={!canPromote || promoteMutation.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Move ${selectedIds.size} student(s) from ${fromClassName} to ${toClassName}? This cannot be undone automatically.`,
                  )
                )
                  promoteMutation.mutate();
              }}
            >
              {promoteMutation.isPending ? (
                "Promoting..."
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" /> Finalize Promotion
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
