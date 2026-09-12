"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { revalidateSchoolSite } from "@/lib/revalidate";
import { schoolSiteUrl } from "@/lib/site-domain";
import { Button } from "@/components/ui/button";
import { Globe, ExternalLink, Rocket, ChevronRight } from "lucide-react";
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
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

// Quick links — every website_builder manifest subitem plus the Custom
// Domain surface (frontend route).
const QUICK_LINKS = [
  { label: "Themes", desc: "Browse 20 beautiful themes. 5 free, 15 pro.", icon: "Palette", href: "/dashboard/website-builder/themes" },
  { label: "Pages", desc: "Add, edit, or rearrange your website pages.", icon: "FileText", href: "/dashboard/website-builder/pages" },
  { label: "AI Builder", desc: "Describe your ideal website and AI builds it.", icon: "Sparkles", href: "/dashboard/website-builder/ai-builder" },
  { label: "Section Editor", desc: "Drag & drop sections on each page.", icon: "Layers", href: "/dashboard/website-builder/editor" },
  { label: "Custom Domain", desc: "Connect your own domain name.", icon: "Globe", href: "/dashboard/website-builder/domain" },
  { label: "SEO Settings", desc: "Optimize your site for search engines.", icon: "TrendingUp", href: "/dashboard/website-builder/seo" },
  { label: "Website Settings", desc: "Global site configuration.", icon: "Settings", href: "/dashboard/settings/website-design" },
];

interface WebsiteStatus {
  is_published: boolean;
  theme_slug: string;
  subdomain: string;
  default_domain?: string | null;
  custom_domain: string | null;
  domain_verified: boolean;
  pages_count: number;
  last_updated: string;
  public_url?: string | null;
}

export default function WebsiteBuilderPage() {
  // website_builder is a paid premium plugin — gate the page like the other
  // premium plugin pages (it was previously reachable ungated).
  return (
    <PluginGate slug="website_builder">
      <WebsiteBuilderContent />
    </PluginGate>
  );
}

function WebsiteBuilderContent() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "quick-actions">("overview");

  const { data: status, isLoading, isError, refetch } = useQuery<WebsiteStatus>({
    queryKey: ["website-status"],
    queryFn: () => api.get("/website-builder/status").then((r) => r.data.data),
    retry: 1,
  });

  const publishMut = useMutation({
    mutationFn: () => api.post("/website-builder/publish"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-status"] });
      revalidateSchoolSite(status?.subdomain);
    },
  });

  const unpublishMut = useMutation({
    mutationFn: () => api.post("/website-builder/unpublish"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-status"] });
      revalidateSchoolSite(status?.subdomain);
    },
  });

  if (isLoading) {
    return <AOSModuleLoadingState label="Loading website status…" />;
  }

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Website Builder" subtitle="Build and manage your school's public website" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                Failed to load website status. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Globe className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="🌐 Website Builder"
        subtitle="Build and manage your school's public website"
        actions={
          <div className="flex gap-2">
            {status?.is_published ? (
              <>
                <Button variant="outline" asChild>
                  <a
                    href={status.public_url || schoolSiteUrl(status.subdomain)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Live Site
                  </a>
                </Button>
                <Button variant="outline" onClick={() => unpublishMut.mutate()} disabled={unpublishMut.isPending}>
                  Unpublish
                </Button>
              </>
            ) : (
              <Button onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
                <Rocket className="h-4 w-4 mr-2" />
                {publishMut.isPending ? "Publishing..." : "🚀 Publish Website"}
              </Button>
            )}
          </div>
        }
      />
      <AOSPageBody>
        {/* Status Banner */}
        <div className={`win11-infobar ${status?.is_published ? "success" : "warning"} mb-4`}>
          <span className="text-lg">{status?.is_published ? "✅" : "⚠️"}</span>
          <div>
            <span className="font-medium">
              {status?.is_published
                ? "Your website is live!"
                : "Your website is not published yet."}
            </span>
            {status?.is_published && status.custom_domain && (
              <p className="mt-1 text-sm">
                Custom domain: <strong>{status.custom_domain}</strong>{" "}
                {status.domain_verified ? "(✓ verified)" : "(⏳ pending verification)"}
              </p>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <StatGrid min={200}>
          <KpiCard label="Pages" value={status?.pages_count || 0} icon={<span>📄</span>} />
          <KpiCard label="Theme" value={status?.theme_slug || "none"} icon={<span>🎨</span>} />
          <KpiCard
            label="Status"
            value={status?.is_published ? "Live" : "Draft"}
            icon={<span>{status?.is_published ? "🟢" : "🟡"}</span>}
            color={status?.is_published ? undefined : "var(--w11-text-secondary)"}
          />
          <KpiCard label="Domain" value={status?.custom_domain || "Default"} icon={<span>🔗</span>} />
        </StatGrid>

        {/* Quick Links — every subpage, 44px gradient tile + label 13px/600 */}
        <h2 className="text-lg font-semibold mt-4 mb-3" style={{ color: "var(--w11-text-primary)" }}>
          Manage Your Website
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
      </AOSPageBody>
    </AOSPage>
  );
}
