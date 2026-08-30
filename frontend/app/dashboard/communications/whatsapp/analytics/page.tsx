"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Inbox,
  MessageSquare,
  Send,
  Users,
} from "lucide-react";

import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartTooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TimelinePoint {
  date: string;
  inbound: number;
  outbound: number;
}

interface TopSender {
  phone: string;
  inbound_count: number;
  handled_count: number;
  last_message_at: string | null;
}

interface WhatsAppAnalytics {
  days: number;
  timeline: TimelinePoint[];
  inbound_last_window: number;
  handled_last_window: number;
  handled_pct_last_window: number | null;
  totals: { inbound: number; outbound: number };
  top_senders: TopSender[];
}

export default function WhatsAppAnalyticsPage() {
  return (
    <PluginGate slug="whatsapp_bot">
      <WhatsAppAnalyticsContent />
    </PluginGate>
  );
}

function WhatsAppAnalyticsContent() {
  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery<WhatsAppAnalytics>({
    queryKey: ["whatsapp-analytics"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/whatsapp-bot/analytics?days=14");
      return res.data.data as WhatsAppAnalytics;
    },
    retry: 1,
  });

  if (isLoading) return <PageLoader />;

  if (isError || !stats) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load analytics. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const kpis = [
    { label: `Inbound (last ${stats.days}d)`, value: stats.inbound_last_window, icon: Inbox },
    { label: `Outbound (last ${stats.days}d)`, value: stats.timeline.reduce((sum, d) => sum + d.outbound, 0), icon: Send },
    {
      label: "Handled %",
      value: stats.handled_pct_last_window === null ? "—" : `${stats.handled_pct_last_window}%`,
      icon: CheckCircle2,
      hint: `${stats.handled_last_window} of ${stats.inbound_last_window} got a reply`,
    },
    {
      label: "All-time messages",
      value: stats.totals.inbound + stats.totals.outbound,
      icon: MessageSquare,
      hint: `${stats.totals.inbound} in · ${stats.totals.outbound} out`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/communications/whatsapp">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">WhatsApp Analytics</h1>
          <p className="text-muted-foreground">
            Message volume, reply coverage, and top senders — counted live from WhatsApp messages.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
              {kpi.hint && <p className="mt-0.5 text-xs text-muted-foreground">{kpi.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Inbound vs Outbound — last {stats.days} days</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No WhatsApp messages in the last {stats.days} days.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.timeline}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RechartTooltip />
                <Legend />
                <Bar dataKey="inbound" name="Inbound" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="outbound" name="Outbound" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Top Senders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.top_senders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No inbound messages yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Phone", "Inbound Messages", "Handled", "Coverage", "Last Message"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.top_senders.map((sender) => (
                    <tr key={sender.phone} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{sender.phone}</td>
                      <td className="px-3 py-2">{sender.inbound_count}</td>
                      <td className="px-3 py-2">{sender.handled_count}</td>
                      <td className="px-3 py-2">
                        <Badge variant={sender.handled_count >= sender.inbound_count ? "secondary" : "destructive"}>
                          {sender.inbound_count > 0
                            ? `${Math.round((sender.handled_count / sender.inbound_count) * 100)}%`
                            : "—"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {sender.last_message_at ? new Date(sender.last_message_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
