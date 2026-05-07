"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Badge }    from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/ui/spinner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Sparkles, Zap, Clock, AlertTriangle, Activity,
  Check, Settings, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const PROVIDER_COLORS: Record<string, string> = {
  groq:      "#7c3aed",
  anthropic: "#0ea5e9",
  none:      "#94a3b8",
  unknown:   "#94a3b8",
};

export default function AIUsageDashboardPage() {
  const qc = useQueryClient();

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
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" /> AI Token Hub
          </h1>
          <p className="text-muted-foreground text-sm">Per-school AI usage, quota, and cost management</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["ai-usage-stats", "ai-quota", "ai-usage-logs"] })}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* ── Quota not setup callout ────────────────────────────────── */}
      {quotaNotSetup && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4 flex items-center gap-4">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">AI quota not configured for this school</p>
              <p className="text-xs text-muted-foreground">Provision a default quota to start tracking and enforcing AI usage.</p>
            </div>
            <Button size="sm" onClick={() => initMutation.mutate()} disabled={initMutation.isPending}>
              Provision Default Quota
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Usage KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today",      value: usage.today?.toLocaleString()        ?? "—", icon: Zap,           percent: usage.daily_percent,   limit: quota?.daily_limit },
          { label: "This Month", value: usage.this_month?.toLocaleString()   ?? "—", icon: Activity,      percent: usage.monthly_percent, limit: quota?.monthly_limit },
          { label: "Daily Limit",  value: quota?.daily_limit?.toLocaleString()   ?? "—", icon: Settings, },
          { label: "Monthly Limit",value: quota?.monthly_limit?.toLocaleString() ?? "—", icon: Clock, },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-bold">{s.value}</p>
              {s.percent !== undefined && s.percent !== null && (
                <>
                  <Progress
                    value={s.percent}
                    className={`mt-2 h-1.5 ${s.percent > 90 ? "[&>div]:bg-red-500" : s.percent > 70 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-violet-500"}`}
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">{s.percent}% of {s.label.toLowerCase()} limit</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-sm">Daily Token Usage (Last 7 Days)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartTooltip formatter={(v: any) => [v.toLocaleString(), "Tokens"]} />
                    <Bar dataKey="tokens" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By provider */}
            <Card>
              <CardHeader><CardTitle className="text-sm">By Provider</CardTitle></CardHeader>
              <CardContent className="space-y-3 pt-2">
                {providers.length === 0
                  ? <p className="text-xs text-muted-foreground">No data yet</p>
                  : providers.map((p: any) => (
                    <div key={p.provider} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize font-medium">{p.provider}</span>
                        <span className="text-muted-foreground">{p.tokens?.toLocaleString()} tokens · {p.calls} calls</span>
                      </div>
                      <Progress
                        value={100}
                        className="h-2"
                        style={{ ["--progress-color" as any]: PROVIDER_COLORS[p.provider] ?? "#94a3b8" }}
                      />
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── By Feature ────────────────────────────────────────────── */}
        <TabsContent value="features">
          <Card>
            <CardHeader><CardTitle className="text-sm">Top Features by Token Usage (This Month)</CardTitle></CardHeader>
            <CardContent>
              {features.length === 0
                ? <p className="text-sm text-muted-foreground py-4 text-center">No AI calls this month yet.</p>
                : (
                  <div className="space-y-2">
                    {features.map((f: any) => {
                      const maxTokens = features[0]?.tokens ?? 1;
                      const pct = Math.round((f.tokens / maxTokens) * 100);
                      return (
                        <div key={f.feature} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{f.feature}</code>
                            <span className="text-muted-foreground">{f.tokens?.toLocaleString()} tokens · {f.call_count} calls</span>
                          </div>
                          <Progress value={pct} className="h-1.5 [&>div]:bg-violet-500" />
                        </div>
                      );
                    })}
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Call Logs ─────────────────────────────────────────────── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent AI Calls</CardTitle></CardHeader>
            <CardContent className="p-0">
              {logsLoading
                ? <div className="p-4"><PageLoader /></div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {["Feature","Model","Tokens","Latency","Status","Time"].map((h) => (
                            <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(logs) ? logs : []).map((log: any) => (
                          <tr key={log.id} className="border-b hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <code className="text-xs">{log.feature}</code>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{log.model}</td>
                            <td className="px-3 py-2 font-mono">{log.total_tokens?.toLocaleString()}</td>
                            <td className="px-3 py-2 text-muted-foreground">{log.latency_ms}ms</td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={log.status === "success" ? "secondary" : "destructive"}
                                className="text-xs"
                              >
                                {log.status === "success" ? <Check className="h-2.5 w-2.5 mr-1" /> : null}
                                {log.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                            </td>
                          </tr>
                        ))}
                        {!logsLoading && (Array.isArray(logs) ? logs : []).length === 0 && (
                          <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No AI calls logged yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Quota Settings ────────────────────────────────────────── */}
        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle className="text-sm">Quota Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {quota && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {[
                    { label: "Plan",          value: quota.plan_type },
                    { label: "Daily Limit",   value: quota.daily_limit?.toLocaleString() + " tokens" },
                    { label: "Monthly Limit", value: quota.monthly_limit?.toLocaleString() + " tokens" },
                    { label: "Alert At",      value: quota.alert_at + "%" },
                  ].map((r) => (
                    <div key={r.label} className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">{r.label}</p>
                      <p className="font-semibold mt-0.5">{r.value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
