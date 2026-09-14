"use client";

/**
 * AI Workbench (AW-12) — dataset + run workspace over the ai_workbench
 * registry (wave-H re-skin, zero logic change):
 *
 * Research:
 * 1. A6 workspace grammar (Part 32): left = the dataset (tool catalog list,
 *    pickable rows with GA/Off chips), right = the run panel for the selected
 *    tool — no more full-page swap, the catalog never disappears and the
 *    selected tool is re-pickable without a "back" hop.
 * 2. AI transparency (A-07/AW-04 keep-list): Nutrition Facts, cost estimate
 *   before generating, and provenance (model · provider · $cost · gen id)
 *    stay first-class — the corpus lesson (EduEx shipped MOCK AI) is that
 *    visible provenance is what makes generated output trustworthy.
 *
 * Endpoints unchanged: GET /ai/tools, GET /ai/tools/<key>/nutrition,
 * POST /ai/generate/<key>.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppGate } from "@/lib/apps";
import { AiResultView } from "@/components/ai/ai-result-view";
import { api, type ApiResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { cn } from "@/lib/utils";
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
  Copy,
  Bookmark,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  DetailSplit,
  FormSection,
} from "@/components/aos/kit/page-kit";
import { EmptyState } from "@/components/ui/empty-state";

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

function ToolRunner({ tool }: { tool: WorkbenchTool }) {
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
        .post<ApiResponse<GenerateResponse>>(`/ai/generate/${tool.tool_key}`, { input })
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-library"] });
    },
  });

  const save = useMutation({
    mutationFn: async () =>
      (
        await api.post("/ai/library", {
          tool_key: tool.tool_key,
          title: `${tool.name} — ${new Date().toLocaleDateString("en-GB")}`,
          content: JSON.stringify(generate.data?.result ?? null),
          visibility: "private",
        })
      ).data,
    onSuccess: () => {
      toast.success("Saved to library");
      queryClient.invalidateQueries({ queryKey: ["ai-library"] });
    },
  });

  return (
    <div className="space-y-4">
      {/* ── RUN panel: dataset you feed it ── */}
      <FormSection
        title={`Run — ${tool.name}`}
      >
        <div className="space-y-3">
          {generate.isIdle && (
            <div className="flex items-center gap-2 text-sm text-[color:var(--w11-text-secondary)]">
              <Coins className="h-4 w-4" />
              Estimated cost: &lt;NPR 1 per generation (metered, hard stop — never an overage bill)
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you need — topic, grade, subject, any notes…"
            rows={5}
            className="w-full rounded-lg p-3 text-sm"
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {generate.isPending ? "Generating…" : "Generate"}
          </Button>
        </div>
      </FormSection>

      {/* ── RESULT panel ── */}
      <DataPanel
        title="Result"
        actions={
          generate.data ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => save.mutate()}
                disabled={save.isPending}
              >
                {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bookmark className="h-4 w-4 mr-1" />}
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(generate.data?.result, null, 2));
                  toast.success("Copied");
                }}
              >
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
            </div>
          ) : undefined
        }
      >
        {generate.isPending ? (
          <p className="py-10 text-center text-sm text-[color:var(--w11-text-secondary)]">
            Generating — every draft is human-reviewable before use.
          </p>
        ) : generate.isError ? (
          <div className="win11-infobar error p-3 text-sm">
            {(generate.error as { response?: { data?: { error?: string } } })
              ?.response?.data?.error ?? "Generation failed. Please try again."}
          </div>
        ) : generate.data ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[color:var(--w11-text-secondary)]">
              <span>
                {generate.data.model} via {generate.data.provider} · ${generate.data.cost_usd.toFixed(4)}
              </span>
              <span className="font-mono">gen:{generate.data.generation_id.slice(0, 8)}</span>
            </div>
            <AiResultView result={generate.data.result} />
          </div>
        ) : (
          <EmptyState icon={FlaskConical} title="Generate to see output" size="sm" />
        )}
      </DataPanel>

      {/* ── Transparency panel (A-07/AW-04) ── */}
      {nutrition.data && (
        <DataPanel title="AI Nutrition Facts">
          <div className="text-sm space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[color:var(--w11-text-primary)]">
              <ShieldCheck className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
              {nutrition.data.model} ({nutrition.data.provider})
            </div>
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
              {nutrition.data.human_review_required ? " · human review required" : ""}
            </p>
            {nutrition.data.limitations && (
              <p className="text-[color:var(--w11-text-secondary)] italic">{nutrition.data.limitations}</p>
            )}
          </div>
        </DataPanel>
      )}
    </div>
  );
}

