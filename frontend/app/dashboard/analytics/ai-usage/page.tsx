"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FormSection,
} from "@/components/aos/kit/page-kit";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Sparkles, Zap, Clock, AlertTriangle, Activity,
  Check, Settings, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";

const ACCENT = "#0067c0";

type AiLog = {
  id: string;
  feature?: string | null;
  model?: string | null;
  total_tokens?: number | null;
  latency_ms?: number | null;
  status?: string | null;
  created_at?: string | null;
};

export default function AIUsageDashboardPage() {
  const qc = useQueryClient();
  const logColumns: Column<AiLog>[] = useMemo(
    () => [
      {
        key: "feature",
        label: "Feature",
        sortable: true,
        value: (l) => l.feature ?? "",
        render: (l) => <code className="text-xs">{l.feature}</code>,
      },
      { key: "model", label: "Model", value: (l) => l.model ?? "" },
      {
        key: "tokens",
        label: "Tokens",
        align: "right",
        sortable: true,
        value: (l) => l.total_tokens ?? 0,
        render: (l) => <span className="font-mono">{l.total_tokens?.toLocaleString()}</span>,
      },
      {
        key: "latency",
        label: "Latency",
        align: "right",
        value: (l) => l.latency_ms ?? 0,
        render: (l) => <span>{l.latency_ms}ms</span>,
      },
      {
        key: "status",
        label: "Status",
        value: (l) => l.status ?? "",
        render: (l) => (
          <span className={`win11-chip ${l.status === "success" ? "success" : "error"} text-xs`}>
            {l.status === "success" ? <Check className="mr-1 inline h-2.5 w-2.5" /> : null}
            {l.status}
          </span>
        ),
      },
      {
        key: "time",
        label: "Time",
        value: (l) => l.created_at ?? "",
        render: (l) => (
          <span>{l.created_at ? new Date(l.created_at).toLocaleString() : "—"}</span>
        ),
      },
    ],
    [],
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["ai-usage-stats"],
    queryFn:  async () => { const r = await api.get("/ai-usage/stats"); return r.data?.data; },
  });

  const { data: quota, isLoading: quotaLoading } = useQuery({
    queryKey: ["ai-quota"],
    queryFn:  async () => { const r = await api.get("/ai-usage/quota"); return r.data?.data; },
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["ai-usage-logs"],
    queryFn:  async () => { const r = await api.get("/ai-usage/logs?per_page=25"); return r.data?.data; },
  });

  const initMutation = useMutation({
    mutationFn: async () => { const r = await api.post("/ai-usage/quota/init"); return r.data?.data; },
    onSuccess: () => { toast.success("Default quota provisioned"); qc.invalidateQueries({ queryKey: ["ai-quota"] }); qc.invalidateQueries({ queryKey: ["ai-usage-stats"] }); },
    onError: () => toast.error("Failed to provision quota"),
  });

  const isLoading = statsLoading || quotaLoading;

  // Inline quota update form
  const [dailyLimit,   setDailyLimit]   = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, number> = {};
      if (dailyLimit)   body.daily_limit   = Number(dailyLimit);
      if (monthlyLimit) body.monthly_limit = Number(monthlyLimit);
      const r = await api.put("/ai-usage/quota", body);
      return r.data?.data;
    },
    onSuccess: () => {
      toast.success("Quota updated");
      qc.invalidateQueries({ queryKey: ["ai-quota"] });
      qc.invalidateQueries({ queryKey: ["ai-usage-stats"] });
      setDailyLimit(""); setMonthlyLimit("");
    },
    onError: () => toast.error("Failed to update quota"),
  });

  if (isLoading) return <PageLoader />;

  const usage   = stats?.usage ?? {};
  const chart   = stats?.daily_chart ?? [];
  const features = stats?.top_features ?? [];
  const providers = stats?.by_provider ?? [];

  const quotaNotSetup = !quota;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Sparkles className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="AI Token Hub"
        subtitle="Per-school AI usage, quota, and cost management"
        actions={
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["ai-usage-stats", "ai-quota", "ai-usage-logs"] })}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        }
      />
      <AOSPageBody>
        <div className="space-y-6 p-1">
        {/* ── Quota not setup callout ────────────────────────────────── */}
        {quotaNotSetup && (
          <div className="win11-infobar warning flex items-center gap-4">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">AI quota not configured for this school</p>
              <p className="text-xs">Provision a default quota to start tracking and enforcing AI usage.</p>
            </div>
            <Button size="sm" onClick={() => initMutation.mutate()} disabled={initMutation.isPending}>
              Provision Default Quota
            </Button>
          </div>
        )}

        {/* ── Usage KPI Cards ──────────────────────────────────────────── */}
        <StatGrid min={200} className="mb-0">
          <KpiCard
            label="Today"
            value={usage.today?.toLocaleString() ?? "—"}
            icon={<Zap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
            footnote={usage.daily_percent != null ? `${usage.daily_percent}% of today limit` : undefined}
          />
          <KpiCard
            label="This Month"
            value={usage.this_month?.toLocaleString() ?? "—"}
            icon={<Activity className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
            footnote={usage.monthly_percent != null ? `${usage.monthly_percent}% of monthly limit` : undefined}
          />
          <KpiCard label="Daily Limit" value={quota?.daily_limit?.toLocaleString() ?? "—"} icon={<Settings className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Monthly Limit" value={quota?.monthly_limit?.toLocaleString() ?? "—"} icon={<Clock className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </StatGrid>

        <Tabs defaultValue="usage">
          <TabsList>
            <TabsTrigger value="usage">Usage Charts</TabsTrigger>
            <TabsTrigger value="features">By Feature</TabsTrigger>
            <TabsTrigger value="logs">Call Logs</TabsTrigger>
            <TabsTrigger value="settings">Quota Settings</TabsTrigger>
          </TabsList>

          {/* ── Usage Charts ──────────────────────────────────────────── */}
          <TabsContent value="usage" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 7-day chart */}
              <DataPanel className="md:col-span-2" title="Daily Token Usage (Last 7 Days)">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--w11-border-subtle)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartTooltip formatter={(v: any) => [v.toLocaleString(), "Tokens"]} />
                    <Bar dataKey="tokens" fill={ACCENT} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </DataPanel>

              {/* By provider */}
              <DataPanel title="By Provider" bodyClassName="space-y-3 pt-2">
                {providers.length === 0
                  ? <p className="text-xs text-[color:var(--w11-text-secondary)]">No data yet</p>
                  : providers.map((p: any) => (
                    <div key={p.provider} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize font-medium">{p.provider}</span>
                        <span className="text-[color:var(--w11-text-secondary)]">{p.tokens?.toLocaleString()} tokens · {p.calls} calls</span>
                      </div>
                      <Progress value={100} className="h-2" style={{ ["--progress-color" as any]: ACCENT }} />
                    </div>
                  ))}
              </DataPanel>
            </div>
          </TabsContent>

          {/* ── By Feature ────────────────────────────────────────────── */}
          <TabsContent value="features">
            <DataPanel title="Top Features by Token Usage (This Month)">
              {features.length === 0
                ? <p className="text-sm py-4 text-center text-[color:var(--w11-text-secondary)]">No AI calls this month yet.</p>
                : (
                  <div className="space-y-2">
                    {features.map((f: any) => {
                      const maxTokens = features[0]?.tokens ?? 1;
                      const pct = Math.round((f.tokens / maxTokens) * 100);
                      return (
                        <div key={f.feature} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--w11-control-bg)" }}>{f.feature}</code>
                            <span className="text-[color:var(--w11-text-secondary)]">{f.tokens?.toLocaleString()} tokens · {f.call_count} calls</span>
                          </div>
                          <Progress value={pct} className="h-1.5" style={{ ["--progress-color" as any]: ACCENT }} />
                        </div>
                      );
                    })}
                  </div>
                )}
            </DataPanel>
          </TabsContent>

          {/* ── Call Logs ─────────────────────────────────────────────── */}
          <TabsContent value="logs">
            <DataPanel title="Recent AI Calls" bodyClassName="p-0">
              {logsLoading
                ? <div className="p-4"><PageLoader /></div>
                : (
                  <DataTable
                    columns={logColumns}
                    rows={(Array.isArray(logs) ? logs : []) as AiLog[]}
                    rowKey={(log) => log.id}
                    dense
                    exportFileName="ai-usage-logs"
                    empty={{ title: "No AI calls logged yet." }}
                  />
                )}
            </DataPanel>
          </TabsContent>

          {/* ── Quota Settings ────────────────────────────────────────── */}
          <TabsContent value="settings">
            <FormSection title="Quota Configuration">
              <div className="space-y-4">
                {quota && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {[
                      { label: "Plan",          value: quota.plan_type },
                      { label: "Daily Limit",   value: quota.daily_limit?.toLocaleString() + " tokens" },
                      { label: "Monthly Limit", value: quota.monthly_limit?.toLocaleString() + " tokens" },
                      { label: "Alert At",      value: quota.alert_at + "%" },
                    ].map((r) => (
                      <div key={r.label} className="p-3 rounded-lg" style={{ background: "var(--w11-control-hover)" }}>
                        <p className="text-xs text-[color:var(--w11-text-secondary)]">{r.label}</p>
                        <p className="font-semibold mt-0.5">{r.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-[color:var(--w11-border-subtle)] pt-4 space-y-3">
                  <p className="text-sm font-medium">Update Limits</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Daily Limit (tokens)</Label>
                      <Input
                        type="number" placeholder={quota?.daily_limit?.toString() ?? "10000"}
                        value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Monthly Limit (tokens)</Label>
                      <Input
                        type="number" placeholder={quota?.monthly_limit?.toString() ?? "100000"}
                        value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm" onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending || (!dailyLimit && !monthlyLimit)}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </FormSection>
          </TabsContent>
        </Tabs>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
