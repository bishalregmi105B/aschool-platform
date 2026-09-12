"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Save, School, Clock, Calendar, Shield, Globe, PenTool, ExternalLink, Settings } from "lucide-react";
import Link from "next/link";
import { useInstalledPlugins } from "@/lib/plugins";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FormSection,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

interface SchoolSettings {
  id: string;
  name: string;
  name_nepali: string;
  slug: string;
  type: string;
  level: string;
  district: string;
  municipality: string;
  phone: string;
  email: string;
  logo_url: string;
  banner_url: string;
  established_year_bs: string;
  /** JSONB blob persisted by PUT /schools/:id (column `settings`). */
  settings: Record<string, unknown>;
}

interface WebsiteStatus {
  is_published: boolean;
  subdomain?: string | null;
  default_domain?: string | null;
  custom_domain?: string | null;
  public_url?: string | null;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { isPluginInstalled } = useInstalledPlugins();
  const hasWebsiteBuilder = isPluginInstalled("website_builder");

  const { data: school, isLoading, isError, refetch } = useQuery({
    queryKey: ["school-settings"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/schools/current/settings");
      return res.data.data as SchoolSettings;
    },
    retry: 1,
  });

  const [form, setForm] = useState<Partial<SchoolSettings>>({});
  const [configJson, setConfigJson] = useState("");
  const [origin, setOrigin] = useState("");

  const { data: websiteStatus } = useQuery<WebsiteStatus | null>({
    queryKey: ["website-status-mini"],
    enabled: hasWebsiteBuilder,
    queryFn: async () => {
      try {
        const res = await api.get<ApiResponse<WebsiteStatus>>("/website-builder/status");
        return res.data.data || null;
      } catch {
        return null;
      }
    },
  });

