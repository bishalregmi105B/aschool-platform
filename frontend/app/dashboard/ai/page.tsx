"use client";

/**
 * AI Hub (/dashboard/ai) — ONE desktop entry for the AI pillar (wave-H).
 *
 * Research notes:
 * 1. MagicSchool-style hub (Part 4.3-5 ideal; frontend §15 steal): tool-card
 *    catalog with search/category chips + deep-link-with-prefill. Deep URLs
 *    /dashboard/ai-tools/* keep working (Part 10.4 route map); this shell only
 *    adds the consolidation layer. `?tool=<key>` forwards to the tool page
 *    carrying the remaining query params as field prefill.
 * 2. A5 hub rule (Part 32): a hub is a launcher + top task, never a
 *    dashboard-of-everything — each tab embeds the lightest useful slice
 *    (catalog / recent lessons / saved outputs / at-risk list), full apps stay
 *    at their deep routes. Tabs are URL state (?tab=) so any tab deep-links
 *    (Part 33 rule 2). Four tabs (Tools | Teacher | Workbench | Insights) come
 *    from the AI-pillar user-facing rule (Part 29).
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Sparkles, GraduationCap, Layers3, Brain, Play, ArrowRight, ShieldAlert, BookOpenCheck, ClipboardList,
} from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/aos/kit/page-kit";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAOSRouteParams, useAOSRouterNavigate } from "@/lib/aos-window-route";
import { ToolCatalog, AI_TOOLS } from "@/app/dashboard/ai-tools/_components/tool-catalog";

type Tab = "tools" | "teacher" | "workbench" | "insights";
const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "tools", label: "Tools", icon: Sparkles },
  { id: "teacher", label: "Teacher", icon: GraduationCap },
  { id: "workbench", label: "Workbench", icon: Layers3 },
  { id: "insights", label: "Insights", icon: Brain },
];

// ── shared small queries ───────────────────────────────────────────────────

type Lesson = {
  id: string;
  topic: string;
  status: string;
  chapters_completed: number;
  duration_seconds: number | null;
  cost_npr: number | null;
  created_at: string;
};

function useLessons() {
  return useQuery({
    queryKey: ["ai-teacher-lessons"],
    queryFn: async () =>
      ((await api.get<ApiResponse<Lesson[]>>("/ai-teacher/lessons")).data.data || []).slice(0, 5),
    retry: false,
  });
}

function useSavedOutputs() {
  return useQuery({
    queryKey: ["ai-library"],
    queryFn: async () => {
      const r = await api.get("/ai/library");
      const items = (r.data?.data || []) as Array<{ id: string; tool_key: string; title: string; created_at: string }>;
      return items.filter((i) => i.tool_key !== "unknown").slice(0, 5);
    },
    retry: false,
  });
}

function useRiskAlerts() {
  return useQuery({
    queryKey: ["ai-risk-alerts"],
    queryFn: async () => {
      const r = await api.get("/ai-tools/insights/risk-alerts");
      return (r.data?.data || []) as Array<{
        student_id?: string; name?: string; student_name?: string;
        risk_score?: number; risk_level?: string; reasons?: string[];
      }>;
    },
    retry: false,
  });
}

// ── tabs ───────────────────────────────────────────────────────────────────

function TeacherTab() {
  const lessons = useLessons();
  return (
    <AppGate slug="ai_teacher">
      <div className="space-y-4">
        <div className="win11-card" style={{ marginBottom: 0 }}>
          <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div
              className="p-3 rounded-lg shrink-0"
              style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}
            >
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-[color:var(--w11-text-primary)]">AI Teacher — live whiteboard lessons</h3>
              <p className="text-sm mt-1 text-[color:var(--w11-text-secondary)]">
                A speaking, writing AI teacher grounded strictly in your published curriculum — pick a chapter
                section, a student, a language and a persona. · एउटा पाठ छान्नुहोस्, AI शिक्षकले बोर्डमा लेख्छ।
              </p>
            </div>
            <Link href="/dashboard/ai-teacher">
              <Button>
                <Play className="h-4 w-4 mr-2" /> Open AI Teacher
              </Button>
            </Link>
          </div>
        </div>

        <DataPanel
          title="Recent lessons"
          actions={
            <Link href="/dashboard/ai-teacher">
              <Button variant="ghost" size="sm">View all <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
            </Link>
          }
        >
          {lessons.isLoading ? (
            <PageLoader label="Loading lessons…" />
          ) : lessons.isError ? (
            <ErrorState title="Couldn't load lesson history" onRetry={() => lessons.refetch()} />
          ) : (lessons.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No lessons yet"
              body="Open the AI Teacher, pick a published chapter section, and start your first lesson."
              action={{ label: "Start a lesson", href: "/dashboard/ai-teacher" }}
              size="sm"
            />
          ) : (
            <ul className="divide-y divide-[color:var(--w11-border-subtle)]">
              {(lessons.data || []).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[color:var(--w11-text-primary)]">{l.topic}</p>
                    <p className="text-[11px] text-[color:var(--w11-text-secondary)]">
                      {l.chapters_completed} chapters
                      {l.duration_seconds ? ` · ${Math.round(l.duration_seconds / 60)} min` : ""}
                      {l.cost_npr ? ` · NPR ${l.cost_npr}` : ""}
                    </p>
                  </div>
                  <StatusChip status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </DataPanel>
      </div>
    </AppGate>
  );
}

function WorkbenchTab() {
  const saved = useSavedOutputs();
  return (
    <div className="space-y-4">
      <div className="win11-card" style={{ marginBottom: 0 }}>
        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="p-3 rounded-lg shrink-0" style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}>
            <Layers3 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[color:var(--w11-text-primary)]">AI Workbench — every tool, fully transparent</h3>
            <p className="text-sm mt-1 text-[color:var(--w11-text-secondary)]">
              The registry-backed workspace: schema-driven forms, AI Nutrition Facts (what the model can and
              cannot see), cost metering, and a saved library of outputs. · कुन tool ले कुन डाटा हेर्छ, सबै स्पष्ट।
            </p>
          </div>
          <Link href="/dashboard/ai-workbench">
            <Button>
              <ClipboardList className="h-4 w-4 mr-2" /> Open Workbench
            </Button>
          </Link>
        </div>
      </div>

      <DataPanel
        title="Saved outputs"
        actions={
          <Link href="/dashboard/ai-workbench">
            <Button variant="ghost" size="sm">Library <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
          </Link>
        }
      >
        {saved.isLoading ? (
          <PageLoader label="Loading saved outputs…" />
        ) : saved.isError ? (
          <ErrorState title="Couldn't load the library" onRetry={() => saved.refetch()} />
        ) : (saved.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={BookOpenCheck}
            title="Nothing saved yet"
            body="Any AI result you press Save on lands here, tagged with its tool."
            size="sm"
          />
        ) : (
          <ul className="divide-y divide-[color:var(--w11-border-subtle)]">
            {(saved.data || []).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[color:var(--w11-text-primary)]">{i.title}</p>
                  <p className="text-[11px] text-[color:var(--w11-text-secondary)]">
                    {i.tool_key} · {i.created_at ? new Date(i.created_at).toLocaleDateString("en-GB") : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DataPanel>
    </div>
  );
}

function InsightsTab() {
  const risk = useRiskAlerts();
  return (
    <div className="space-y-4">
      <DataPanel
        title={
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" style={{ color: "#d83b01" }} /> At-risk students
          </span>
        }
        actions={
          <Link href="/dashboard/ai-tools/insights">
            <Button variant="ghost" size="sm">Full insights <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
          </Link>
        }
      >
        {risk.isLoading ? (
          <PageLoader label="Checking risk signals…" />
        ) : risk.isError ? (
          <EmptyState
            title="Risk signal isn't available yet"
            body="The weekly AI insights beat computes at-risk students from attendance and marks — nothing to report until it has data."
            size="sm"
          />
        ) : (risk.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Brain}
            title="No students flagged right now"
            body="Risk detection reads attendance, marks and behaviour data. A clean list means clean data — not a dead model."
            action={{ label: "View weekly report", href: "/dashboard/ai-tools/insights" }}
            size="sm"
          />
        ) : (
          <ul className="divide-y divide-[color:var(--w11-border-subtle)]">
            {(risk.data || []).map((s, i) => (
              <li key={s.student_id || i} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[color:var(--w11-text-primary)]">
                    {s.name || s.student_name || "Student"}
                  </p>
                  <p className="text-[11px] text-[color:var(--w11-text-secondary)]">
                    {(s.reasons || []).join(" · ") || "AI risk signal"}
                  </p>
                </div>
                <StatusChip
                  status={s.risk_level || "warning"}
                  label={s.risk_score != null ? `${s.risk_level} · ${s.risk_score}` : s.risk_level}
                />
              </li>
            ))}
          </ul>
        )}
      </DataPanel>

      <div className="win11-infobar info p-4 text-sm">
        Weekly AI intelligence reports, daily briefs and the full school digest live on the{" "}
        <Link href="/dashboard/ai-tools/insights" className="underline font-medium">
          AI School Insights
        </Link>{" "}
        page — grounded in real attendance, marks and fee data, never invented.
      </div>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AiHubPage() {
  const params = useAOSRouteParams();
  const routerNavigate = useAOSRouterNavigate();

  const tabParam = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "tools",
  );

  // deep-link-with-prefill: ?tool=<key> forwards to the dedicated tool page,
  // carrying the remaining query params as field prefill.
  useEffect(() => {
    const tool = params.get("tool");
    if (!tool) return;
    const rest = new URLSearchParams();
    for (const [k, v] of params.entries()) {
      if (k !== "tab" && k !== "tool") rest.set(k, v);
    }
    const qs = rest.toString();
    routerNavigate(`/dashboard/ai-tools/${tool}${qs ? `?${qs}` : ""}`);
    // Runs once per mount; the URL is stable inside the window route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lessons = useLessons();
  const saved = useSavedOutputs();
  const risk = useRiskAlerts();

  const badges: Partial<Record<Tab, number>> = {
    tools: AI_TOOLS.length,
    teacher: lessons.data?.length || undefined,
    workbench: saved.data?.length || undefined,
    insights: risk.data?.length || undefined,
  };

  const go = (next: Tab) => {
    setTab(next);
    routerNavigate(`/dashboard/ai?tab=${next}`);
  };

  return (
    <AppGate slug="ai_suite">
      <AOSPage>
        <AOSPageHeader
          icon={<Sparkles className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="AI Hub"
          subtitle="Everything the AI pillar does — tools, live lessons, workbench and insights, under one roof · एउटै छातामुनि AI का सबै काम"
        />
        <AOSPageBody>
          <Tabs value={tab} onValueChange={(v) => go(v as Tab)}>
            <TabsList variant="pills">
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} badge={badges[t.id]}>
                  <t.icon className="h-3.5 w-3.5 mr-1" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="tools" className="mt-4">
              <ToolCatalog />
            </TabsContent>
            <TabsContent value="teacher" className="mt-4">
              <TeacherTab />
            </TabsContent>
            <TabsContent value="workbench" className="mt-4">
              <WorkbenchTab />
            </TabsContent>
            <TabsContent value="insights" className="mt-4">
              <InsightsTab />
            </TabsContent>
          </Tabs>
        </AOSPageBody>
      </AOSPage>
    </AppGate>
  );
}
