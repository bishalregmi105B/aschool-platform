"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
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
import { MessageSquare, Bell, Send, FileText, Users, Mail } from "lucide-react";
import Link from "next/link";

export default function CommunicationsPage() {
  return <PluginGate slug="communications"><CommsContent /></PluginGate>;
}

function CommsContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["communications-stats"],
    queryFn: async () => { const r = await api.get("/communications/stats"); return r.data?.data; },
  });

  const stats = data || {};

  if (isLoading) return <AOSModuleLoadingState label="Loading communications…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Communications" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load communications stats. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const sections = [
    { title: "Notices", desc: "School announcements and circulars", icon: Bell, href: "/dashboard/notices", count: stats.notices_count },
    { title: "Broadcast", desc: "Send SMS, email, or WhatsApp to groups", icon: Send, href: "/dashboard/communications/broadcast", count: stats.broadcasts_sent },
    { title: "Templates", desc: "Manage message templates", icon: FileText, href: "/dashboard/communications/templates", count: stats.templates_count },
    { title: "WhatsApp Bot", desc: "Configure WhatsApp integration", icon: MessageSquare, href: "/dashboard/communications/whatsapp", count: null },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<MessageSquare className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Communications"
        subtitle={`${stats.total_messages || 0} messages sent · ${stats.notices_count || 0} active notices · ${stats.parents_reached || 0} parents reached`}
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard label="Messages Sent" value={stats.total_messages || 0} icon={<Mail className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />} />
          <KpiCard label="Active Notices" value={stats.notices_count || 0} icon={<Bell className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />} />
          <KpiCard label="Parents Reached" value={stats.parents_reached || 0} icon={<Users className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />} />
          <KpiCard label="Templates" value={stats.templates_count || 0} icon={<FileText className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />} />
        </StatGrid>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((s, i) => (
            <Link key={i} href={s.href} className="block">
              <div className="win11-card h-full transition-shadow hover:shadow-md" style={{ cursor: "pointer" }}>
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg" style={{ background: "var(--w11-control-hover)" }}>
                    <s.icon className="h-6 w-6" style={{ color: "var(--w11-accent)" }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold" style={{ color: "var(--w11-text-primary)" }}>{s.title}</h3>
                    <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{s.desc}</p>
                  </div>
                  {s.count != null && <span className="win11-chip subtle">{s.count}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
