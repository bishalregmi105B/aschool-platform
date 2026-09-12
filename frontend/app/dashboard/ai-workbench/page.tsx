"use client";

/**
 * AI Workbench (AW-12) — the catalog grid + generic ToolRunner for the
 * ai_workbench plugin. Every tool renders from the registry: one schema-
 * driven form (from the tool's Nutrition Facts + a free-form input), a
 * cost estimate before generating, and the provenance-aware result view.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PluginGate } from "@/lib/plugins";
import { AiResultView } from "@/components/ai/ai-result-view";
import { api, type ApiResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Loader2,
  Coins,
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  FlaskConical,
  Layers3,
  ChevronRight,
} from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";

interface WorkbenchTool {
  tool_key: string;
  name: string;
  name_ne?: string | null;
  category: string;
  description?: string | null;
  min_plan_tier: string;
  status: string;
  enabled: boolean;
  is_fixture?: boolean;
}

interface NutritionFacts {
  tool_key: string;
  model: string;
  provider: string;
  data_accessed: string[];
  data_not_accessed: string[];
  retention_days: number;
  no_training_guarantee: boolean;
  human_review_required: boolean;
  limitations?: string | null;
}

interface GenerateResponse {
  result: Record<string, unknown>;
  generation_id: string;
  provider: string;
  model: string;
  cost_usd: number;
}

const CATEGORY_ICONS: Record<string, typeof Sparkles> = {
  planning: BookOpenCheck,
  assessment: ClipboardList,
  communication: Sparkles,
  tutor: GraduationCap,
  admin: FlaskConical,
};

function ToolRunner({
  tool,
  onBack,
}: {
  tool: WorkbenchTool;
  onBack: () => void;
}) {
  const [input, setInput] = useState("");
  const queryClient = useQueryClient();

  const nutrition = useQuery({
    queryKey: ["ai-nutrition", tool.tool_key],
    queryFn: () =>
      api
        .get<ApiResponse<NutritionFacts>>(`/ai/tools/${tool.tool_key}/nutrition`)
        .then((r) => r.data.data),
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () =>
      api
        .post<ApiResponse<GenerateResponse>>(`/ai/generate/${tool.tool_key}`, {
          input,
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-library"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← All tools
        </Button>
        <h1 className="text-xl font-semibold text-[color:var(--w11-text-primary)]">{tool.name}</h1>
        <span className="win11-chip">{tool.category}</span>
      </div>

      {/* Cost estimate BEFORE generation (AW-12: CostEstimateChip) */}
      {generate.isIdle && (
        <div className="flex items-center gap-2 text-sm text-[color:var(--w11-text-secondary)]">
          <Coins className="h-4 w-4" />
          Estimated cost: &lt;NPR 1 per generation (metered, hard stop — never
          an overage bill)
        </div>
      )}

      {/* AI Nutrition Facts (A-07/AW-04 transparency) */}
      {nutrition.data && (
        <DataPanel>
          <div className="p-0 text-sm space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[color:var(--w11-text-primary)]">
              <ShieldCheck className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
              AI Nutrition Facts
            </div>
            <p>
              <span className="text-[color:var(--w11-text-secondary)]">Model:</span>{" "}
              {nutrition.data.model} ({nutrition.data.provider})
            </p>
            <p>
              <span className="text-[color:var(--w11-text-secondary)]">Accesses:</span>{" "}
              {nutrition.data.data_accessed.join(", ") || "only what you type"}
            </p>
            <p>
              <span className="text-[color:var(--w11-text-secondary)]">Never accesses:</span>{" "}
              {nutrition.data.data_not_accessed.join(", ") || "—"}
            </p>
            <p>
              <span className="text-[color:var(--w11-text-secondary)]">Retention:</span>{" "}
              {nutrition.data.retention_days} days ·{" "}
              {nutrition.data.no_training_guarantee
                ? "your data is never used to train models"
                : "training use possible"}
              {nutrition.data.human_review_required
                ? " · human review required"
                : ""}
            </p>
            {nutrition.data.limitations && (
              <p className="text-[color:var(--w11-text-secondary)] italic">
                {nutrition.data.limitations}
              </p>
            )}
          </div>
        </DataPanel>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Describe what you need — topic, grade, subject, any notes…"
        className="w-full min-h-[120px] rounded-lg p-3 text-sm"
        style={{
          background: "var(--w11-control-bg)",
          border: "1px solid var(--w11-control-border, var(--w11-border-default))",
          color: "var(--w11-text-primary)",
        }}
      />

      <Button
        onClick={() => generate.mutate()}
        disabled={!input.trim() || generate.isPending}
      >
        {generate.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" /> Generate
          </>
        )}
      </Button>

      {generate.isError && (
        <p className="text-sm rounded-md px-3 py-2" style={{ color: "#c42b1c", background: "rgba(196,43,28,.08)" }}>
          {(generate.error as { response?: { data?: { error?: string } } })
            ?.response?.data?.error ?? "Generation failed. Please try again."}
        </p>
      )}

      {generate.data && (
        <DataPanel>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[color:var(--w11-text-secondary)]">
              <span>
                {generate.data.model} via {generate.data.provider} · $
                {generate.data.cost_usd.toFixed(4)}
              </span>
              <span className="font-mono">
                gen:{generate.data.generation_id.slice(0, 8)}
              </span>
            </div>
            <AiResultView result={generate.data.result} />
          </div>
        </DataPanel>
      )}
    </div>
  );
}