  useEffect(() => {
    if (school) {
      setForm(school);
      setConfigJson(JSON.stringify(school.settings || {}, null, 2));
    }
  }, [school]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const saveMut = useMutation({
    mutationFn: async () => {
      let settings = school?.settings || {};
      try {
        settings = JSON.parse(configJson);
      } catch {
        // keep existing settings on invalid JSON
      }
      const res = await api.put<ApiResponse>(`/schools/${school?.id}`, {
        name: form.name,
        name_nepali: form.name_nepali,
        phone: form.phone,
        email: form.email,
        district: form.district,
        municipality: form.municipality,
        logo_url: form.logo_url,
        banner_url: form.banner_url,
        settings,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-settings"] });
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading settings…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="School Settings" subtitle="Manage your school profile and configuration" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                Failed to load school settings. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }
  if (!school) return (
    <AOSPage>
      <AOSPageHeader title="School Settings" subtitle="Manage your school profile and configuration" />
      <AOSPageBody>
        <p className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>
          Unable to load settings
        </p>
      </AOSPageBody>
    </AOSPage>
  );

  const previewUrl = `${origin || ""}/school/${school.slug}`;
  const liveUrl = websiteStatus?.public_url || (websiteStatus?.default_domain ? `https://${websiteStatus.default_domain}` : "");

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Settings className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="School Settings"
        subtitle="Manage your school profile and configuration"
        actions={
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Save className="h-4 w-4 mr-2" /> {saveMut.isPending ? "Saving..." : "Save Changes"}
          </Button>
        }
      />
      <AOSPageBody>
        <div className="space-y-4 max-w-3xl">
          {/* General Info */}
          <FormSection title={<span className="inline-flex items-center gap-2"><School className="h-4 w-4" /> General Information</span>}>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block" style={{ color: "var(--w11-text-primary)" }}>School Name (English)</label>
                  <Input value={form.name || ""} onChange={(e) => update("name", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block" style={{ color: "var(--w11-text-primary)" }}>School Name (नेपाली)</label>
                  <Input value={form.name_nepali || ""} onChange={(e) => update("name_nepali", e.target.value)} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block" style={{ color: "var(--w11-text-primary)" }}>Phone</label>
                  <Input value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block" style={{ color: "var(--w11-text-primary)" }}>Email</label>
                  <Input type="email" value={form.email || ""} onChange={(e) => update("email", e.target.value)} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block" style={{ color: "var(--w11-text-primary)" }}>District</label>
                  <Input value={form.district || ""} onChange={(e) => update("district", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block" style={{ color: "var(--w11-text-primary)" }}>Municipality</label>
                  <Input value={form.municipality || ""} onChange={(e) => update("municipality", e.target.value)} />
                </div>
              </div>
            </div>
          </FormSection>

          {/* Branding */}
          <FormSection title={<span className="inline-flex items-center gap-2"><Shield className="h-4 w-4" /> Branding</span>}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: "var(--w11-text-primary)" }}>Logo URL</label>
                <Input value={form.logo_url || ""} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: "var(--w11-text-primary)" }}>Banner URL</label>
                <Input value={form.banner_url || ""} onChange={(e) => update("banner_url", e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </FormSection>

          {/* Website */}
          <DataPanel
            title={<span className="inline-flex items-center gap-2"><Globe className="h-4 w-4" /> Website &amp; Design</span>}
          >
            <div className="space-y-4">
              <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                Preview your public website and open the dedicated website design page
              </p>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div
                  className="rounded-lg p-3"
                  style={{ border: "1px solid var(--w11-border-default)" }}
                >
                  <p className="mb-1" style={{ color: "var(--w11-text-secondary)" }}>Local Preview</p>
                  <p className="font-medium break-all" style={{ color: "var(--w11-text-primary)" }}>{previewUrl}</p>
                </div>
                <div
                  className="rounded-lg p-3"
                  style={{ border: "1px solid var(--w11-border-default)" }}
                >
                  <p className="mb-1" style={{ color: "var(--w11-text-secondary)" }}>Live Domain</p>
                  <p className="font-medium break-all" style={{ color: "var(--w11-text-primary)" }}>{liveUrl || "Not published yet"}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Slug: {school.slug}</Badge>
                {hasWebsiteBuilder ? (
                  <StatusChip
                    status={websiteStatus?.is_published ? "published" : "draft"}
                    label={websiteStatus?.is_published ? "Published" : "Draft"}
                  />
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
                <Button asChild>
                  <Link href="/dashboard/website-builder">
                    <PenTool className="h-4 w-4 mr-2" /> Open Design Center
                  </Link>
                </Button>
              </div>
            </div>
          </DataPanel>

          {/* Meta */}
          <DataPanel title={<span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4" /> School Metadata</span>}>
            <div className="space-y-3">
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span style={{ color: "var(--w11-text-secondary)" }}>Type:</span>{" "}
                  <Badge variant="outline">{school.type}</Badge>
                </div>
                <div>
                  <span style={{ color: "var(--w11-text-secondary)" }}>Level:</span>{" "}
                  <Badge variant="outline">{school.level}</Badge>
                </div>
                <div>
                  <span style={{ color: "var(--w11-text-secondary)" }}>Established:</span>{" "}
                  <Badge variant="outline">{school.established_year_bs || "—"} BS</Badge>
                </div>
              </div>
              <div>
                <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>Slug:</span>{" "}
                <code
                  className="text-sm px-2 py-0.5 rounded"
                  style={{
                    background: "var(--w11-control-hover)",
                    color: "var(--w11-text-primary)",
                    fontFamily: "var(--w11-font-mono)",
                  }}
                >
                  {school.slug}
                </code>
              </div>
            </div>
          </DataPanel>

          {/* Advanced Config JSON */}
          <DataPanel
            title={<span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" /> Advanced Configuration</span>}
          >
            <p className="text-[12px] mb-3" style={{ color: "var(--w11-text-secondary)" }}>
              JSON configuration for working days, hours, academic year, etc.
            </p>
            <Textarea
              className="font-mono text-xs"
              rows={10}
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
            />
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
