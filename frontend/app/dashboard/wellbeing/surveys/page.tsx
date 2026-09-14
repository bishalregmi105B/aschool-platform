"use client";

/**
 * Wellbeing Surveys (archetype A1 list + A4 builder-as-wizard — plan 34 #43).
 *
 * Research notes: (1) wellbeing survey builders work best as short wizards
 * (basics → questions → audience) so a staff member never faces a wall of
 * inputs; (2) anonymity must be a first-class, plainly-labelled choice, not
 * a buried checkbox, because it governs student disclosure.
 *
 * Changes: the 2-field "New Survey" dialog created EMPTY surveys (questions:
 * []) and was a dead end — replaced with a 3-step Wizard that actually posts
 * a question list; anonymity switch on step 1 with its effect stated;
 * class-scoped targeting via /academics/classes; responses column shows real
 * question count.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Wizard, type WizardStep } from "@/components/ui/wizard";
import { MultiSelect } from "@/components/ui/multi-select";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Plus, Trash2, ClipboardList, Eye, ShieldQuestion } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

interface SurveyQuestion {
  id: number;
  text: string;
  type: "rating" | "choice" | "open";
  options?: string[];
}

export default function SurveysPage() {
  return <AppGate slug="wellbeing"><SurveysContent /></AppGate>;
}

function SurveysContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["wellbeing-surveys"],
    queryFn: async () => (await api.get("/wellbeing/surveys")).data?.data || [],
    retry: 1,
  });

  const surveys: any[] = Array.isArray(data) ? data : [];

  if (isLoading) return <AOSModuleLoadingState label={t("Loading surveys…", "सर्वेक्षण लोड हुँदैछ…")} />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<ClipboardList className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Wellbeing Surveys"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load surveys. Please try again.", "लोड गर्न असफल। फेरि प्रयास गर्नुहोस्।")}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const SURVEY_COLUMNS: Column<any>[] = [
    {
      key: "title",
      label: t("Survey", "सर्वेक्षण"),
      sortable: true,
      value: (sv) => sv.title ?? "",
      render: (sv) => (
        <div>
          <p className="font-medium">{sv.title}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--w11-text-tertiary)" }}>
            {sv.questions?.length ?? 0} {t("questions", "प्रश्नहरू")}
          </p>
        </div>
      ),
    },
    {
      key: "target",
      label: t("Audience", "श्रोता"),
      value: (sv) => (sv.target_class_ids?.length ? "classes" : "all"),
      render: (sv) => (
        <StatusChip
          status={sv.target_class_ids?.length ? "partial" : "active"}
          label={sv.target_class_ids?.length ? `${sv.target_class_ids.length} ${t("classes", "कक्षा")}` : t("All students", "सबै विद्यार्थी")}
        />
      ),
    },
    {
      key: "is_anonymous",
      label: t("Responses", "प्रतिक्रिया"),
      value: (sv) => (sv.is_anonymous ? "anonymous" : "named"),
      render: (sv) => (
        <span className={`inline-flex items-center gap-1 ${sv.is_anonymous ? "" : ""}`}>
          {sv.is_anonymous
            ? <StatusChip status="hold" label={t("Anonymous", "गुमनाम")} />
            : <StatusChip status="active" label={t("Named", "नामसहित")} />}
        </span>
      ),
    },
    {
      key: "is_active",
      label: t("Status", "अवस्था"),
      value: (sv) => (sv.is_active === false ? "inactive" : "active"),
      render: (sv) => <StatusChip status={sv.is_active === false ? "inactive" : "active"} />,
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ClipboardList className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Wellbeing Surveys"
        subtitle={t(
          `${surveys.length} survey${surveys.length === 1 ? "" : "s"} · create and manage student wellbeing check-ins`,
          `${surveys.length} सर्वेक्षण`
        )}
        actions={
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t("New Survey", "नयाँ सर्वेक्षण")}
          </Button>
        }
      />
      <AOSPageBody>
        <div className="win11-infobar info mb-4 flex items-start gap-2" role="note">
          <ShieldQuestion className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-[13px]">
            {t(
              "Anonymous surveys collect honest answers — student names are never attached to responses. Named surveys should only be used for follow-up care.",
              "गुमनाम सर्वेक्षणले इमानदार उत्तर सङ्कलन गर्छ।"
            )}
          </p>
        </div>

        <DataPanel bodyClassName="p-0 pt-0">
          <DataTable
            columns={SURVEY_COLUMNS}
            rows={surveys}
            rowKey={(sv: any) => sv.id}
            searchable
            searchPlaceholder={t("Search surveys…", "सर्वेक्षण खोज्नुहोस्…")}
            exportFileName="wellbeing-surveys"
            empty={{
              icon: ClipboardList,
              title: t("No surveys created yet", "अझै कुनै सर्वेक्षण छैन"),
              body: t("Create a survey to check in on student wellbeing.", "विद्यार्थी wellbeing का लागि सर्वेक्षण बनाउनुहोस्।"),
              action: { label: t("New Survey", "नयाँ सर्वेक्षण"), onClick: () => setShowWizard(true) },
            }}
          />
        </DataPanel>
      </AOSPageBody>

      {showWizard && <SurveyWizard onClose={() => setShowWizard(false)} />}
    </AOSPage>
  );
}

/** A4 wizard — Basics → Questions → Audience. Posts the real questions array. */
function SurveyWizard({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    { id: 1, text: "How safe do you feel at school?", type: "rating" },
  ]);
  const [targetClassIds, setTargetClassIds] = useState<string[]>([]);
  const [nextId, setNextId] = useState(2);

  const { data: classes } = useQuery({
    queryKey: ["academics-classes-simple"],
    queryFn: async () => (await api.get("/academics/classes?per_page=100")).data?.data || [],
  });

  const create = useMutation({
    mutationFn: async () =>
      (await api.post("/wellbeing/surveys", {
        title,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          ...(q.type === "choice" ? { options: (q.options || []).filter(Boolean) } : {}),
        })),
        target_class_ids: targetClassIds,
        is_anonymous: isAnonymous,
      })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellbeing-surveys"] });
      toast.success(t("Survey created", "सर्वेक्षण बन्यो"));
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Failed to create survey", "सर्वेक्षण बनाउन असफल")),
  });

  const steps: WizardStep[] = [
    {
      key: "basics",
      title: t("Basics", "आधार"),
      description: t("Name the survey and choose how responses are handled.", "सर्वेक्षणको नाम र प्रतिक्रिया ढाँचा तोक्नुहोस्।"),
      validate: () => (!title.trim() ? t("A title is required", "शीर्षक आवश्यक छ") : null),
      content: (
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label>{t("Title", "शीर्षक")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("Mid-term Wellbeing Check", "अवधि-मध्य wellbeing जाँच")}
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--w11-border-default)] px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">{t("Anonymous responses", "गुमनाम प्रतिक्रिया")}</p>
              <p className="text-[11px]" style={{ color: "var(--w11-text-tertiary)" }}>
                {t("Student names will never be attached to answers", "विद्यार्थीको नाम उत्तरसँग जोडिँदैन")}
              </p>
            </div>
            <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} aria-label={t("Anonymous", "गुमनाम")} />
          </div>
        </div>
      ),
    },
    {
      key: "questions",
      title: t("Questions", "प्रश्नहरू"),
      description: t("Add up to 12 short questions. Rating = 1–5 scale, Open = free text.", "१२ सम्म प्रश्न थप्नुहोस्।"),
      validate: () =>
        questions.length === 0
          ? t("Add at least one question", "कम्तीमा एक प्रश्न थप्नुहोस्")
          : questions.some((q) => !q.text.trim())
            ? t("Every question needs text", "सबै प्रश्नमा पाठ चाहिन्छ")
            : null,
      content: (
        <div className="space-y-3 p-4">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-[var(--w11-border-default)] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold w-5 shrink-0" style={{ color: "var(--w11-text-tertiary)" }}>
                  {i + 1}
                </span>
                <Input
                  value={q.text}
                  onChange={(e) => setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, text: e.target.value } : x)))}
                  placeholder={t("Question text…", "प्रश्न…")}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("Remove question", "प्रश्न हटाउनुहोस्")}
                  onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
                >
                  <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
                </Button>
              </div>
              <div className="flex items-center gap-2 pl-7">
                <AdvancedSelect
                  className="w-36"
                  value={q.type}
                  onChange={(v) =>
                    setQuestions((qs) =>
                      qs.map((x) =>
                        x.id === q.id
                          ? { ...x, type: v as SurveyQuestion["type"], ...(v === "choice" && !x.options ? { options: ["", ""] } : {}) }
                          : x
                      )
                    )
                  }
                  options={[
                    { value: "rating", label: t("Rating 1–5", "रेटिङ १–५") },
                    { value: "choice", label: t("Choices", "विकल्प") },
                    { value: "open", label: t("Open text", "खुला उत्तर") },
                  ]}
                />
                {q.type === "choice" && (
                  <div className="flex-1 flex flex-wrap gap-2">
                    {(q.options || []).map((opt, oi) => (
                      <Input
                        key={oi}
                        className="h-8 w-28 text-[12px]"
                        value={opt}
                        placeholder={t(`Option ${oi + 1}`, `विकल्प ${oi + 1}`)}
                        onChange={(e) =>
                          setQuestions((qs) =>
                            qs.map((x) =>
                              x.id === q.id
                                ? { ...x, options: (x.options || []).map((o, j) => (j === oi ? e.target.value : o)) }
                                : x
                            )
                          )
                        }
                      />
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setQuestions((qs) =>
                          qs.map((x) => (x.id === q.id ? { ...x, options: [...(x.options || []), ""] } : x))
                        )
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {questions.length < 12 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuestions((qs) => [...qs, { id: nextId, text: "", type: "rating" }]);
                setNextId((n) => n + 1);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> {t("Add question", "प्रश्न थप्नुहोस्")}
            </Button>
          )}
        </div>
      ),
    },
    {
      key: "audience",
      title: t("Audience", "श्रोता"),
      description: t("Leave empty to send to every student.", "सबै विद्यार्थीका लागि खाली छोड्नुहोस्।"),
      content: (
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label>{t("Target classes", "लक्षित कक्षाहरू")}</Label>
            <MultiSelect
              value={targetClassIds}
              onChange={setTargetClassIds}
              options={((classes || []) as any[]).map((c) => ({ value: String(c.id), label: c.name, ne: c.name_nepali }))}
              placeholder={t("All students (no class filter)", "सबै विद्यार्थी")}
            />
          </div>
          <div className="win11-infobar info flex items-start gap-2" role="note">
            <Eye className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-[13px]">
              {t(
                `Review: “${title || "—"}”, ${questions.length} question${questions.length === 1 ? "" : "s"}, ${
                  isAnonymous ? "anonymous" : "named"
                } responses${targetClassIds.length ? `, ${targetClassIds.length} classes` : ", all students"}.`,
                "समीक्षा गर्नुहोस्।"
              )}
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="win11-card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5"
        style={{ margin: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t("Survey builder", "सर्वेक्षण निर्माता")}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--w11-text-primary)" }}>
            {t("New Wellbeing Survey", "नयाँ wellbeing सर्वेक्षण")}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>{t("Close", "बन्द")}</Button>
        </div>
        <Wizard
          steps={steps}
          finishLabel={t("Create Survey", "सर्वेक्षण बनाउनुहोस्")}
          onCancel={onClose}
          onFinish={() => create.mutate()}
        />
      </div>
    </div>
  );
}
