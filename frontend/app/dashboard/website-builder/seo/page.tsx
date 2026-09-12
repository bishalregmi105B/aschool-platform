"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import { toast } from "sonner";
import { revalidateSchoolSite } from "@/lib/revalidate";
import { schoolSiteHost, schoolSiteUrl } from "@/lib/site-domain";
import { VaultImageField } from "@/components/files/VaultImageField";
import { Search } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

/**
 * Shape the backend GET/PUT /website-builder/seo endpoints actually use:
 * the column is `og_image_url` (the old page read/wrote `og_image`, so the
 * OG image never loaded and never saved). google_site_verification /
 * sitemap_enabled / robots_txt are UI-only until the backend persists them.
 */
interface SeoSettings {
  meta_title: string;
  meta_description: string;
  og_image: string;
  google_analytics_id: string;
  google_site_verification: string;
  sitemap_enabled: boolean;
  robots_txt: string;
}

interface SeoApiResponse {
  meta_title?: string | null;
  meta_description?: string | null;
  og_image_url?: string | null;
  google_analytics_id?: string | null;
  robots_txt?: string | null;
}

const EMPTY_FORM: SeoSettings = {
  meta_title: "",
  meta_description: "",
  og_image: "",
  google_analytics_id: "",
  google_site_verification: "",
  sitemap_enabled: true,
  robots_txt: "User-agent: *\nAllow: /",
};

/** API → form: null-safe defaults + og_image_url → og_image mapping. */
function toForm(raw: SeoApiResponse | undefined): SeoSettings {
  return {
    meta_title: raw?.meta_title ?? "",
    meta_description: raw?.meta_description ?? "",
    og_image: raw?.og_image_url ?? "",
    google_analytics_id: raw?.google_analytics_id ?? "",
    google_site_verification: "",
    sitemap_enabled: true,
    robots_txt: raw?.robots_txt ?? "User-agent: *\nAllow: /",
  };
}

const inputStyle: React.CSSProperties = {
  background: "var(--w11-control-bg)",
  color: "var(--w11-text-primary)",
  border: "1px solid var(--w11-control-border)",
  borderRadius: "var(--w11-radius-md)",
  padding: "8px 12px",
};