function Catalog({ onOpen }: { onOpen: (t: WorkbenchTool) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-workbench-catalog"],
    queryFn: () =>
      api
        .get<ApiResponse<{ tools: WorkbenchTool[] }>>("/ai/tools")
        .then((r) => r.data.data),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse h-32 rounded-xl" style={{ background: "var(--w11-control-hover)" }} />
        ))}
      </div>
    );
  }

  const tools = (data?.tools ?? []).filter((t) => !t.is_fixture);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tools.map((t) => {
        const Icon = CATEGORY_ICONS[t.category] ?? Sparkles;
        return (
          <button
            key={t.tool_key}
            onClick={() => onOpen(t)}
            className="win11-card interactive text-left p-5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex gap-1.5">
                {t.status === "ga" && (
                  <span className="win11-chip success text-[10px]">GA</span>
                )}
                {t.min_plan_tier !== "free" && (
                  <span className="win11-chip text-[10px]">AI Suite</span>
                )}
                {!t.enabled && (
                  <span className="win11-chip error text-[10px]">Off</span>
                )}
              </div>
            </div>
            <p className="font-semibold text-[color:var(--w11-text-primary)]">{t.name}</p>
            {t.description && (
              <p className="text-xs text-[color:var(--w11-text-secondary)] line-clamp-2">
                {t.description}
              </p>
            )}
          </button>
        );
      })}
      {tools.length === 0 && (
        <p className="text-sm text-[color:var(--w11-text-secondary)] col-span-full">
          No AI tools available yet.
        </p>
      )}
    </div>
  );
}

// Quick links — the ai_suite manifest subitems (Analytics, Benchmarking,
// Reports) plus the parent AI Tools hub.
const QUICK_LINKS = [
  { label: "AI Tools Hub", icon: "Sparkles", href: "/dashboard/ai-tools" },
  { label: "Analytics", icon: "BarChart3", href: "/dashboard/analytics" },
  { label: "Benchmarking", icon: "TrendingUp", href: "/dashboard/benchmarking" },
  { label: "Reports", icon: "FileBarChart2", href: "/dashboard/reports" },
];

function WorkbenchContent() {
  const [active, setActive] = useState<WorkbenchTool | null>(null);

  // Hub KPIs — same query the Catalog renders (react-query dedupes).
  const { data: catalog } = useQuery({
    queryKey: ["ai-workbench-catalog"],
    queryFn: () =>
      api
        .get<ApiResponse<{ tools: WorkbenchTool[] }>>("/ai/tools")
        .then((r) => r.data.data),
  });
  const tools = (catalog?.tools ?? []).filter((t) => !t.is_fixture);

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Layers3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="AI Workbench"
        subtitle="Your AI teaching assistants — every tool shows exactly what data it uses, never trains on your school's work."
      />
      <AOSPageBody>
        {active ? (
          <ToolRunner tool={active} onBack={() => setActive(null)} />
        ) : (
          <>
            {/* Dashboard — KPI stat grid from the live catalog */}
            <StatGrid>
              <KpiCard
                label="Tools"
                value={tools.length}
                icon={<Sparkles className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
              />
              <KpiCard
                label="Generally Available"
                value={tools.filter((t) => t.status === "ga").length}
                color="#107c10"
                icon={<ShieldCheck className="h-4 w-4" style={{ color: "#107c10" }} />}
              />
              <KpiCard
                label="Enabled"
                value={tools.filter((t) => t.enabled).length}
                color="var(--w11-text-primary)"
                icon={<BookOpenCheck className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
              />
              <KpiCard
                label="AI Suite Only"
                value={tools.filter((t) => t.min_plan_tier !== "free").length}
                color="#7c3aed"
                icon={<FlaskConical className="h-4 w-4" style={{ color: "#7c3aed" }} />}
              />
            </StatGrid>

            {/* Quick links — 44px gradient icon tile + label, as next/link */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {QUICK_LINKS.map((l) => {
                const Icon = ICON_MAP[l.icon] || ChevronRight;
                return (
                  <Link key={l.href} href={l.href} className="block h-full">
                    <div
                      className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                      style={{ cursor: "pointer", marginBottom: 0 }}
                    >
                      <div
                        className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                        style={{
                          width: 44,
                          height: 44,
                          background: SECTION_GRADIENTS.Insights,
                          boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                        {l.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <Catalog onOpen={setActive} />
          </>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}

export default function AIWorkbenchPage() {
  return (
    <PluginGate slug="ai_suite">
      <WorkbenchContent />
    </PluginGate>
  );
}
