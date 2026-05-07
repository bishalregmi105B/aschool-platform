"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ApiResponse } from "@/lib/api";
import { useInstalledPlugins } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import {
  Globe,
  ExternalLink,
  Brush,
  Search,
  Rocket,
  FileCode,
  Palette,
  LayoutTemplate,
  Sparkles,
} from "lucide-react";

interface SchoolSettings {
  id: string;
  slug: string;
  logo_url?: string;
  banner_url?: string;
}

interface WebsiteStatus {
  is_published: boolean;
  subdomain?: string | null;
  default_domain?: string | null;
  custom_domain?: string | null;
  domain_verified?: boolean;
  public_url?: string | null;
  theme_slug?: string | null;
  pages_count?: number;
}

interface SeoSettings {
  meta_title?: string;
  meta_description?: string;
  og_image_url?: string;
}

export default function WebsiteDesignSettingsPage() {
  const queryClient = useQueryClient();
  const { isPluginInstalled } = useInstalledPlugins();
  const hasWebsiteBuilder = isPluginInstalled("website_builder");

  const [origin, setOrigin] = useState("");
  const [branding, setBranding] = useState({ logo_url: "", banner_url: "" });
  const [seo, setSeo] = useState({ meta_title: "", meta_description: "", og_image_url: "" });

  const { data: school, isLoading: loadingSchool } = useQuery({
    queryKey: ["school-settings", "website-design"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SchoolSettings>>("/schools/current");
      return res.data.data;
    },
  });

  const { data: websiteStatus, isLoading: loadingStatus } = useQuery<WebsiteStatus | null>({
    queryKey: ["website-status", "settings-design-center"],
    enabled: hasWebsiteBuilder,
    queryFn: async () => {
      try {
        const res = await api.get<ApiResponse<WebsiteStatus>>("/website-builder/status");
        return res.data.data;
      } catch {
        return null;
      }
    },
  });

  const { data: seoData } = useQuery<SeoSettings | null>({
    queryKey: ["website-seo", "settings-design-center"],
    enabled: hasWebsiteBuilder,
    queryFn: async () => {
      try {
        const res = await api.get<ApiResponse<SeoSettings>>("/website-builder/seo");
        return res.data.data;
      } catch {
        return null;
      }
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!school) return;
    setBranding({
      logo_url: school.logo_url || "",
      banner_url: school.banner_url || "",
    });
  }, [school]);

  useEffect(() => {
    if (!seoData) return;
    setSeo({
      meta_title: seoData.meta_title || "",
      meta_description: seoData.meta_description || "",
      og_image_url: seoData.og_image_url || "",
    });
  }, [seoData]);

  const saveBranding = useMutation({
    mutationFn: async () => {
      if (!school?.id) throw new Error("School not found");
      return api.put(`/schools/${school.id}`, {
        logo_url: branding.logo_url,
        banner_url: branding.banner_url,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-settings"] });
      queryClient.invalidateQueries({ queryKey: ["school-settings", "website-design"] });
      toast.success("Website branding updated");
    },
    onError: () => toast.error("Could not update branding"),
  });

  const saveSeo = useMutation({
    mutationFn: async () => {
      return api.put("/website-builder/seo", {
        meta_title: seo.meta_title,
        meta_description: seo.meta_description,
        og_image_url: seo.og_image_url,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-seo"] });
      queryClient.invalidateQueries({ queryKey: ["website-seo", "settings-design-center"] });
      toast.success("SEO settings updated");
    },
    onError: () => toast.error("Could not update SEO"),
  });

  const publishWebsite = useMutation({
    mutationFn: async () => api.post("/website-builder/publish"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-status"] });
      queryClient.invalidateQueries({ queryKey: ["website-status", "settings-design-center"] });
      toast.success("Website published");
    },
    onError: () => toast.error("Could not publish website"),
  });

  const unpublishWebsite = useMutation({
    mutationFn: async () => api.post("/website-builder/unpublish"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-status"] });
      queryClient.invalidateQueries({ queryKey: ["website-status", "settings-design-center"] });
      toast.success("Website unpublished");
    },
    onError: () => toast.error("Could not unpublish website"),
  });

  const previewUrl = useMemo(() => {
    if (!school?.slug) return "";
    return `${origin || ""}/school/${school.slug}`;
  }, [origin, school?.slug]);

  const liveUrl = useMemo(() => {
    if (!hasWebsiteBuilder) return "";
    if (websiteStatus?.public_url) return websiteStatus.public_url;
    if (websiteStatus?.default_domain) return `https://${websiteStatus.default_domain}`;
    return "";
  }, [hasWebsiteBuilder, websiteStatus]);

  if (loadingSchool || (hasWebsiteBuilder && loadingStatus)) {
    return <PageLoader />;
  }

  if (!school) {
    return <p className="text-center py-8 text-muted-foreground">Unable to load website settings.</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brush className="h-6 w-6" /> Website Design Center
          </h1>
          <p className="text-muted-foreground">
            Edit all core website design parts from one dedicated page.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/settings">Back to Settings</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Website Access</CardTitle>
          <CardDescription>Open local preview and live website links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="border rounded-lg p-3">
              <p className="text-muted-foreground mb-1">Local Preview</p>
              <p className="font-medium break-all">{previewUrl || "—"}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-muted-foreground mb-1">Live URL</p>
              <p className="font-medium break-all">{liveUrl || "Not published yet"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Slug: {school.slug}</Badge>
            {hasWebsiteBuilder ? (
              <Badge variant={websiteStatus?.is_published ? "success" : "secondary"}>
                {websiteStatus?.is_published ? "Published" : "Draft"}
              </Badge>
            ) : (
              <Badge variant="outline">Website Builder plugin not installed</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" /> Open Preview
              </a>
            </Button>
            {hasWebsiteBuilder && liveUrl && (
              <Button variant="outline" asChild>
                <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Open Live Site
                </a>
              </Button>
            )}
            {hasWebsiteBuilder && (
              websiteStatus?.is_published ? (
                <Button
                  variant="outline"
                  onClick={() => unpublishWebsite.mutate()}
                  disabled={unpublishWebsite.isPending}
                >
                  {unpublishWebsite.isPending ? "Updating..." : "Unpublish"}
                </Button>
              ) : (
                <Button onClick={() => publishWebsite.mutate()} disabled={publishWebsite.isPending}>
                  <Rocket className="h-4 w-4 mr-2" />
                  {publishWebsite.isPending ? "Publishing..." : "Publish Website"}
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Logo and banner displayed on your public website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input
              value={branding.logo_url}
              onChange={(e) => setBranding((prev) => ({ ...prev, logo_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label>Banner URL</Label>
            <Input
              value={branding.banner_url}
              onChange={(e) => setBranding((prev) => ({ ...prev, banner_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveBranding.mutate()} disabled={saveBranding.isPending}>
              {saveBranding.isPending ? "Saving..." : "Save Branding"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> SEO Quick Edit</CardTitle>
          <CardDescription>Update meta title, description, and social preview image</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasWebsiteBuilder ? (
            <p className="text-sm text-muted-foreground">
              Install the Website Builder plugin to manage SEO from this page.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Meta Title</Label>
                <Input
                  value={seo.meta_title}
                  onChange={(e) => setSeo((prev) => ({ ...prev, meta_title: e.target.value }))}
                  placeholder="School name and primary tagline"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea
                  rows={4}
                  value={seo.meta_description}
                  onChange={(e) => setSeo((prev) => ({ ...prev, meta_description: e.target.value }))}
                  placeholder="Short summary for search results"
                />
              </div>
              <div className="space-y-2">
                <Label>OG Image URL</Label>
                <Input
                  value={seo.og_image_url}
                  onChange={(e) => setSeo((prev) => ({ ...prev, og_image_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveSeo.mutate()} disabled={saveSeo.isPending}>
                  {saveSeo.isPending ? "Saving..." : "Save SEO"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileCode className="h-5 w-5" /> Design Tools</CardTitle>
          <CardDescription>Open detailed pages for complete website customization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/website-builder/themes"><Palette className="h-4 w-4 mr-2" /> Themes</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/website-builder/pages"><LayoutTemplate className="h-4 w-4 mr-2" /> Pages</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/website-builder/ai-builder"><Sparkles className="h-4 w-4 mr-2" /> AI Builder</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/website-builder/editor">Section Editor</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/website-builder/domain">Domain</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/website-builder/seo">Full SEO</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}