"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { ColorField } from "@/components/ui/color-field";
import { VaultImageField } from "@/components/files/VaultImageField";
import { AlertCircle, Palette } from "lucide-react";
import Image from "next/image";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  DetailSplit,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  SettingsSection,
  SettingField,
  useSectionSave,
} from "@/app/dashboard/settings/settings-section";

/**
 * White-label Branding (plan 34 #56: A8 with live preview). One PATCH endpoint
 * (/schools/white-label/branding) but THREE independently-saved sections —
 * Identity, Colors & Fonts, Logo — each with change detection and helper text
 * (48.5). The right-hand preview reflects the live draft values so admins see
 * what parents will see before saving.
 */

type IdentityValues = {
  school_name_display: string;
  tagline: string;
  footer_text: string;
  hide_aschool_branding: boolean;
};
type AppearanceValues = {
  primary_color: string;
  secondary_color: string;
  font_family: string;
};
type LogoValues = { logo_url: string };

const DEFAULTS = {
  school_name_display: "",
  tagline: "",
  footer_text: "",
  hide_aschool_branding: false,
  primary_color: "#2563EB",
  secondary_color: "#10B981",
  font_family: "Inter",
  logo_url: "",
};

function BrandingContent() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<Record<string, unknown> | null>({
    queryKey: ["white-label-branding"],
    queryFn: async () => {
      const r = await api.get("/schools/white-label/branding");
      return (r.data?.data ?? r.data) as Record<string, unknown> | null;
    },
    retry: 1,
  });

  const identityInitial = useMemo<IdentityValues>(
    () => ({
      school_name_display: (data?.school_name_display as string) ?? DEFAULTS.school_name_display,
      tagline: (data?.tagline as string) ?? DEFAULTS.tagline,
      footer_text: (data?.footer_text as string) ?? DEFAULTS.footer_text,
      hide_aschool_branding: (data?.hide_aschool_branding as boolean) ?? DEFAULTS.hide_aschool_branding,
    }),
    [data],
  );
  const appearanceInitial = useMemo<AppearanceValues>(
    () => ({
      primary_color: (data?.primary_color as string) || DEFAULTS.primary_color,
      secondary_color: (data?.secondary_color as string) || DEFAULTS.secondary_color,
      font_family: (data?.font_family as string) || DEFAULTS.font_family,
    }),
    [data],
  );
  const logoInitial = useMemo<LogoValues>(
    () => ({ logo_url: (data?.logo_url as string) ?? DEFAULTS.logo_url }),
    [data],
  );

  async function patch(fields: Record<string, unknown>) {
    await api.patch("/schools/white-label/branding", fields);
    qc.invalidateQueries({ queryKey: ["white-label-branding"] });
    qc.invalidateQueries({ queryKey: ["white-label-overview"] });
  }

  const identity = useSectionSave<IdentityValues>(identityInitial, (v) => patch({ ...v }));
  const appearance = useSectionSave<AppearanceValues>(appearanceInitial, (v) => patch({ ...v }));
  const logo = useSectionSave<LogoValues>(logoInitial, (v) => patch({ ...v }));

  if (isLoading) return <AOSModuleLoadingState label="Loading branding settings…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<Palette className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Branding Settings"
          subtitle="Customize your school's brand identity"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-3 pt-6 text-center">
              <AlertCircle className="h-8 w-8" style={{ color: "var(--w11-danger, #c42b1c)" }} />
              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                Failed to load branding settings. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const previewName = identity.values.school_name_display || "Your School Name";
  const preview = (
    <div className="win11-card overflow-hidden" style={{ padding: 0 }}>
      <div className="p-4 text-white" style={{ background: `linear-gradient(120deg, ${appearance.values.primary_color}, ${appearance.values.secondary_color})` }}>
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-md flex items-center justify-center overflow-hidden shrink-0 relative"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            {logo.values.logo_url ? (
              <Image src={logo.values.logo_url} alt="" fill sizes="40px" className="object-contain" unoptimized />
            ) : (
              <span className="text-lg font-bold">{previewName.charAt(0) || "S"}</span>
            )}
          </div>
          <div style={{ fontFamily: appearance.values.font_family }}>
            <p className="font-bold leading-tight">{previewName}</p>
            {identity.values.tagline && (
              <p className="text-[11px] opacity-80 leading-tight">{identity.values.tagline}</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-4">
        <span
          className="inline-block px-3 py-1 rounded text-white text-[12px]"
          style={{ background: appearance.values.primary_color, fontFamily: appearance.values.font_family }}
        >
          Primary action
        </span>
        <p className="text-[11px] mt-3" style={{ color: "var(--w11-text-tertiary)" }}>
          {identity.values.footer_text || "© 2026 Your School"} ·{" "}
          {identity.values.hide_aschool_branding ? "branding hidden" : "Powered by ASchool shown"}
        </p>
      </div>
      <p className="px-4 pb-3 text-[10px] uppercase tracking-wide" style={{ color: "var(--w11-text-tertiary)" }}>
        Live preview of unsaved values
      </p>
    </div>
  );

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Palette className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Branding Settings"
        subtitle="Your school identity across the platform — save each section separately"
      />
      <AOSPageBody>
        <DetailSplit
          sidebar={<div className="space-y-2">{preview}</div>}
          sidebarWidth="300px"
        >
          <div className="space-y-4">
            <SettingsSection
              title="Identity"
              description="Names shown in the shell header, site title and email footers."
              form={identity}
            >
              <div className="space-y-4">
                <SettingField
                  label="Display Name"
                  htmlFor="wl-name"
                  help="Replaces the school name in the browser title, app switcher and public site header."
                >
                  <Input
                    id="wl-name"
                    value={identity.values.school_name_display}
                    onChange={(e) => identity.setField({ school_name_display: e.target.value })}
                    placeholder="School name shown to users"
                  />
                </SettingField>
                <SettingField
                  label="Tagline"
                  htmlFor="wl-tagline"
                  help="A short line under the name on the website header — leave empty to hide."
                >
                  <Input
                    id="wl-tagline"
                    value={identity.values.tagline}
                    onChange={(e) => identity.setField({ tagline: e.target.value })}
                    placeholder="Your school tagline"
                  />
                </SettingField>
                <SettingField
                  label="Footer Text"
                  htmlFor="wl-footer"
                  help="Copyright line at the bottom of the public website."
                >
                  <Input
                    id="wl-footer"
                    value={identity.values.footer_text}
                    onChange={(e) => identity.setField({ footer_text: e.target.value })}
                    placeholder="Footer copyright text"
                  />
                </SettingField>
                <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--w11-border-subtle)] px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--w11-text-primary)" }}>
                      Hide &ldquo;Powered by ASchool&rdquo; branding
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--w11-text-tertiary)" }}>
                      Removes the platform credit from the public site footer. Available on white-label plans.
                    </p>
                  </div>
                  <Switch
                    checked={identity.values.hide_aschool_branding}
                    onCheckedChange={(v) => identity.setField({ hide_aschool_branding: v })}
                    aria-label="Hide ASchool branding"
                  />
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Colors & Fonts"
              description="Theme tokens applied to the public website and shareable portals."
              form={appearance}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <SettingField
                    label="Primary Color"
                    help="Buttons, links and header accents across the site."
                  >
                    <ColorField
                      value={appearance.values.primary_color}
                      onChange={(v) => appearance.setField({ primary_color: v })}
                    />
                  </SettingField>
                  <SettingField
                    label="Secondary Color"
                    help="Gradients, hover accents and chart highlights."
                  >
                    <ColorField
                      value={appearance.values.secondary_color}
                      onChange={(v) => appearance.setField({ secondary_color: v })}
                    />
                  </SettingField>
                </div>
                <SettingField
                  label="Font Family"
                  help="Headings and body text on the public site (loaded from Google Fonts)."
                >
                  <AdvancedSelect
                    value={appearance.values.font_family}
                    onChange={(v) => appearance.setField({ font_family: v })}
                    options={[
                      { value: "Inter", label: "Inter" },
                      { value: "Poppins", label: "Poppins" },
                      { value: "Roboto", label: "Roboto" },
                      { value: "Open Sans", label: "Open Sans" },
                      { value: "Nunito", label: "Nunito" },
                    ]}
                  />
                </SettingField>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Logo"
              description="Square, transparent-background PNG works best."
              form={logo}
            >
              <div className="flex items-center gap-6">
                <div
                  className="h-20 w-20 border-2 border-dashed rounded-lg flex items-center justify-center text-xs overflow-hidden shrink-0 relative"
                  style={{
                    borderColor: "var(--w11-border-default)",
                    background: "var(--w11-control-hover)",
                    color: "var(--w11-text-secondary)",
                    borderRadius: "var(--w11-radius-lg)",
                  }}
                >
                  {logo.values.logo_url ? (
                    <Image src={logo.values.logo_url} alt="Logo" fill sizes="80px" className="object-contain rounded-lg" unoptimized />
                  ) : (
                    "No logo"
                  )}
                </div>
                <div className="flex-1">
                  <SettingField
                    label="School Logo"
                    help="Shown in the site header, browser tab (favicon) and login screens."
                  >
                    <VaultImageField
                      value={logo.values.logo_url || null}
                      onChange={(url) => logo.setField({ logo_url: url ?? "" })}
                      label="Logo"
                    />
                  </SettingField>
                </div>
              </div>
            </SettingsSection>
          </div>
        </DetailSplit>
      </AOSPageBody>
    </AOSPage>
  );
}

export default function BrandingPage() {
  return (
    <AppGate slug="white_label">
      <BrandingContent />
    </AppGate>
  );
}
