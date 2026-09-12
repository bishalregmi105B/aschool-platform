"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Tag, Palette, Globe, CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

// Quick links — the white_label manifest subitems (Branding, Custom Domain,
// Theme) mapped to their frontend routes.
const QUICK_LINKS = [
  { label: "Branding", desc: "Logo, colors, fonts, and school identity", icon: "Palette", href: "/dashboard/white-label/branding" },
  { label: "Custom Domain", desc: "Point your own domain to this platform", icon: "Globe", href: "/dashboard/white-label/domain" },
  { label: "Theme", desc: "App theme, colors, and UI customization", icon: "PaintBucket", href: "/dashboard/white-label/theme" },
];

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

  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Tag className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="White-Label Branding"
        subtitle="Custom branding, own domain, and ASchool branding removal"
      />
      <AOSPageBody>
        <div className="space-y-4">
          {/* Dashboard — KPI stat grid from the overview this page loads */}
          <StatGrid>
            <KpiCard
              label="Setup Progress"
              value={`${doneCount}/${checklist.length}`}
              denominator="steps done"
              icon={<Tag className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
            />
            <KpiCard
              label="School Logo"
              value={data?.has_logo ? "Uploaded" : "Not set"}
              color={data?.has_logo ? "#107c10" : "var(--w11-text-secondary)"}
              icon={<Palette className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            />
            <KpiCard
              label="Custom Domain"
              value={data?.custom_domain_active ? "Active" : "Default"}
              color={data?.custom_domain_active ? "#107c10" : "var(--w11-text-secondary)"}
              icon={<Globe className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            />
            <KpiCard
              label="ASchool Branding"
              value={data?.branding_hidden ? "Hidden" : "Visible"}
              color={data?.branding_hidden ? "#107c10" : "#d83b01"}
              icon={<CheckCircle className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            />
          </StatGrid>

          {/* Quick links — 44px gradient icon tile + label, as next/link */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {QUICK_LINKS.map((l) => {
              const Icon = ICON_MAP[l.icon] || ChevronRight;
              return (
                <Link key={l.href} href={l.href} className="block h-full">
                  <div
                    className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                    style={{ cursor: "pointer", marginBottom: 0 }}
                  >
                    <div
                      className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        background: SECTION_GRADIENTS["Design & Web"],
                        boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                        {l.label}
                      </p>
                      <p className="text-[11px] leading-snug" style={{ color: "var(--w11-text-secondary)" }}>
                        {l.desc}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
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
