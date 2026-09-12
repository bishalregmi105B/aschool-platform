"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Palette, Globe, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

export default function WhiteLabelPage() {
  return <PluginGate slug="white_label"><WhiteLabelContent /></PluginGate>;
}

function WhiteLabelContent() {
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["white-label-overview"],
    queryFn: async () => { const r = await api.get("/schools/white-label/overview"); return r.data?.data ?? r.data; },
    retry: 1,
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading white-label status…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<Tag className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="White-Label Branding"
          subtitle="Custom branding, own domain, and ASchool branding removal"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-3 pt-6 text-center">
              <AlertCircle className="h-8 w-8" style={{ color: "var(--w11-accent)" }} />
              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                Failed to load white-label status. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const checklist = [
    { label: "School Logo Uploaded", done: data?.has_logo ?? false },
    { label: "Custom Domain Active", done: data?.custom_domain_active ?? false },
    { label: "Brand Colors Configured", done: data?.brand_colors_set ?? false },
    { label: "ASchool Branding Hidden", done: data?.branding_hidden ?? false },
    { label: "Custom Email Domain", done: data?.custom_email_domain ?? false },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Tag className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="White-Label Branding"
        subtitle="Custom branding, own domain, and ASchool branding removal"
      />
      <AOSPageBody>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Branding", desc: "Logo, colors, fonts, and school identity", icon: Palette, href: "/dashboard/white-label/branding" },
              { title: "Custom Domain", desc: "Point your own domain to this platform", icon: Globe, href: "/dashboard/white-label/domain" },
              { title: "Theme", desc: "App theme, colors, and UI customization", icon: Palette, href: "/dashboard/white-label/theme" },
            ].map((card) => (
              <DataPanel
                key={card.title}
                title={
                  <span className="inline-flex items-center gap-2 text-base">
                    <card.icon className="h-5 w-5" /> {card.title}
                  </span>
                }
              >
                <p className="text-sm mb-4" style={{ color: "var(--w11-text-secondary)" }}>{card.desc}</p>
                <Button size="sm" variant="outline" asChild className="w-full">
                  <Link href={card.href}>Configure</Link>
                </Button>
              </DataPanel>
            ))}
          </div>

          <DataPanel title="Setup Checklist">
            <div className="space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <CheckCircle
                    className="h-5 w-5"
                    style={{ color: item.done ? "var(--w11-accent)" : "var(--w11-text-tertiary)" }}
                  />
                  <span style={{ color: item.done ? "var(--w11-text-primary)" : "var(--w11-text-secondary)" }}>
                    {item.label}
                  </span>
                  <StatusChip
                    status={item.done ? "active" : "pending"}
                    label={item.done ? "Done" : "Pending"}
                  />
                </div>
              ))}
            </div>
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
