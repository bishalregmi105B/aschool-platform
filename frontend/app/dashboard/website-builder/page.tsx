"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { revalidateSchoolSite } from "@/lib/revalidate";
import { schoolSiteUrl } from "@/lib/site-domain";
import { Button } from "@/components/ui/button";
import { Globe, ExternalLink, Rocket } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

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

        {/* Navigation Cards */}
        <h2 className="text-lg font-semibold mt-4 mb-3" style={{ color: "var(--w11-text-primary)" }}>
          Manage Your Website
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NavCard
            href="/dashboard/website-builder/themes"
            icon="🎨"
            title="Themes"
            description="Browse 20 beautiful themes. 5 free, 15 pro."
          />
          <NavCard
            href="/dashboard/website-builder/pages"
            icon="📄"
            title="Pages"
            description="Add, edit, or rearrange your website pages."
          />
          <NavCard
            href="/dashboard/website-builder/ai-builder"
            icon="🤖"
            title="AI Builder"
            description="Describe your ideal website and AI builds it."
          />
          <NavCard
            href="/dashboard/website-builder/editor"
            icon="✏️"
            title="Section Editor"
            description="Drag & drop sections on each page."
          />
          <NavCard
            href="/dashboard/website-builder/domain"
            icon="🌐"
            title="Custom Domain"
            description="Connect your own domain name."
          />
          <NavCard
            href="/dashboard/website-builder/seo"
            icon="🔍"
            title="SEO Settings"
            description="Optimize your site for search engines."
          />
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}

function NavCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <a href={href} className="win11-card block hover:shadow-md transition-all group">
      <span className="text-3xl">{icon}</span>
      <h3
        className="font-semibold mt-2 group-hover:underline"
        style={{ color: "var(--w11-text-primary)" }}
      >
        {title}
      </h3>
      <p className="text-sm mt-1" style={{ color: "var(--w11-text-secondary)" }}>{description}</p>
    </a>
  );
}
