"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  School,
  Clock,
  Calendar,
  Shield,
  Globe,
  PenTool,
  ExternalLink,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useInstalledApps } from "@/lib/apps";
import { VaultImageField } from "@/components/files/VaultImageField";
import {
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { SettingsPage } from "./settings-page";
import { SettingsSection, SettingField, useSectionSave } from "./settings-section";

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

type GeneralValues = {
  name: string;
  name_nepali: string;
  phone: string;
  email: string;
  district: string;
  municipality: string;
};
type BrandingValues = { logo_url: string; banner_url: string };
type AdvancedValues = { configJson: string };

export default function SchoolSettingsPage() {
  const queryClient = useQueryClient();
  const { isAppInstalled } = useInstalledApps();
  const hasWebsiteBuilder = isAppInstalled("website_builder");

  const { data: school, isLoading, isError, refetch } = useQuery({
    queryKey: ["school-settings"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/schools/current/settings");
      return res.data.data as SchoolSettings;
    },
    retry: 1,
  });

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

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  /** PUT /schools/:id populates by key, so each section can send just its own. */
  async function putSchool(fields: Record<string, unknown>) {
    await api.put<ApiResponse>(`/schools/${school?.id}`, fields);
    queryClient.invalidateQueries({ queryKey: ["school-settings"] });
  }

  const generalInitial = useMemo<GeneralValues>(
    () => ({
      name: school?.name ?? "",
      name_nepali: school?.name_nepali ?? "",
      phone: school?.phone ?? "",
      email: school?.email ?? "",
      district: school?.district ?? "",
      municipality: school?.municipality ?? "",
    }),
    [school],
  );
  const brandingInitial = useMemo<BrandingValues>(
    () => ({ logo_url: school?.logo_url ?? "", banner_url: school?.banner_url ?? "" }),
    [school],
  );
  const advancedInitial = useMemo<AdvancedValues>(
    () => ({ configJson: JSON.stringify(school?.settings ?? {}, null, 2) }),
    [school],
  );

  const general = useSectionSave<GeneralValues & Record<string, unknown>>(
    generalInitial as GeneralValues & Record<string, unknown>,
    async (v) => {
      await putSchool({
        name: v.name,
        name_nepali: v.name_nepali,
        phone: v.phone,
        email: v.email,
        district: v.district,
        municipality: v.municipality,
      });
    },
  );
  const branding = useSectionSave<BrandingValues & Record<string, unknown>>(
    brandingInitial as BrandingValues & Record<string, unknown>,
    async (v) => {
      await putSchool({ logo_url: v.logo_url, banner_url: v.banner_url });
    },
  );
  const advanced = useSectionSave<AdvancedValues & Record<string, unknown>>(
    advancedInitial as AdvancedValues & Record<string, unknown>,
    async (v) => {
      await putSchool({ settings: JSON.parse(v.configJson) });
    },
    {
      validate: (v) => {
        try {
          JSON.parse(v.configJson);
          return null;
        } catch {
          return "Advanced configuration is not valid JSON — fix it before saving.";
        }
      },
    },
  );

  if (isLoading) return <AOSModuleLoadingState label="Loading settings…" />;

  if (isError || !school) {
    return (
      <SettingsPage
        active="school"
        icon={<Settings className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="School Settings"
        subtitle="Manage your school profile and configuration"
      >
        <DataPanel className="max-w-2xl mx-auto">
          <div className="py-10 text-center space-y-3">
            <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
              Failed to load school settings. Please try again.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </DataPanel>
      </SettingsPage>
    );
  }

  const previewUrl = `${origin || ""}/school/${school.slug}`;
  const liveUrl =
    websiteStatus?.public_url ||
    (websiteStatus?.default_domain ? `https://${websiteStatus.default_domain}` : "");

  return (
    <SettingsPage
      active="school"
      icon={<Settings className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
      title="School Settings"
      subtitle="Identity, branding and platform configuration for your school"
    >
      <div className="space-y-4">
        {/* ── General Information ─────────────────────────────────────────── */}
        <SettingsSection
          title={
            <span className="inline-flex items-center gap-2">
              <School className="h-4 w-4" /> General Information
            </span>
          }
          description="Shown across reports, receipts and the public website."
          form={general}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <SettingField
              label="School Name (English)"
              htmlFor="name-en"
              help="The official name — appears in headers, certificates and the public site title."
            >
              <Input
                id="name-en"
                value={general.values.name}
                onChange={(e) => general.setField({ name: e.target.value })}
              />
            </SettingField>
            <SettingField
              label="School Name (नेपाली)"
              htmlFor="name-ne"
              help="Shown beside the English name on bilingual screens and the public site."
            >
              <Input
                id="name-ne"
                value={general.values.name_nepali}
                onChange={(e) => general.setField({ name_nepali: e.target.value })}
              />
            </SettingField>
            <SettingField
              label="Phone"
              htmlFor="phone"
              help="The contact number parents and visitors see on the website and SMS alerts."
            >
              <Input
                id="phone"
                value={general.values.phone}
                onChange={(e) => general.setField({ phone: e.target.value })}
              />
            </SettingField>
            <SettingField
              label="Email"
              htmlFor="email"
              help="Reply-to address for system emails and the public contact section."
            >
              <Input
                id="email"
                type="email"
                value={general.values.email}
                onChange={(e) => general.setField({ email: e.target.value })}
              />
            </SettingField>
            <SettingField
              label="District"
              htmlFor="district"
              help="Used in the public site address and IEMIS-style reporting."
            >
              <Input
                id="district"
                value={general.values.district}
                onChange={(e) => general.setField({ district: e.target.value })}
              />
            </SettingField>
            <SettingField
              label="Municipality"
              htmlFor="municipality"
              help="Shown with the district in the website footer and official documents."
            >
              <Input
                id="municipality"
                value={general.values.municipality}
                onChange={(e) => general.setField({ municipality: e.target.value })}
              />
            </SettingField>
          </div>
        </SettingsSection>

        {/* ── Branding ────────────────────────────────────────────────────── */}
        <SettingsSection
          title={
            <span className="inline-flex items-center gap-2">
              <Shield className="h-4 w-4" /> Branding
            </span>
          }
          description="Logo and banner used by the shell, reports and the public website."
          form={branding}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <SettingField
              label="Logo"
              help="A square image (≥ 256px) shown in the window chrome, receipts and site header."
            >
              <VaultImageField
                value={branding.values.logo_url || null}
                onChange={(url) => branding.setField({ logo_url: url ?? "" })}
                label="Logo"
              />
            </SettingField>
            <SettingField
              label="Banner"
              help="Wide image (≈ 1600×400) used as the public site hero backdrop."
            >
              <VaultImageField
                value={branding.values.banner_url || null}
                onChange={(url) => branding.setField({ banner_url: url ?? "" })}
                label="Banner"
              />
            </SettingField>
          </div>
        </SettingsSection>

        {/* ── Website & Design (read-only links) ──────────────────────────── */}
        <SettingsSection
          title={
            <span className="inline-flex items-center gap-2">
              <Globe className="h-4 w-4" /> Website &amp; Design
            </span>
          }
          description="Your public site lives under the Website Builder plugin — nothing to save here."
          hideActions
        >
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg p-3" style={{ border: "1px solid var(--w11-border-default)" }}>
                <p className="mb-1" style={{ color: "var(--w11-text-secondary)" }}>Local Preview</p>
                <p className="font-medium break-all" style={{ color: "var(--w11-text-primary)" }}>{previewUrl}</p>
              </div>
              <div className="rounded-lg p-3" style={{ border: "1px solid var(--w11-border-default)" }}>
                <p className="mb-1" style={{ color: "var(--w11-text-secondary)" }}>Live Domain</p>
                <p className="font-medium break-all" style={{ color: "var(--w11-text-primary)" }}>{liveUrl || "Not published yet"}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Slug: {school.slug}</Badge>
              {hasWebsiteBuilder ? (
                <StatusChip
                  status={websiteStatus?.is_published ? "published" : "pending"}
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
        </SettingsSection>

        {/* ── Metadata (read-only) ────────────────────────────────────────── */}
        <SettingsSection
          title={
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" /> School Metadata
            </span>
          }
          description="Provisioned with your account — contact support to change these."
          hideActions
        >
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
        </SettingsSection>

        {/* ── Advanced Configuration ──────────────────────────────────────── */}
        <SettingsSection
          title={
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4" /> Advanced Configuration
            </span>
          }
          description="Working days, hours and academic-year settings consumed by features across the platform."
          form={advanced}
        >
          <SettingField
            label="Configuration (JSON)"
            help="Invalid JSON is rejected before saving — the raw configuration blob for advanced integrations."
            htmlFor="config-json"
          >
            <Textarea
              id="config-json"
              className="font-mono text-xs"
              rows={10}
              value={advanced.values.configJson}
              onChange={(e) => advanced.setField({ configJson: e.target.value })}
            />
          </SettingField>
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}
