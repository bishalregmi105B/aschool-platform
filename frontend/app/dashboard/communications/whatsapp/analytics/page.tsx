"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Inbox,
  MessageSquare,
  Send,
  Users,
} from "lucide-react";

import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
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
      <span className={`win11-chip ${s.handled_count >= s.inbound_count ? "subtle" : "error"}`}>
        {s.inbound_count > 0 ? `${Math.round((s.handled_count / s.inbound_count) * 100)}%` : "—"}
      </span>
    ),
  },
  {
    key: "last_message_at",
    label: "Last Message",
    sortable: true,
    value: (s) => s.last_message_at ?? "",
    render: (s) => (
      <span style={{ color: "var(--w11-text-secondary)" }}>
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

  if (isLoading) return <AOSModuleLoadingState label="Loading analytics…" />;

  if (isError || !stats) {
    return (
      <AOSPage>
        <AOSPageHeader title="WhatsApp Analytics" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load analytics. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
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
    <AOSPage>
      <AOSPageHeader
        icon={<MessageSquare className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="WhatsApp Analytics"
        subtitle={`Message volume, reply coverage, and top senders over the last ${stats.days} days`}
      />
      <AOSPageBody>
        <StatGrid>
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              footnote={kpi.hint}
              icon={<kpi.icon className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            />
          ))}
        </StatGrid>

        <DataPanel
          className="mb-4"
          title={<span className="text-sm">Inbound vs Outbound — last {stats.days} days</span>}
        >
          {stats.timeline.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>
              No WhatsApp messages in the last {stats.days} days.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.timeline}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--w11-border-default)]" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RechartTooltip />
                <Legend />
                <Bar dataKey="inbound" name="Inbound" fill="#0067c0" radius={[3, 3, 0, 0]} />
                <Bar dataKey="outbound" name="Outbound" fill="#107c10" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DataPanel>

        <DataPanel
          title={
            <span className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
              Top Senders
            </span>
          }
        >
          {stats.top_senders.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>No inbound messages yet.</p>
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
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
