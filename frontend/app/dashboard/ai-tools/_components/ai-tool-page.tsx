"use client";

/**
 * AiToolPage — the ONE template for every ai-tools generate page (wave-H).
 *
 * Research notes (2-line standard, from audits/deep-ux-2026-09):
 * 1. MagicSchool's tool-card deep-link-with-prefill pattern (aschool-frontend
 *    §15 steal; Part 4.3-5): hub card → tool page carrying the school context
 *    (subject/grade/topic) in the URL; live audit showed question-paper IGNORED
 *    the prefill params blueprint-builder already sends — this template reads
 *    every declared field key back out of the window URL on mount.
 * 2. Corpus law (IMPROVEMENT_PLAN 31.0, A3 grammar, Part 19.3 honesty): one
 *    input panel (≤7 visible fields, rare ones behind an Advanced expander),
 *    one Generate action with button spinner + optimistic disable, one result
 *    panel with a designed empty state ("Generate to see output"), and a
 *    per-tool history where the API exposes one — /ai/library?tool_key= does.
 *
 * Pages pass only tool-specific config: fields, payload builder, optional
 * custom result renderer. Endpoints/validation stay exactly as before.
 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Copy, Bookmark, ChevronRight, Download, Clock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { AiResultView } from "@/components/ai/ai-result-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import { useAOSRouteParams } from "@/lib/aos-window-route";

// ── field model ───────────────────────────────────────────────────────────

export interface AiToolField {
  key: string;
  /** English label; `ne` renders as the inline bilingual second label. */
  label: string;
  ne?: string;
  /** Defaults to "text". */
  type?: "text" | "textarea" | "number" | "select" | "date";
  placeholder?: string;
  rows?: number;
  options?: { value: string; label: string }[];
  /** Gate the Generate button on this field being non-empty. */
  required?: boolean;
  /** Hidden behind the "Advanced" expander (7-visible rule, 31.0). */
  advanced?: boolean;
  defaultValue?: string;
  hint?: string;
  /** Span the full row in the 2-col form grid. */
  full?: boolean;
}

export interface AiToolPageProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  /** One-line "what this does", EN + NE (bilingual convention, §15 keep). */
  subtitle: string;
  subtitleNe?: string;
  /** workbench tool_key — drives the default endpoint, library save + history. */
  toolKey: string;
  fields: AiToolField[];
  generateLabel?: string;
  /** Override the default POST /ai/generate/<toolKey> (dedicated routes). */
  endpoint?: string;
  /** Map values → request body. Defaults to passing values through. */
  buildPayload?: (v: Record<string, string>) => Record<string, unknown>;
  /** Extra client gate; return a short reason to block Generate. */
  validate?: (v: Record<string, string>) => string | null;
  /** Unwrap the API response; default `res.data.data`. */
  unwrap?: (res: any) => unknown;
  resultTitle: string | ((data: any) => string);
  /** One-liner in the empty result panel. */
  resultHint?: string;
  /** Custom result renderer; default = AiResultView (markdown/doc_sections). */
  renderResult?: (data: any, values: Record<string, string>) => React.ReactNode;
  /** Text for Copy/Save; default stringifies. */
  toText?: (data: any) => string;
  /** Extra header actions (e.g. "Continue to paper generator"). */
  resultActions?: (data: any) => React.ReactNode;
  /** Caveat infobar under the inputs (honesty discipline, Part 2.8). */
  note?: React.ReactNode;
  /** Layout: half (default 2-col), 2-5 col with wide result, or stacked. */
  layout?: "half" | "wide-result" | "stacked";
  /** Set true for pages whose result isn't copy/save friendly. */
  hideSave?: boolean;
  hideHistory?: boolean;
}

