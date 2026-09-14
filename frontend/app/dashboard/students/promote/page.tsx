"use client";

/**
 * Students / Promote — A4 wizard (plan Part 34 row 1: "wizard with preview
 * diff", Part 32-A4: steps ≤5, per-step validation, review + commit with
 * per-item conflicts).
 *
 * Research (wizard UX): each step one decision, back allowed, finish
 * disabled until valid, final step is a review that names the consequence;
 * failures must offer retry-in-place, never restart. Applied: 3 steps —
 * Choose (from/to/strategy) → Review (preview diff with per-student target
 * + conflict list) → Confirm (summary, then finalize behind useConfirm).
 * Endpoints and payloads are unchanged from the previous single-page form.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wizard, type WizardStep } from "@/components/ui/wizard";
import {
  AOSPage, AOSPageBody, AOSPageHeader,
  DataPanel, StatusChip,
} from "@/components/aos/kit/page-kit";
import { FormSection } from "@/components/ui/form";
import { DependencyMissingEmptyState, EmptyState } from "@/components/ui/empty-state";
import {
  findSuggestedPromotionClass,
  getNextAcademicYear,
  type PromotionAcademicYear,
  type PromotionClassOption,
} from "@/lib/promotion-utils";
import { TrendingUp, ArrowRight, AlertTriangle, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [fromClass, setFromClass] = useState("");
  const [toClass, setToClass] = useState("");
  const [rollStrategy, setRollStrategy] = useState<RollStrategy>("renumber");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PromotePreview | null>(null);

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

  // Changing the pair invalidates the preview (it was fetched for the old pair).
  useEffect(() => {
    setPreview(null);
    setSelectedIds(new Set());
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
      setSelectedIds(
        new Set((data.students || []).filter((s) => s.will_promote).map((s) => s.id)),
      );
    },
    onError: () => {
      toast.error(t("Could not load promotion preview.", "प्रमोशन प्रिभ्यु लोड हुन सकेन।"));
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
        t(
          `Promoted ${promotedCount} student(s) to ${toClassName}` +
            (skippedCount ? ` (${skippedCount} skipped)` : "") +
            ".",
          `${promotedCount} विद्यार्थी ${toClassName} मा प्रमोट भए` +
            (skippedCount ? ` (${skippedCount} छोडिए)` : "") + "।"
        ),
      );
      if (rollStrategy === "keep" && data?.roll_conflicts?.length) {
        toast.warning(
          t(
            `${data.roll_conflicts.length} duplicate roll number(s) remain in the target class — reseat via Batch Roll Numbers.`,
            `${data.roll_conflicts.length} डुप्लिकेट रोल नम्बर — रोल नम्बर पृष्ठबाट मिलाउनुहोस्।`,
          ),
        );
      }
      setPreview(null);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || t("Failed to promote students.", "प्रमोशन असफल।"));
    },
  });

  const classById = new Map(classes.map((klass) => [klass.id, klass]));
  const fromClassName = classById.get(fromClass)?.name || t("Selected Class", "कक्षा");
  const toClassName = classById.get(toClass)?.name || t("Next Class", "अर्को कक्षा");

  const students = preview?.students || [];
  const eligibleStudents = students.filter((s) => s.will_promote);
  const conflicts = preview?.conflicts_preview || [];
  const sectionMappings = Object.entries(preview?.section_mappings || {});

  const toggleStudent = (id: string, checked: boolean | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked === true) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = eligibleStudents.length > 0 && selectedIds.size === eligibleStudents.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const steps: WizardStep[] = [
    {
      key: "choose",
      title: t("Choose classes", "कक्षा छान्नुहोस्"),
      description: t(
        "Pick the source and target class — the next class is suggested automatically.",
        "स्रोत र लक्ष्य कक्षा छान्नुहोस् — अर्को कक्षा स्वतः सुझाव हुन्छ।",
      ),
      validate: () => {
        if (!fromClass) return t("Select the source class.", "स्रोत कक्षा छान्नुहोस्।");
        if (!toClass) return t("Select the target class.", "लक्ष्य कक्षा छान्नुहोस्।");
        if (fromClass === toClass)
          return t("Source and target class must differ.", "स्रोत र लक्ष्य कक्षा फरक हुनुपर्छ।");
        return null;
      },
      content: (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">{t("From Class", "बाट (स्रोत)")}</label>
              <Select value={fromClass} onValueChange={setFromClass}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      currentYear ? `Select ${currentYear.name} class` : t("Select current class", "वर्तमान कक्षा छान्नुहोस्")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {fromClassOptions.map((klass) => (
                    <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground mt-6" />
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">{t("To Class", "सम्म (लक्ष्य)")}</label>
              <Select value={toClass} onValueChange={setToClass}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      nextYear ? `Select ${nextYear.name} class` : t("Select next class", "अर्को कक्षा छान्नुहोस्")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {toClassOptions.map((klass) => (
                    <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="max-w-sm space-y-1.5">
            <label className="text-sm font-medium">{t("Roll Number Strategy", "रोल नम्बर नीति")}</label>
            <Select value={rollStrategy} onValueChange={(v) => setRollStrategy(v as RollStrategy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="renumber">{t("Renumber 1..N (per section)", "१..N पुनःनम्बर (सेक्सन अनुसार)")}</SelectItem>
                <SelectItem value="keep">{t("Keep existing rolls", "अविकसित राख्नुहोस्")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {rollStrategy === "renumber"
                ? t("Rolls in the target class are renumbered 1..N per section (old roll order, then name).", "लक्ष्य कक्षामा रोल १..N सेक्सन अनुसार बन्दछ।")
                : t("Existing roll numbers are kept; duplicates are reported after the move.", "वर्तमान रोल रहन्छ; डुप्लिकेट पछि रिपोर्ट हुन्छ।")}
            </p>
          </div>
          {currentYear ? (
            <p className="text-xs text-muted-foreground">
              {t("Source session", "स्रोत्र सत्र")}: {currentYear.name}
              {nextYear ? ` • ${t("Target session", "लक्ष्य सत्र")}: ${nextYear.name}` : ""}
            </p>
          ) : null}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
            {t(
              "Only active, transferred-in and on-leave students are moved. Left students stay behind.",
              "सक्रिय, भित्र-स्थानान्तरित र बिदामा रहेका मात्र सर्छन्; बाहिरिएका उही कक्षामा बस्छन्।",
            )}
          </div>
        </div>
      ),
    },
    {
      key: "review",
      title: t("Review preview", "प्रिभ्यु हेर्नुहोस्"),
      description: t(
        "Who moves, who stays, which sections they land in, and any roll conflicts.",
        "कोही सर्छ, कोही बस्छ, कुन सेक्सनमा पर्छ, रोल द्वन्द्व — सबै यहाँ।",
      ),
      validate: () => {
        if (!preview) {
          return previewMutation.isPending
            ? t("Building the preview — one moment.", "प्रिभ्यु तयार हुँदैछ — अलि पर्खनुहोस्।")
            : t("Preview failed to load — retry in this step before continuing.", "प्रिभ्यु लोड भएन — यही चरणमा फेरि प्रयास।");
        }
        if (selectedIds.size === 0)
          return t("Select at least one student to promote.", "कम्तीमा एक विद्यार्थी चयन गर्नुहोस्।");
        return null;
      },
      content: (
        <ReviewStep
          preview={preview}
          loading={previewMutation.isPending}
          error={previewMutation.isError}
          retry={() => previewMutation.mutate()}
          students={students}
          eligible={eligibleStudents}
          selectedIds={selectedIds}
          allSelected={allSelected}
          someSelected={someSelected}
          toggleAll={(v) =>
            setSelectedIds(v ? new Set(eligibleStudents.map((s) => s.id)) : new Set())
          }
          toggleStudent={toggleStudent}
          sectionMappings={sectionMappings}
          conflicts={conflicts}
          toClassName={toClassName}
          rollStrategy={rollStrategy}
          t={t}
        />
      ),
    },
    {
      key: "confirm",
      title: t("Confirm & promote", "पुष्टि र प्रमोशन"),
      description: t(
        "One last look at the exact move. This cannot be undone automatically.",
        "अन्तिम पुष्टि — यो स्वतः फिर्ता हुँदैन।",
      ),
      content: (
        <div className="p-4 sm:p-5 space-y-4">
          <FormSection
            title={t("Summary", "सारांश")}
            icon={TrendingUp}
          >
            <p className="text-sm">
              {t(
                `Move ${selectedIds.size} student(s) from ${fromClassName} to ${toClassName}`,
                `${selectedIds.size} विद्यार्थी ${fromClassName} बाट ${toClassName} सार्ने`,
              )}
              {nextYear ? ` — ${t("session", "सत्र")} ${nextYear.name}` : ""} · {t("Rolls", "रोल")}:{" "}
              <strong>
                {rollStrategy === "renumber"
                  ? t("renumber 1..N per section", "सेक्सन अनुसार १..N")
                  : t("keep existing", "वर्तमान राख्ने")}
              </strong>
              {rollStrategy === "keep" && conflicts.length > 0
                ? ` · ${conflicts.length} ${t("conflict(s) will remain", "द्वन्द्व रहनेछ")}`
                : ""}
              .
            </p>
          </FormSection>
          {conflicts.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {conflicts.length} {t("roll number conflict(s) in the target class — see step 2 for details.", "रोल द्वन्द्व — विवरण चरण २ मा।")}
              </span>
            </div>
          )}
        </div>
      ),
    },
  ];

  const handleFinish = async () => {
    const ok = await confirm({
      title: t("Finalize Student Promotion", "प्रमोशन अन्तिम टुङ्गाउने"),
      body: t(
        `Move ${selectedIds.size} student(s) from ${fromClassName} to ${toClassName}? This cannot be undone automatically.`,
        `${selectedIds.size} विद्यार्थी ${fromClassName} बाट ${toClassName} सार्ने? यो स्वतः फिर्ता हुँदैन।`,
      ),
      confirmLabel: t("Promote Students", "विद्यार्थी प्रमोट"),
    });
    if (ok) {
      promoteMutation.mutate();
    }
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Promote Students", "विद्यार्थी प्रमोशन")}
        subtitle={t(
          "Move a class into the next academic year with a preview diff before committing.",
          "प्रिभ्यु हेरेर मात्र अर्को शैक्षिक वर्षमा सार्नुहोस्।",
        )}
      />
      <AOSPageBody>
        <div className="max-w-4xl">
          {isLoadingYears || isLoadingClasses ? (
            <EmptyState
              title={t("Loading classes…", "कक्षा लोड हुँदै…")}
              body={t("The promotion wizard opens once the class list is ready.", "कक्षा सूची आउँदा विजार्ड खुल्छ।")}
            />
          ) : classes.length === 0 ? (
            // Dependency-missing: promotion needs classes in two sessions.
            <DependencyMissingEmptyState
              icon={Inbox}
              title={t("No classes to promote between", "प्रमोट गर्ने कक्षा छैन")}
              prerequisiteName={t("Classes in Academics", "कक्षाहरू")}
              setupHref="/dashboard/academics"
              setupLabel={t("Create classes first →", "पहिले कक्षा सिर्जना गर्नुहोस् →")}
              body={t(
                "Promotion moves students between classes of consecutive academic years — none exist yet.",
                "प्रमोशनका लागि दुई सत्रका कक्षा चाहिन्छ — अहिले कुनै छैन।",
              )}
            />
          ) : (
            <Wizard steps={steps} onFinish={() => void handleFinish()} finishLabel={t("Finalize Promotion", "प्रमोशन अन्तिम")} />
          )}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}

function ReviewStep(props: {
  preview: PromotePreview | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
  students: PromotePreviewStudent[];
  eligible: PromotePreviewStudent[];
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  toggleAll: (v: boolean) => void;
  toggleStudent: (id: string, checked: boolean | string) => void;
  sectionMappings: [string, string | null][];
  conflicts: RollConflictPreview[];
  toClassName: string;
  rollStrategy: RollStrategy;
  t: (en: string, ne: string) => string;
}) {
  const { t } = props;

  // Step 2 mounts only when active → load the preview once.
  useEffect(() => {
    if (!props.preview && !props.loading && !props.error) props.retry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (props.loading && !props.preview) {
    return (
      <div className="p-6 text-center text-[13px]" style={{ color: "var(--w11-text-secondary)" }}>
        <div className="win11-spinner mx-auto mb-3" />
        {t("Building the promotion preview…", "प्रिभ्यु तयार हुँदै…")}
      </div>
    );
  }
  if (!props.preview) {
    return (
      <EmptyState
        size="sm"
        title={t("Preview failed to load", "प्रिभ्यु लोड भएन")}
        body={t("Nothing was changed — retry when ready.", "केही परिवर्तन भएन — फेरि प्रयास।")}
        action={{ label: t("Retry", "फेरि"), onClick: props.retry }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-md bg-muted px-2 py-1">
          {t("Selected", "चयनित")} <strong>{props.selectedIds.size}</strong> / {t("eligible", "योग्य")} {props.eligible.length}
        </span>
        <span className="rounded-md bg-muted px-2 py-1">
          {t("stays behind", "पछाडि")} {props.students.length - props.eligible.length}
        </span>
        <span className="rounded-md bg-muted px-2 py-1">
          {props.toClassName}: <strong>{props.preview.target_class_student_count}</strong> {t("students already", "विद्यार्थी")}
        </span>
      </div>

      {props.sectionMappings.length > 0 && (
        <div className="text-sm">
          <p className="font-medium mb-1">{t("Section mapping (by name)", "सेक्सन म्यापिङ (नाम अनुसार)")}</p>
          <div className="flex flex-wrap gap-2">
            {props.sectionMappings.map(([oldName, newName]) => (
              <span key={oldName} className="rounded-md border px-2 py-1 text-xs">
                {oldName} → {newName || t("(no section)", "(सेक्सन छैन)")}
              </span>
            ))}
          </div>
        </div>
      )}

      {props.conflicts.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-800 flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              {props.conflicts.length} {t("roll number conflict(s)", "रोल द्वन्द्व")}
            </p>
            <ul className="mt-1 list-disc list-inside text-xs">
              {props.conflicts.map((c) => (
                <li key={`${c.section_name}-${c.roll_number}`}>
                  {t("Roll", "रोल")} {c.roll_number}: {c.count} — {c.student_names.join(", ")}
                  {props.rollStrategy === "renumber" ? ` — ${t("resolved by renumbering.", "पुनःनम्बरले समाधान।")}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {props.students.length === 0 ? (
        <EmptyState
          size="sm"
          title={t("No students in this source class", "यो स्रोत कक्षामा विद्यार्थी छैन")}
          body={t("Go back and pick another class, or enroll students first.", "फर्केर अर्को कक्षा छान्नुहोस्।")}
        />
      ) : (
        <DataPanel bodyClassName="p-0">
          <div className="max-h-96 overflow-y-auto divide-y">
            <div className="px-3 py-2 flex items-center gap-3 bg-muted/40 text-sm font-medium">
              <Checkbox
                checked={props.allSelected ? true : props.someSelected ? "indeterminate" : false}
                onCheckedChange={(v) => props.toggleAll(v === true)}
                aria-label={t("Select all eligible students", "सबै योग्य चयन")}
              />
              <span>{t("Select all eligible", "सबै योग्य चयन गर्नुहोस्")}</span>
            </div>
            {props.students.map((student) => (
              <div key={student.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                <Checkbox
                  checked={props.selectedIds.has(student.id)}
                  onCheckedChange={(v) => props.toggleStudent(student.id, v)}
                  disabled={!student.will_promote}
                  aria-label={`Select ${student.name}`}
                />
                <div className="flex-1 min-w-0">
                  <span className={student.will_promote ? "font-medium" : "line-through text-muted-foreground"}>
                    {student.name || t("Student", "विद्यार्थी")}
                  </span>
                  {student.student_code ? (
                    <span className="text-muted-foreground ml-2 text-xs">{student.student_code}</span>
                  ) : null}
                </div>
                <span className="text-muted-foreground whitespace-nowrap">
                  {t("Roll", "रोल")} {student.roll_no ?? "-"}
                </span>
                <StatusChip status={student.status} />
                <span className="text-muted-foreground whitespace-nowrap w-44 text-right">
                  {student.will_promote
                    ? `→ ${student.target_section_name || t("(no section)", "(सेक्सन छैन)")} · ${t("Roll", "रोल")} ${student.target_roll_preview ?? "-"}`
                    : t("stays behind", "पछाडि बस्छ")}
                </span>
              </div>
            ))}
          </div>
        </DataPanel>
      )}
    </div>
  );
}
