"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
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

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load communications stats. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  const sections = [
    { title: "Notices", desc: "School announcements and circulars", icon: Bell, href: "/dashboard/notices", count: stats.notices_count },
    { title: "Broadcast", desc: "Send SMS, email, or WhatsApp to groups", icon: Send, href: "/dashboard/communications/broadcast", count: stats.broadcasts_sent },
    { title: "Templates", desc: "Manage message templates", icon: FileText, href: "/dashboard/communications/templates", count: stats.templates_count },
    { title: "WhatsApp Bot", desc: "Configure WhatsApp integration", icon: MessageSquare, href: "/dashboard/communications/whatsapp", count: null },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Communications</h1><p className="text-muted-foreground">Manage school communications and notifications</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Messages Sent</p><p className="text-2xl font-bold">{stats.total_messages || 0}</p></div><Mail className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Active Notices</p><p className="text-2xl font-bold">{stats.notices_count || 0}</p></div><Bell className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Parents Reached</p><p className="text-2xl font-bold">{stats.parents_reached || 0}</p></div><Users className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Templates</p><p className="text-2xl font-bold">{stats.templates_count || 0}</p></div><FileText className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((s, i) => (
          <Link key={i} href={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-muted"><s.icon className="h-6 w-6" /></div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </div>
                  {s.count != null && <Badge variant="secondary">{s.count}</Badge>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
