"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { revalidateSchoolSite } from "@/lib/revalidate";
import { schoolSiteUrl } from "@/lib/site-domain";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load website status. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🌐 Website Builder</h1>
          <p className="text-gray-500 text-sm mt-1">
            Build and manage your school&apos;s public website
          </p>
        </div>
        <div className="flex gap-2">
          {status?.is_published ? (
            <>
              <a
                href={status.public_url || schoolSiteUrl(status.subdomain)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                🔗 View Live Site
              </a>
              <button
                onClick={() => unpublishMut.mutate()}
                disabled={unpublishMut.isPending}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
              >
                Unpublish
              </button>
            </>
          ) : (
            <button
              onClick={() => publishMut.mutate()}
              disabled={publishMut.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {publishMut.isPending ? "Publishing..." : "🚀 Publish Website"}
            </button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={`rounded-lg p-4 border ${
          status?.is_published
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-yellow-50 border-yellow-200 text-yellow-800"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{status?.is_published ? "✅" : "⚠️"}</span>
          <span className="font-medium">
            {status?.is_published
              ? "Your website is live!"
              : "Your website is not published yet."}
          </span>
        </div>
        {status?.is_published && status.custom_domain && (
          <p className="mt-1 text-sm">
            Custom domain: <strong>{status.custom_domain}</strong>{" "}
            {status.domain_verified ? "(✓ verified)" : "(⏳ pending verification)"}
          </p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pages" value={status?.pages_count || 0} icon="📄" />
        <StatCard label="Theme" value={status?.theme_slug || "none"} icon="🎨" />
        <StatCard
          label="Status"
          value={status?.is_published ? "Live" : "Draft"}
          icon={status?.is_published ? "🟢" : "🟡"}
        />
        <StatCard label="Domain" value={status?.custom_domain || "Default"} icon="🔗" />
      </div>

      {/* Navigation Cards */}
      <h2 className="text-lg font-semibold mt-4">Manage Your Website</h2>
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
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="border rounded-lg p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-sm truncate max-w-[120px]">{String(value)}</p>
      </div>
    </div>
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
    <a
      href={href}
      className="border rounded-lg p-5 hover:shadow-md hover:border-blue-300 transition-all group block"
    >
      <span className="text-3xl">{icon}</span>
      <h3 className="font-semibold mt-2 group-hover:text-blue-600">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </a>
  );
}
