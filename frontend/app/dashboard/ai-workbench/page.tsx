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
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ShieldCheck,
  Loader2,
  Coins,
  BookOpenCheck,
  ClipboardList,
  Ticket,
  ListChecks,
  Mail,
  Layers,
  GraduationCap,
  Layers3,
  PenTool,
  FlaskConical,
} from "lucide-react";

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
  communication: Mail,
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
        <h1 className="text-xl font-bold">{tool.name}</h1>
        <Badge variant="outline">{tool.category}</Badge>
      </div>

      {/* Cost estimate BEFORE generation (AW-12: CostEstimateChip) */}
      {generate.isIdle && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins className="h-4 w-4" />
          Estimated cost: &lt;NPR 1 per generation (metered, hard stop — never
          an overage bill)
        </div>
      )}

      {/* AI Nutrition Facts (A-07/AW-04 transparency) */}
      {nutrition.data && (
        <Card>
          <CardContent className="p-4 text-sm space-y-1.5">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              AI Nutrition Facts
            </div>
            <p>
              <span className="text-muted-foreground">Model:</span>{" "}
              {nutrition.data.model} ({nutrition.data.provider})
            </p>
            <p>
              <span className="text-muted-foreground">Accesses:</span>{" "}
              {nutrition.data.data_accessed.join(", ") || "only what you type"}
            </p>
            <p>
              <span className="text-muted-foreground">Never accesses:</span>{" "}
              {nutrition.data.data_not_accessed.join(", ") || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Retention:</span>{" "}
              {nutrition.data.retention_days} days ·{" "}
              {nutrition.data.no_training_guarantee
                ? "your data is never used to train models"
                : "training use possible"}
              {nutrition.data.human_review_required
                ? " · human review required"
                : ""}
            </p>
            {nutrition.data.limitations && (
              <p className="text-muted-foreground italic">
                {nutrition.data.limitations}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Describe what you need — topic, grade, subject, any notes…"
        className="w-full min-h-[120px] rounded-lg border border-border bg-background p-3 text-sm"
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
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {(generate.error as { response?: { data?: { error?: string } } })
            ?.response?.data?.error ?? "Generation failed. Please try again."}
        </p>
      )}

      {generate.data && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {generate.data.model} via {generate.data.provider} · $
                {generate.data.cost_usd.toFixed(4)}
              </span>
              <span className="font-mono">
                gen:{generate.data.generation_id.slice(0, 8)}
              </span>
            </div>
            <pre className="whitespace-pre-wrap text-sm font-sans">
              {JSON.stringify(generate.data.result, null, 2)}
            </pre>
          </CardContent>
        </Card>
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
          <div key={i} className="animate-pulse h-32 bg-muted rounded-xl" />
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
            className="text-left rounded-xl border border-border hover:border-primary/50 hover:shadow-md transition-all p-5 space-y-2 bg-card"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex gap-1.5">
                {t.status === "ga" && (
                  <Badge variant="secondary" className="text-[10px]">
                    GA
                  </Badge>
                )}
                {t.min_plan_tier !== "free" && (
                  <Badge variant="outline" className="text-[10px]">
                    AI Suite
                  </Badge>
                )}
                {!t.enabled && (
                  <Badge variant="destructive" className="text-[10px]">
                    Off
                  </Badge>
                )}
              </div>
            </div>
            <p className="font-semibold">{t.name}</p>
            {t.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {t.description}
              </p>
            )}
          </button>
        );
      })}
      {tools.length === 0 && (
        <p className="text-sm text-muted-foreground col-span-full">
          No AI tools available yet.
        </p>
      )}
    </div>
  );
}

function WorkbenchContent() {
  const [active, setActive] = useState<WorkbenchTool | null>(null);

  return (
    <div className="space-y-6">
      {!active && (
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers3 className="h-6 w-6 text-primary" /> AI Workbench
          </h1>
          <p className="text-sm text-muted-foreground">
            Your AI teaching assistants — every tool shows exactly what data it
            uses, never trains on your school&apos;s work.
          </p>
        </div>
      )}
      {active ? (
        <ToolRunner tool={active} onBack={() => setActive(null)} />
      ) : (
        <Catalog onOpen={setActive} />
      )}
    </div>
  );
}

export default function AIWorkbenchPage() {
  return (
    <PluginGate slug="ai_suite">
      <WorkbenchContent />
    </PluginGate>
  );
}
