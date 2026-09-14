"use client";

/**
 * Timetable / Generate — A4 wizard (plan 34 row 6, 8.3 "conflict
 * visualization").
 *
 * Research (scheduling/generation flows): run the solver as an async step
 * with visible progress, always review the output before it replaces live
 * data, and surface conflicts inline — the previous version silently ignored
 * `conflicts[]` returned by the solver and saved with one unconfirmed click.
 * Applied: 3 steps — Scope (optional class filter) → Generate & review
 * (async validate runs the solver; conflicts listed per section) → Commit
 * (replace-semantics stated, then useConfirm). Endpoints/payloads unchanged
 * (POST /timetable/generate {periods_per_day:8}, POST /timetable/save).
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { AppGate } from "@/lib/apps";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Wizard, type WizardStep } from "@/components/ui/wizard";
import { SkeletonTable } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DependencyMissingEmptyState } from "@/components/ui/empty-state";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";
import { Wand2, CheckCircle2, AlertTriangle, Calendar, Inbox } from "lucide-react";

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
    <AppGate slug="timetable">
      <GenerateContent />
    </AppGate>
  );
}

function GenerateContent() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/timetable/generate";
  const classId = routeParams.get("class") ?? "";
  const [result, setResult] = useState<GenerateResult | null>(null);

  function setClass(v: string) {
    const next = new URLSearchParams(routeParams.toString());
    if (v) next.set("class", v);
    else next.delete("class");
    navigate(`${pathname}?${next.toString()}`);
  }

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
    },
    onError: () => toast.error(t("Failed to generate timetable", "बनाउन सकिएन")),
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
      toast.success(t(`Saved ${data?.saved_slots ?? 0} slots to the timetable`, `${data?.saved_slots ?? 0} स्लट सुरक्षित`));
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
    },
    onError: () => toast.error(t("Failed to save the timetable", "सुरक्षित हुन सकेन")),
  });

  const previewClasses = result
    ? classId
      ? (result.classes ?? []).filter((c) => c.class_id === classId)
      : (result.classes ?? [])
    : [];
  const previewSlotCount = previewClasses.reduce((n, c) => n + (c.slots?.length ?? 0), 0);
  const conflicts = result?.conflicts ?? [];

  if (isLoading) {
    return (
      <AOSPage>
        <AOSPageHeader icon={<Wand2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} title={t("Timetable Generator", "समय तालिका जेनेरेटर")} />
        <AOSPageBody><SkeletonTable rows={5} /></AOSPageBody>
      </AOSPage>
    );
  }

  if ((classes || []).length === 0) {
    return (
      <AOSPage>
        <AOSPageHeader icon={<Wand2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} title={t("Timetable Generator", "समय तालिका जेनेरेटर")} />
        <AOSPageBody>
          <DependencyMissingEmptyState
            icon={Inbox}
            title={t("Nothing to schedule yet", "ताल्चाउने केही छैन")}
            body={t("The solver needs classes with assigned subjects.", "कक्षा र विषय तोकेपछि जेनेरेटर चल्छ।")}
            prerequisiteName={t("Class subjects", "कक्षा-विषय")}
            setupHref="/dashboard/academics/class-subjects"
            setupLabel={t("Assign subjects to classes →", "विषय तोक्नुहोस् →")}
          />
        </AOSPageBody>
      </AOSPage>
    );
  }

  const steps: WizardStep[] = [
    {
      key: "scope",
      title: t("Scope", "दायरा"),
      description: t(
        "Optionally narrow the run to one class; the solver itself is school-wide.",
        "एक कक्षा मात्र छान्न सकिन्छ; जेनेरेटर स्कूलव्यापी छ।",
      ),
      content: (
        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <Label>{t("Class (optional)", "कक्षा (ऐच्छिक)")}</Label>
            <Select value={classId || "all"} onValueChange={(v) => setClass(v === "all" ? "" : v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={t("All Classes", "सबै कक्षा")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Classes", "सबै कक्षा")}</SelectItem>
                {(classes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-[var(--w11-radius-lg)] p-4 space-y-2 bg-[var(--w11-control-hover)]">
            <h4 className="text-sm font-medium">{t("What the generator considers:", "जेनेरेटरले हेर्ने कुरा:")}</h4>
            <ul className="text-xs text-[color:var(--w11-text-secondary)] space-y-1 list-disc list-inside">
              <li>{t("Every subject assigned to each class section", "कक्षा-विषयको पूर्णता")}</li>
              <li>{t("No teacher double-booking across classes", "शिक्षक दोहोरो बुकिङ हुँदैन")}</li>
              <li>{t("Round-robin subject distribution across periods", "विषय वितरण चक्रीय")}</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      key: "generate",
      title: t("Generate & review", "बनाउने र समीक्षा"),
      validateAsync: async () => {
        if (result && previewSlotCount > 0) return null;
        try {
          const data = await generateMutation.mutateAsync();
          const total = (data?.classes ?? []).reduce((n, c) => n + (c.slots?.length ?? 0), 0);
          if (total === 0) {
            return t(
              "The solver produced no slots — assign subjects to classes first.",
              "स्लट बनेन — पहिले विषय तोक्नुहोस्।",
            );
          }
          return null;
        } catch {
          return t("Generation failed — nothing was saved. Press Next to retry.", "असफल — फेरि प्रयास।");
        }
      },
      content: (
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            {previewSlotCount} {t("slots for", "स्लट —")} {previewClasses.length} {t("class section(s)", "कक्षा सेक्सन")}
            {classId ? t(" (filtered by class)", " (कक्षा अनुसार)") : ""}.
          </p>
          {conflicts.length > 0 && (
            <div className="win11-infobar warning">
              <div>
                <p className="text-[12px] font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> {conflicts.length} {t("clash(es) the solver could not resolve", "अनसुलझिएका द्वन्द्व")}
                </p>
                <ul className="text-[12px] mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                  {conflicts.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              </div>
            </div>
          )}
          {previewClasses.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
              {t("No sections matched the selected class.", "मिल्दा सेक्सन भेटिएन।")}
            </p>
          ) : (
            previewClasses.map((c) => (
              <div
                key={`${c.class_id}-${c.section_id}`}
                className="flex items-center justify-between border border-[var(--w11-border-subtle)] rounded-[var(--w11-radius-lg)] px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {c.class_name || c.class_id}{c.section_name ? ` - ${c.section_name}` : ""}
                </span>
                <span style={{ color: "var(--w11-text-secondary)" }}>{c.slots?.length ?? 0} {t("slots", "स्लट")}</span>
              </div>
            ))
          )}
        </div>
      ),
    },
    {
      key: "commit",
      title: t("Save", "सुरक्षित"),
      description: t(
        "Saving REPLACES the existing slots for the sections in this run; other classes keep theirs.",
        "सेभले यो रनका सेक्सनका पुराना स्लट प्रतिस्थापन गर्छ; अरू कक्षामा हात पर्दैन।",
      ),
      validate: () =>
        previewSlotCount === 0
          ? t("Nothing to save.", "सेभ गर्ने केही छैन।")
          : null,
      content: (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="win11-infobar warning">
            <div>
              <p className="text-[12px] font-medium">{t("Review before saving", "सेभ अघि हेर्नुहोस्")}</p>
              <p className="text-[12px] mt-1">
                {t(
                  "Review the result in the Timetable view before saving. Conflicts (if any) were listed in the previous step.",
                  "सेभ अघि तालिका दृश्यमा हेर्नुहोस्; द्वन्द्व अघिल्लो चरणमा सूचीबद्ध छन्।",
                )}
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard/timetable")}>
            <Calendar className="h-4 w-4 mr-2" /> {t("Open Timetable view (no save yet)", "तालिका हेर्नुहोस्")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Wand2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Timetable Generator", "समय तालिका जेनेरेटर")}
        subtitle={t(
          "Auto-generate a clash-free timetable — one teacher, one class per period",
          "क्लेशरहित समय तालिका — एक शिक्षक एक कक्षा",
        )}
        actions={
          result ? (
            <span className="win11-chip success inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {previewSlotCount} {t("generated", "बनेको")}
            </span>
          ) : undefined
        }
      />
      <AOSPageBody>
        <div className="max-w-2xl">
          <Wizard
            steps={steps}
            finishLabel={t(`Save ${previewSlotCount} slots`, `${previewSlotCount} सेभ`)}
            onFinish={async () => {
              const ok = await confirm({
                title: t("Replace timetable slots?", "स्लट प्रतिस्थापन गर्ने?"),
                body: t(
                  `This writes ${previewSlotCount} generated slots and removes the current slots for these ${previewClasses.length} class section(s). Other classes are untouched.`,
                  `${previewSlotCount} स्लट लेखिन्छ र यी ${previewClasses.length} सेक्सनका पुराना स्लट हट्छन्।`,
                ),
                confirmLabel: t("Save timetable", "सेभ"),
              });
              if (ok) await saveMutation.mutateAsync();
            }}
          />
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
