"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { Button } from "@/components/ui/button";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { AlertCircle, Palette } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  SettingsSection,
  SettingField,
  useSectionSave,
} from "@/app/dashboard/settings/settings-section";

/**
 * White-label Theme settings (A8): appearance tokens and colors save
 * separately with change detection; the preview strip always reflects the
 * current drafts so the admin sees the effect before saving.
 */

type AppearanceValues = {
  mode: string;
  sidebar_style: string;
  card_style: string;
  density: string;
};
type ColorValues = {
  accent_color: string;
  sidebar_color: string;
  sidebar_text_color: string;
};

const DEFAULT_APPEARANCE: AppearanceValues = {
  mode: "light",
  sidebar_style: "default",
  card_style: "rounded",
  density: "comfortable",
};
const DEFAULT_COLORS: ColorValues = {
  accent_color: "#2563EB",
  sidebar_color: "#1e293b",
  sidebar_text_color: "#f8fafc",
};

function ThemeColorInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-10 cursor-pointer"
        style={{ border: "1px solid var(--w11-control-border)", borderRadius: "var(--w11-radius-sm)" }}
      />
      <span
        className="text-sm"
        style={{ color: "var(--w11-text-secondary)", fontFamily: "var(--w11-font-mono)" }}
      >
        {value}
      </span>
    </div>
  );
}

function ThemeContent() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<Record<string, unknown> | null>({
    queryKey: ["white-label-theme"],
    queryFn: async () => {
      const r = await api.get("/schools/white-label/theme");
      return (r.data?.data ?? r.data) as Record<string, unknown> | null;
    },
    retry: 1,
  });

  const appearanceInitial = useMemo<AppearanceValues>(
    () => ({
      mode: (data?.mode as string) ?? DEFAULT_APPEARANCE.mode,
      sidebar_style: (data?.sidebar_style as string) ?? DEFAULT_APPEARANCE.sidebar_style,
      card_style: (data?.card_style as string) ?? DEFAULT_APPEARANCE.card_style,
      density: (data?.density as string) ?? DEFAULT_APPEARANCE.density,
    }),
    [data],
  );
  const colorsInitial = useMemo<ColorValues>(
    () => ({
      accent_color: (data?.accent_color as string) ?? DEFAULT_COLORS.accent_color,
      sidebar_color: (data?.sidebar_color as string) ?? DEFAULT_COLORS.sidebar_color,
      sidebar_text_color: (data?.sidebar_text_color as string) ?? DEFAULT_COLORS.sidebar_text_color,
    }),
    [data],
  );

  async function patch(fields: Record<string, unknown>) {
    await api.patch("/schools/white-label/theme", fields);
    qc.invalidateQueries({ queryKey: ["white-label-theme"] });
    qc.invalidateQueries({ queryKey: ["white-label-overview"] });
  }

  const appearance = useSectionSave<AppearanceValues>(appearanceInitial, (v) => patch({ ...v }));
  const colors = useSectionSave<ColorValues>(colorsInitial, (v) => patch({ ...v }));

  if (isLoading) return <AOSModuleLoadingState label="Loading theme settings…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<Palette className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Theme Settings"
          subtitle="Customize the admin app appearance"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-3 pt-6 text-center">
              <AlertCircle className="h-8 w-8" style={{ color: "var(--w11-danger, #c42b1c)" }} />
              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                Failed to load theme settings. Please try again.
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

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Palette className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Theme Settings"
        subtitle="Customize the admin app appearance — each section saves independently"
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SettingsSection
            title="Appearance"
            description="Layout choices applied to the admin shell."
            form={appearance}
          >
            <div className="space-y-4">
              <SettingField label="Color Mode" help="Dark, light, or follow the operating-system setting.">
                <AdvancedSelect
                  value={appearance.values.mode}
                  onChange={(v) => appearance.setField({ mode: v })}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                    { value: "system", label: "Follow System" },
                  ]}
                />
              </SettingField>
              <SettingField label="Sidebar Style" help="Compact and icon-only sidebars free up horizontal space on small screens.">
                <AdvancedSelect
                  value={appearance.values.sidebar_style}
                  onChange={(v) => appearance.setField({ sidebar_style: v })}
                  options={[
                    { value: "default", label: "Default" },
                    { value: "compact", label: "Compact" },
                    { value: "icon-only", label: "Icon Only" },
                  ]}
                />
              </SettingField>
              <SettingField label="Card Style" help="Corner treatment of panels across the admin app.">
                <AdvancedSelect
                  value={appearance.values.card_style}
                  onChange={(v) => appearance.setField({ card_style: v })}
                  options={[
                    { value: "rounded", label: "Rounded" },
                    { value: "sharp", label: "Sharp" },
                    { value: "flat", label: "Flat" },
                  ]}
                />
              </SettingField>
              <SettingField label="UI Density" help="Row and control heights — compact fits more per screen.">
                <AdvancedSelect
                  value={appearance.values.density}
                  onChange={(v) => appearance.setField({ density: v })}
                  options={[
                    { value: "comfortable", label: "Comfortable" },
                    { value: "compact", label: "Compact" },
                    { value: "spacious", label: "Spacious" },
                  ]}
                />
              </SettingField>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Colors"
            description="Accent and sidebar colors for the admin shell."
            form={colors}
          >
            <div className="space-y-4">
              <SettingField label="Accent Color" help="Buttons, links and active navigation markers.">
                <ThemeColorInput
                  id="wl-accent"
                  value={colors.values.accent_color}
                  onChange={(v) => colors.setField({ accent_color: v })}
                />
              </SettingField>
              <SettingField label="Sidebar Background" help="The dark rail behind module navigation.">
                <ThemeColorInput
                  id="wl-sidebar"
                  value={colors.values.sidebar_color}
                  onChange={(v) => colors.setField({ sidebar_color: v })}
                />
              </SettingField>
              <SettingField label="Sidebar Text" help="Menu labels inside the sidebar — keep high contrast.">
                <ThemeColorInput
                  id="wl-sidebar-text"
                  value={colors.values.sidebar_text_color}
                  onChange={(v) => colors.setField({ sidebar_text_color: v })}
                />
              </SettingField>
            </div>
          </SettingsSection>

          <DataPanel className="lg:col-span-2" title="Preview (unsaved values)">
            <div className="flex h-32 rounded-lg overflow-hidden border border-[var(--w11-border-default)]">
              <div
                className="w-48 h-full flex flex-col p-3 gap-2"
                style={{ backgroundColor: colors.values.sidebar_color, color: colors.values.sidebar_text_color }}
              >
                <div className="text-xs font-bold opacity-80">Sidebar</div>
                {["Dashboard", "Students", "Exams"].map((item) => (
                  <div
                    key={item}
                    className="text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: `${colors.values.accent_color}22` }}
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex-1 p-4" style={{ background: "var(--w11-card-bg)" }}>
                <div className="h-4 w-24 rounded mb-2" style={{ backgroundColor: colors.values.accent_color }} />
                <div className="h-3 w-48 rounded mb-1" style={{ background: "var(--w11-control-hover)" }} />
                <div className="h-3 w-36 rounded" style={{ background: "var(--w11-control-hover)" }} />
              </div>
            </div>
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}

export default function ThemePage() {
  return (
    <AppGate slug="white_label">
      <ThemeContent />
    </AppGate>
  );
}