function CatalogList({
  tools,
  activeKey,
  onOpen,
}: {
  tools: WorkbenchTool[];
  activeKey: string | null;
  onOpen: (t: WorkbenchTool) => void;
}) {
  return (
    <div className="win11-card p-2 space-y-1" style={{ marginBottom: 0, maxHeight: 560, overflowY: "auto" }}>
      {tools.map((t) => {
        const Icon = CATEGORY_ICONS[t.category] ?? Sparkles;
        return (
          <button
            key={t.tool_key}
            onClick={() => onOpen(t)}
            aria-current={activeKey === t.tool_key ? "true" : undefined}
            className={cn(
              "w-full text-left rounded-md p-2.5 flex items-start gap-2.5 transition-colors",
              activeKey === t.tool_key
                ? "bg-[var(--w11-accent-light)]"
                : "hover:bg-[var(--w11-control-hover)]",
              !t.enabled && "opacity-60",
            )}
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--w11-accent)" }} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[color:var(--w11-text-primary)] truncate">
                {t.name}
              </p>
              {t.description && (
                <p className="text-xs text-[color:var(--w11-text-secondary)] line-clamp-2">{t.description}</p>
              )}
              <div className="flex gap-1.5 mt-1">
                {t.status === "ga" && <span className="win11-chip success text-[10px]">GA</span>}
                {t.min_plan_tier !== "free" && <span className="win11-chip text-[10px]">AI Suite</span>}
                {!t.enabled && <span className="win11-chip error text-[10px]">Off</span>}
              </div>
            </div>
          </button>
        );
      })}
      {tools.length === 0 && (
        <p className="text-sm text-[color:var(--w11-text-secondary)] p-3">
          No AI tools available yet.
        </p>
      )}
    </div>
  );
}

const QUICK_LINKS = [
  { label: "AI Hub", icon: "Sparkles", href: "/dashboard/ai" },
  { label: "Analytics", icon: "BarChart3", href: "/dashboard/analytics" },
  { label: "Benchmarking", icon: "TrendingUp", href: "/dashboard/benchmarking" },
  { label: "Reports", icon: "FileBarChart2", href: "/dashboard/reports" },
];

function WorkbenchContent() {
  const [active, setActive] = useState<WorkbenchTool | null>(null);

  const { data: catalog, isLoading } = useQuery({
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
        subtitle="Every tool shows exactly what data it uses; nothing trains on your school's work · AI कार्यशाला"
        actions={
          <div className="flex gap-2">
            {active && (
              <Button variant="outline" size="sm" onClick={() => setActive(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> All tools
              </Button>
            )}
            <Link href="/dashboard/ai?tab=workbench">
              <Button variant="outline" size="sm">AI Hub</Button>
            </Link>
          </div>
        }
      />
      <AOSPageBody>
        {/* Dashboard band — KPIs from the live catalog (no invented numbers) */}
        <StatGrid>
          <KpiCard label="Tools" value={tools.length} icon={<Sparkles className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Generally Available" value={tools.filter((t) => t.status === "ga").length} color="#107c10" icon={<ShieldCheck className="h-4 w-4" style={{ color: "#107c10" }} />} />
          <KpiCard label="Enabled" value={tools.filter((t) => t.enabled).length} color="var(--w11-text-primary)" icon={<BookOpenCheck className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />} />
          <KpiCard label="AI Suite Only" value={tools.filter((t) => t.min_plan_tier !== "free").length} color="#7c3aed" icon={<FlaskConical className="h-4 w-4" style={{ color: "#7c3aed" }} />} />
        </StatGrid>

        <QuickLinks section="Insights" links={QUICK_LINKS} className="mb-4" />

        {isLoading ? (
          <p className="text-sm text-[color:var(--w11-text-secondary)]">Loading the tool catalog…</p>
        ) : (
          <DetailSplit
            sidebar={<CatalogList tools={tools} activeKey={active?.tool_key ?? null} onOpen={setActive} />}
            sidebarWidth="300px"
          >
            {active ? (
              <ToolRunner tool={active} />
            ) : (
              <EmptyState
                icon={Layers3}
                title="Pick a tool to run"
                body="The catalog is on the left — each tool's card shows what it can and cannot see before you generate anything."
              />
            )}
          </DetailSplit>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}

export default function AIWorkbenchPage() {
  return (
    <AppGate slug="ai_suite">
      <WorkbenchContent />
    </AppGate>
  );
}
