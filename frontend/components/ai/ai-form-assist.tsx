"use client";
/**
 * AiFormAssist — the one AI panel any form can embed.
 *
 * HOW IT PLUGS IN (the contract, 3 lines in any form):
 *   const ai = useAiFormAssist("student_admission", fields, form, setForm);
 *   <AiFormAssistPanel {...ai} />
 * …where `fields` is the same schema you already maintain for rendering:
 *   { key, label, ne?, type: "text"|"number"|"date"|"time"|"select"|"email",
 *     options?, required?, hint? }
 *
 * Flow: user types a free-text description (EN or Nepali) → POST
 * /ai-tools/form-assist → strict-JSON {values} → only schema-known keys are
 * applied via setForm, so a hallucinated key can never corrupt a form.
 * Text/number/select/date fields are applied verbatim (dates must arrive as
 * AD "YYYY-MM-DD" — the prompt enforces BS→AD conversion server-side).
 *
 * Gated by the ai_suite plugin like every other AI tool; the trigger button
 * renders nothing when the plugin is absent (forms must not depend on AI).
 */
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Sparkles, Loader2, X, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { PluginGate } from "@/lib/plugins";
import { cn } from "@/lib/utils";

export interface AiFieldSchema {
  key: string;
  label: string;
  ne?: string;
  type: "text" | "number" | "date" | "time" | "select" | "email" | "textarea";
  options?: string[];
  required?: boolean;
  hint?: string;
}

export interface AiFormAssistApi {
  open: boolean;
  setOpen: (v: boolean) => void;
  schema: AiFieldSchema[];
  values: Record<string, unknown>;
  applyValues: (v: Record<string, unknown>) => void;
  formId: string;
}

/** Wire a form to AI assist. Returns props for <AiFormAssistPanel …/> and
 *  an `applyValues` that is also used internally by the panel. */
export function useAiFormAssist(
  formId: string,
  schema: AiFieldSchema[],
  values: Record<string, unknown>,
  setValue: (key: string, value: string) => void
): AiFormAssistApi {
  return {
    open: false, // replaced below — kept for API shape clarity
    setOpen: () => {},
    schema,
    values,
    // Panel applies each key through the form's own setter so any
    // side-effects (cascading selects, derived fields) still run.
    applyValues: (v) => {
      for (const [k, val] of Object.entries(v)) {
        setValue(k, val === null || val === undefined ? "" : String(val));
      }
    },
    formId,
  };
}

/** React state holder for the panel open/close (split from the hook above so
 *  the form owns render state; usage: const assist = useAiFormAssist(…);
 *  const [aiOpen, setAiOpen] = useState(false); then pass aiOpen/setAiOpen). */
export function AiFormAssistPanel({
  formId,
  schema,
  values,
  applyValues,
  open,
  setOpen,
}: AiFormAssistApi & { open: boolean; setOpen: (v: boolean) => void }) {
  const { t, lang } = useI18n();
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");

  if (!open) return null;

  async function run() {
    if (!instruction.trim()) return;
    setBusy(true);
    setNotes("");
    try {
      const res = await api.post("/ai-tools/form-assist", {
        form_id: formId,
        fields: schema,
        instruction,
        current: values,
        language: lang === "ne" ? "nepali" : "english",
      });
      const data = (res.data?.data ?? res.data) as {
        values: Record<string, unknown>;
        notes?: string;
        filled?: number;
      };
      const filled = Object.keys(data?.values ?? {}).length;
      if (filled === 0) {
        toast.warning(
          t(
            "AI couldn't determine any fields from that description",
            "AI ले त्यो विवरणबाट कुनै फिल्ड निर्धारण गर्न सकेन"
          )
        );
      } else {
        applyValues(data.values);
        toast.success(t(`Filled ${filled} field${filled > 1 ? "s" : ""}`, `${filled} फिल्ड भरियो`));
      }
      if (data?.notes) setNotes(data.notes);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        toast.error(t("AI quota exceeded — try later", "AI कोटा सकियो — पछि प्रयास गर्नुहोस्"));
      } else if (status === 403) {
        toast.error(t("AI assistant is not enabled for your school", "तपाईंको विद्यालयमा AI सहायक सक्रिय छैन"));
      } else {
        toast.error(t("AI assistant failed", "AI सहायक असफल भयो"));
      }
    } finally {
      setBusy(false);
    }
  }

  const requiredKeys = new Set(schema.filter((f) => f.required).map((f) => f.key));

  return (
    <div
      className={cn(
        "mb-5 overflow-hidden rounded-lg border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-transparent"
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-3 w-3" />
        </span>
        <h3 className="text-[13px] font-semibold">
          {t("AI Quick Fill", "एआई द्रुत भराइ")}
        </h3>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          {t("Describe the record in plain words", "कुनै पनि भाषामा विवरण लेख्नुहोस्")}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent"
          aria-label={t("Close", "बन्द")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-2 px-4 pb-3 pt-2 sm:flex-row">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
          }}
          rows={2}
          placeholder={t(
            "e.g. Ram Bahadur Thapa, class 5 section A, DOB 2068-01-15 BS, father Suresh 9841000000",
            "जस्तै: राम बहादुर थापा, कक्षा ५ खण्ड क, जन्म मिति २०६८-०१-१५, बुबा सुरेश ९८४१००००००"
          )}
          className="min-h-[56px] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-[12px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex sm:flex-col gap-2">
          <Button size="sm" onClick={run} disabled={busy || !instruction.trim()} className="h-9 flex-1">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{busy ? t("Filling…", "भर्दै…") : t("Fill form", "फारम भर्नुहोस्")}</span>
          </Button>
          <p className="hidden text-[10px] leading-tight text-muted-foreground sm:block">
            {t("Ctrl + ⏎", "Ctrl + ⏎")}
          </p>
        </div>
      </div>
      {notes && (
        <p className="border-t border-primary/15 bg-background/40 px-4 py-1.5 text-[11px] text-muted-foreground">
          {notes}
        </p>
      )}
      {/* Schema hint so users know what AI can fill (first 4 field names) */}
      <p className="px-4 pb-2 text-[10px] text-muted-foreground/80">
        {t("Can fill:", "भर्न सक्ने:")}{" "}
        {schema.slice(0, 5).map((f) => f.ne ?? f.label).join(" · ")}
        {requiredKeys.size > 0 && " — " + t("marks required fields you still need to check", "आवश्यक फिल्डहरू जाँच गर्नुहोस्")}
      </p>
    </div>
  );
}

/** Toggle button rendered at the top of a form when ai_suite is installed. */
export function AiAssistTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className={className}>
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      {t("AI Assist", "एआई सहायता")}
    </Button>
  );
}

/** Convenience wrapper: trigger button + panel, silently absent when the
 *  ai_suite plugin is not installed (fallback=null renders nothing). Forms
 *  that want a custom trigger use the pieces above instead. */
export function AiFormAssist(props: {
  formId: string;
  schema: AiFieldSchema[];
  values: Record<string, unknown>;
  applyValues: (v: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PluginGate slug="ai_suite" fallback={null}>
      <div className="mb-4 flex justify-end">
        <AiAssistTrigger onClick={() => setOpen((o) => !o)} />
      </div>
      {open && (
        <AiFormAssistPanel
          formId={props.formId}
          schema={props.schema}
          values={props.values}
          applyValues={props.applyValues}
          open={open}
          setOpen={setOpen}
        />
      )}
    </PluginGate>
  );
}
