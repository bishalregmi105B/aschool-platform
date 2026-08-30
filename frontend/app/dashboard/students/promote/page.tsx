"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { TrendingUp, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface StudentPreview {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  roll_number?: number;
  student_id?: string;
}

export default function PromotePage() {
  const queryClient = useQueryClient();
  const [fromClass, setFromClass] = useState("");
  const [toClass, setToClass] = useState("");
  const [previewStudents, setPreviewStudents] = useState<StudentPreview[]>([]);
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
    setPreviewStudents([]);
  }, [fromClass, toClass]);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const students: StudentPreview[] = [];
      let page = 1;

      while (true) {
        const res = await api.get<ApiResponse<StudentPreview[]>>("/students", {
          params: {
            class_id: fromClass,
            page,
            per_page: 100,
          },
        });

        students.push(...(res.data.data || []));

        if (!res.data.meta?.pagination?.has_next) {
          break;
        }

        page += 1;
      }

      return students;
    },
    onSuccess: (students) => {
      setPreviewStudents(students);
      setPreviewReady(true);
      toast.success(`Loaded ${students.length} students for promotion preview.`);
    },
    onError: () => {
      toast.error("Could not load students for preview.");
      setPreviewReady(false);
      setPreviewStudents([]);
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/students/promote", {
        from_class_id: fromClass,
        to_class_id: toClass,
      });
      return res.data?.data || res.data;
    },
    onSuccess: (data: { promoted?: number }) => {
      toast.success(`Promoted ${data?.promoted ?? 0} student(s) to ${toClassName}.`);
      setPreviewReady(false);
      setPreviewStudents([]);
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
          {currentYear ? (
            <p className="text-xs text-muted-foreground">
              Source session: {currentYear.name}
              {nextYear ? ` • Target session: ${nextYear.name}` : " • Target classes are being chosen from the available class list."}
            </p>
          ) : null}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <strong>Note:</strong> Promotion will move all students from the selected class to the next class for the upcoming academic year. This action can be reviewed before finalizing.
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

      {previewReady && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Promotion Preview: {fromClassName} to {toClassName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {previewStudents.length} students will be moved if you finalize promotion.
            </p>
            {previewStudents.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No students were found in the selected source class.
              </p>
            ) : (
              <div className="rounded-lg border divide-y">
                {previewStudents.slice(0, 12).map((student) => {
                  const name =
                    student.full_name ||
                    `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
                    "Student";
                  return (
                    <div key={student.id} className="px-3 py-2 flex items-center justify-between text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">
                        Roll {student.roll_number ?? "-"} {student.student_id ? `• ${student.student_id}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {previewStudents.length > 12 && (
              <p className="text-xs text-muted-foreground">
                Showing first 12 students.
              </p>
            )}
            <Button
              className="w-full max-w-xs"
              disabled={promoteMutation.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Move ${previewStudents.length} student(s) from ${fromClassName} to ${toClassName}? This cannot be undone automatically.`,
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
