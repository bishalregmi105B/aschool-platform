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
import { DataTable, type Column } from "@/components/ui/data-table";
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

const SENDER_COLUMNS: Column<TopSender>[] = [
  { key: "phone", label: "Phone", sortable: true, value: (s) => s.phone, render: (s) => <span className="font-medium">{s.phone}</span> },
  { key: "inbound_count", label: "Inbound Messages", align: "right", sortable: true, value: (s) => s.inbound_count },
  { key: "handled_count", label: "Handled", align: "right", sortable: true, value: (s) => s.handled_count },
  {
    key: "coverage",
    label: "Coverage",
    align: "right",
    sortable: true,
    value: (s) => (s.inbound_count > 0 ? s.handled_count / s.inbound_count : 0),
    render: (s) => (
      <Badge variant={s.handled_count >= s.inbound_count ? "secondary" : "destructive"}>
        {s.inbound_count > 0 ? `${Math.round((s.handled_count / s.inbound_count) * 100)}%` : "—"}
      </Badge>
    ),
  },
  {
    key: "last_message_at",
    label: "Last Message",
    sortable: true,
    value: (s) => s.last_message_at ?? "",
    render: (s) => (
      <span className="text-muted-foreground">
        {s.last_message_at ? new Date(s.last_message_at).toLocaleString() : "—"}
      </span>
    ),
  },
];

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
            <DataTable<TopSender>
              columns={SENDER_COLUMNS}
              rows={stats.top_senders}
              rowKey={(s) => s.phone}
              searchable
              searchPlaceholder="Search phone numbers…"
              exportFileName="whatsapp-top-senders"
              empty={{ icon: Users, title: "No inbound messages yet" }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
