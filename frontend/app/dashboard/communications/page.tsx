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
import { MessageSquare, Bell, FileText, Users, Mail } from "lucide-react";
import Link from "next/link";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";
import { ChevronRight } from "lucide-react";

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

  // Quick links — every /dashboard/communications subpage from the plugin
  // manifests (sms_notifications + whatsapp_bot ui.nav.subitems) plus the
  // sibling Notices hub. Counts ride on stats the page already fetched.
  const quickLinks = [
    { label: "Notices", desc: "School announcements and circulars", icon: "Bell", href: "/dashboard/notices", count: stats.notices_count },
    { label: "Announcements", desc: "Public website announcements", icon: "Megaphone", href: "/dashboard/communications/announcements" },
    { label: "Broadcast", desc: "Send SMS, email, or WhatsApp to groups", icon: "Send", href: "/dashboard/communications/broadcast", count: stats.broadcasts_sent },
    { label: "Diary", desc: "Class diary notes for parents", icon: "BookOpen", href: "/dashboard/communications/diary" },
    { label: "Gallery", desc: "Photo gallery on the school website", icon: "Image", href: "/dashboard/communications/gallery" },
    { label: "Home Sliders", desc: "Website homepage slider images", icon: "Layers", href: "/dashboard/communications/sliders" },
    { label: "Message Templates", desc: "Manage message templates", icon: "FileText", href: "/dashboard/communications/templates", count: stats.templates_count },
    { label: "WhatsApp Bot", desc: "Configure WhatsApp integration", icon: "MessageCircle", href: "/dashboard/communications/whatsapp" },
    { label: "Conversations", desc: "Two-way parent chats", icon: "MessageSquare", href: "/dashboard/communications/whatsapp/conversations" },
    { label: "WhatsApp AI", desc: "AI chat behaviour and settings", icon: "Settings", href: "/dashboard/communications/whatsapp/ai-settings" },
    { label: "WA Templates", desc: "WhatsApp message templates", icon: "FileText", href: "/dashboard/communications/whatsapp/templates" },
    { label: "WA Analytics", desc: "WhatsApp usage analytics", icon: "BarChart3", href: "/dashboard/communications/whatsapp/analytics" },
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

        {/* Quick links — 44px gradient icon tile + label, as next/link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {quickLinks.map((l) => {
            const Icon = ICON_MAP[l.icon] || ChevronRight;
            return (
              <Link key={l.href + l.label} href={l.href} className="block h-full">
                <div
                  className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                  style={{ cursor: "pointer", marginBottom: 0 }}
                >
                  <div
                    className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      background: SECTION_GRADIENTS.Communication,
                      boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                      {l.label}
                    </p>
                    <p className="text-[11px] leading-snug truncate" style={{ color: "var(--w11-text-secondary)" }}>
                      {l.desc}
                    </p>
                  </div>
                  {l.count != null && <span className="win11-chip subtle shrink-0">{l.count}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