export default function SeoPage() {
  const qc = useQueryClient();

  const { data: seo, isLoading, isError, refetch } = useQuery<SeoApiResponse>({
    queryKey: ["website-seo"],
    queryFn: () => api.get("/website-builder/seo").then((r) => r.data.data),
    retry: 1,
  });

  const [form, setForm] = useState<SeoSettings | null>(null);

  // Sync the form when fresh server data arrives. (The old
  // `if (seo && !form) setForm(seo)` ran setState during render — an
  // anti-pattern that crashed the page — and fed null fields straight into
  // `.length`, throwing "cannot read properties of null".)
  useEffect(() => {
    if (seo) setForm(toForm(seo));
  }, [seo]);

  const saveMut = useMutation({
    mutationFn: (data: SeoSettings) =>
      api.put("/website-builder/seo", {
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        og_image_url: data.og_image,
        google_analytics_id: data.google_analytics_id,
        google_site_verification: data.google_site_verification,
        sitemap_enabled: data.sitemap_enabled,
        robots_txt: data.robots_txt,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-seo"] });
      revalidateSchoolSite();
      toast.success("SEO settings saved");
    },
    onError: () => toast.error("Failed to save SEO settings"),
  });

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="🔍 SEO Settings" subtitle="Optimize your school website for search engines" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                Failed to load SEO settings. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  if (isLoading || !form) {
    return <AOSModuleLoadingState label="Loading SEO settings…" />;
  }

  const updateField = (key: keyof SeoSettings, value: string | boolean) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Search className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="🔍 SEO Settings"
        subtitle="Optimize your school website for search engines"
      />
      <AOSPageBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate(form);
          }}
          className="space-y-4 max-w-2xl"
        >
          {/* Meta Title */}
          <DataPanel title="Basic SEO">
            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  Meta Title
                </label>
                <input
                  type="text"
                  value={form.meta_title}
                  onChange={(e) => updateField("meta_title", e.target.value)}
                  placeholder="Your School Name — Quality Education in Nepal"
                  className="w-full text-sm"
                  style={inputStyle}
                  maxLength={60}
                />
                <p className="text-xs mt-1" style={{ color: "var(--w11-text-tertiary)" }}>
                  {form.meta_title.length}/60 characters
                </p>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  Meta Description
                </label>
                <textarea
                  value={form.meta_description}
                  onChange={(e) => updateField("meta_description", e.target.value)}
                  rows={3}
                  placeholder="Short description of your school for search engine results"
                  className="w-full text-sm"
                  style={inputStyle}
                  maxLength={160}
                />
                <p className="text-xs mt-1" style={{ color: "var(--w11-text-tertiary)" }}>
                  {form.meta_description.length}/160 characters
                </p>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  OG Image
                </label>
                <VaultImageField
                  value={form.og_image || null}
                  onChange={(url) => updateField("og_image", url ?? "")}
                  label="OG image"
                />
                <p className="text-xs mt-1" style={{ color: "var(--w11-text-tertiary)" }}>
                  Image shown when your website is shared on social media (1200x630px recommended)
                </p>
              </div>
            </div>
          </DataPanel>

          {/* Search Preview */}
          <DataPanel title="Search Preview">
            <div
              className="border rounded p-4"
              style={{
                background: "var(--w11-card-bg)",
                borderColor: "var(--w11-border-default)",
              }}
            >
              <p
                className="text-lg hover:underline cursor-pointer"
                style={{ color: "var(--w11-accent)" }}
              >
                {form.meta_title || "Your School Name"}
              </p>
              <p className="text-sm" style={{ color: "var(--w11-text-tertiary)" }}>
                {schoolSiteHost("yourschool")}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--w11-text-secondary)" }}>
                {form.meta_description || "Add a meta description to control how your school appears in search results."}
              </p>
            </div>
          </DataPanel>

          {/* Analytics */}
          <DataPanel title="Analytics & Verification">
            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  Google Analytics ID
                </label>
                <input
                  type="text"
                  value={form.google_analytics_id}
                  onChange={(e) => updateField("google_analytics_id", e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="w-full text-sm"
                  style={{ ...inputStyle, fontFamily: "var(--w11-font-mono)" }}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  Google Site Verification
                </label>
                <input
                  type="text"
                  value={form.google_site_verification}
                  onChange={(e) => updateField("google_site_verification", e.target.value)}
                  placeholder="Verification code from Google Search Console"
                  className="w-full text-sm"
                  style={{ ...inputStyle, fontFamily: "var(--w11-font-mono)" }}
                />
              </div>
            </div>
          </DataPanel>

          {/* Sitemap & Robots */}
          <DataPanel title="Sitemap & Crawling">
            <div className="space-y-4">
              <FormCheckbox
                label="Auto-generate sitemap.xml"
                description="Sitemap & crawling"
                checked={form.sitemap_enabled}
                onCheckedChange={(v) => updateField("sitemap_enabled", v)}
              />

              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  Custom robots.txt
                </label>
                <textarea
                  value={form.robots_txt}
                  onChange={(e) => updateField("robots_txt", e.target.value)}
                  rows={4}
                  placeholder={`User-agent: *\nAllow: /\nSitemap: ${schoolSiteUrl("yourschool", "/sitemap.xml")}`}
                  className="w-full text-sm"
                  style={{ ...inputStyle, fontFamily: "var(--w11-font-mono)" }}
                />
              </div>
            </div>
          </DataPanel>

          <div className="flex justify-end">
            <button type="submit" disabled={saveMut.isPending} className="win11-btn accent">
              {saveMut.isPending ? "Saving..." : "Save SEO Settings"}
            </button>
          </div>
        </form>
      </AOSPageBody>
    </AOSPage>
  );
}