function defaultToText(data: unknown): string {
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

// ── the page ──────────────────────────────────────────────────────────────

export function AiToolPage(props: AiToolPageProps) {
  return (
    <PluginGate slug="ai_suite">
      <AiToolPageContent {...props} />
    </PluginGate>
  );
}

export function AiToolPageContent(props: AiToolPageProps) {
  const {
    icon: Icon, title, subtitle, subtitleNe, toolKey, fields,
    generateLabel = "Generate", endpoint, buildPayload, validate, unwrap,
    resultTitle, resultHint, renderResult, toText = defaultToText,
    resultActions, note, layout = "half", hideSave, hideHistory,
  } = props;
  const endpointUrl = endpoint || `/ai/generate/${toolKey}`;

  const params = useAOSRouteParams();
  const initial = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of fields) {
      out[f.key] = params.get(f.key) ?? f.defaultValue ?? "";
    }
    return out;
    // URL prefill is read once on mount — window route params are stable
    // for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [showAdvanced, setShowAdvanced] = useState(
    () => fields.some((f) => f.advanced && initial[f.key]),
  );
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const requiredMissing = fields.filter((f) => f.required && !String(values[f.key] ?? "").trim()).map((f) => f.label);
  const gateReason = validate?.(values) || null;

  const generate = useMutation({
    mutationFn: async () => {
      const body = buildPayload ? buildPayload(values) : values;
      const res = await api.post(endpointUrl, body);
      return (unwrap ? unwrap(res) : res.data?.data) as unknown;
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      toast.success(`${title} ready — review before you use it`);
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Generation failed — try again.",
      );
      setResult(null);
    },
  });

  const canGenerate = requiredMissing.length === 0 && !gateReason && !generate.isPending;

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () =>
      (
        await api.post("/ai/library", {
          tool_key: toolKey,
          title: `${title} — ${new Date().toLocaleDateString("en-GB")}`,
          content: toText(result),
          visibility: "private",
        })
      ).data,
    onSuccess: () => {
      toast.success("Saved to the AI library");
      qc.invalidateQueries({ queryKey: ["ai-library", toolKey] });
    },
    onError: () => toast.error("Couldn't save"),
  });

  const history = useQuery({
    queryKey: ["ai-library", toolKey],
    enabled: !hideHistory && !!toolKey,
    queryFn: async () =>
      (await api.get("/ai/library", { params: { tool_key: toolKey } })).data?.data ?? [],
    retry: false,
  });

  const copy = () => {
    navigator.clipboard.writeText(toText(result));
    toast.success("Copied!");
  };
  const download = () => {
    const blob = new Blob([toText(result)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${toolKey || title.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visible = fields.filter((f) => !f.advanced);
  const advanced = fields.filter((f) => f.advanced);

  const renderField = (f: AiToolField) => {
    const value = values[f.key] ?? "";
    const id = `ai-field-${f.key}`;
    return (
      <div
        key={f.key}
        className={`space-y-2${f.full ? " md:col-span-2" : ""}`}
      >
        <Label htmlFor={id}>
          {f.label}
          {f.ne && <span className="ml-1 text-[color:var(--w11-text-secondary)]">/ {f.ne}</span>}
          {f.required && <span className="text-[var(--w11-danger,#c42b1c)]"> *</span>}
        </Label>
        {f.type === "textarea" ? (
          <Textarea
            id={id}
            rows={f.rows ?? 4}
            value={value}
            onChange={set(f.key)}
            placeholder={f.placeholder}
          />
        ) : f.type === "select" ? (
          <select
            id={id}
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{
              background: "var(--w11-control-bg)",
              border: "1px solid var(--w11-control-border, var(--w11-border-default))",
              color: "var(--w11-text-primary)",
            }}
            value={value}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          >
            <option value="">—</option>
            {(f.options || []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : f.type === "date" ? (
          <BSDateInput value={value} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} emit="bs" placeholder={f.placeholder} />
        ) : (
          <Input
            id={id}
            type={f.type === "number" ? "number" : "text"}
            value={value}
            onChange={set(f.key)}
            placeholder={f.placeholder}
          />
        )}
        {f.hint && (
          <p className="text-[11px] text-[color:var(--w11-text-secondary)]">{f.hint}</p>
        )}
      </div>
    );
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Icon className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={title}
        subtitle={subtitleNe ? `${subtitle} · ${subtitleNe}` : subtitle}
        actions={
          <Link href="/dashboard/ai?tab=tools">
            <Button variant="outline" size="sm">
              <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
              AI Hub · Tools
            </Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div
          className={
            layout === "wide-result"
              ? "grid grid-cols-1 lg:grid-cols-5 gap-4"
              : layout === "stacked"
                ? "space-y-4"
                : "grid grid-cols-1 lg:grid-cols-2 gap-4"
          }
        >
          {/* ── INPUT panel ── */}
          <FormSection
            title="Inputs"
            className={layout === "wide-result" ? "lg:col-span-2" : undefined}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{visible.map(renderField)}</div>
              {advanced.length > 0 && (
                <div>
                  <button
                    type="button"
                    aria-expanded={showAdvanced}
                    onClick={() => setShowAdvanced((s) => !s)}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--w11-accent)] hover:underline"
                  >
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
                    {showAdvanced ? "Hide advanced" : `Advanced (${advanced.length})`}
                  </button>
                  {showAdvanced && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">{advanced.map(renderField)}</div>
                  )}
                </div>
              )}
              {note && <div className="win11-infobar info p-3 text-xs">{note}</div>}
              <Button
                className="w-full"
                onClick={() => generate.mutate()}
                disabled={!canGenerate}
                title={
                  gateReason ||
                  (requiredMissing.length ? `Fill: ${requiredMissing.join(", ")}` : undefined)
                }
              >
                {generate.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {generate.isPending ? "Generating…" : generateLabel}
              </Button>
              {(gateReason || (requiredMissing.length && !generate.isPending)) && (
                <p className="text-[11px] text-[color:var(--w11-text-secondary)]">
                  {gateReason || `Required: ${requiredMissing.join(", ")}`}
                </p>
              )}
            </div>
          </FormSection>

          {/* ── RESULT panel ── */}
          <DataPanel
            className={layout === "wide-result" ? "lg:col-span-3" : undefined}
            title={typeof resultTitle === "function" ? (result ? resultTitle(result) : resultTitle(undefined)) : resultTitle}
            actions={
              result && !generate.isPending && !error ? (
                <div className="flex items-center gap-1">
                  {resultActions?.(result)}
                  {!hideSave && !!toolKey && (
                    <Button variant="ghost" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                      {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bookmark className="h-4 w-4 mr-1" />}
                      Save
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={download}>
                    <Download className="h-4 w-4 mr-1" /> File
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copy}>
                    <Copy className="h-4 w-4 mr-1" /> Copy
                  </Button>
                </div>
              ) : undefined
            }
          >
            {generate.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <p className="pt-2 text-xs text-[color:var(--w11-text-secondary)]">
                  Generating — a human (you) reviews every draft before it reaches a student or guardian.
                </p>
              </div>
            ) : error ? (
              <ErrorState title="Generation failed" body={error} onRetry={() => generate.mutate()} />
            ) : !result ? (
              <EmptyState
                icon={Icon}
                title="Generate to see output"
                body={resultHint || "Fill the inputs and press Generate."}
              />
            ) : renderResult ? (
              renderResult(result, values)
            ) : (
              <div className="max-h-[640px] overflow-y-auto">
                <AiResultView result={result} />
              </div>
            )}
          </DataPanel>
        </div>

        {/* ── HISTORY: this tool's saved outputs (GET /ai/library?tool_key=) ── */}
        {!hideHistory && !!toolKey && (
          <DataPanel
            title={
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Saved from this tool
              </span>
            }
            className="mt-4"
          >
            {history.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (history.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-[color:var(--w11-text-secondary)]">
                Nothing saved yet — use <strong>Save</strong> on a result you want to keep.
              </p>
            ) : (
              <ul className="divide-y divide-[color:var(--w11-border-subtle)]">
                {(history.data || []).slice(0, 5).map((item: any) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[color:var(--w11-text-primary)]">{item.title}</p>
                      <p className="text-[11px] text-[color:var(--w11-text-secondary)]">
                        {item.created_at ? new Date(item.created_at).toLocaleString("en-GB") : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        try {
                          setResult(JSON.parse(item.content));
                        } catch {
                          setResult(item.content);
                        }
                        setError(null);
                        toast.info("Loaded saved output");
                      }}
                    >
                      Open
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
