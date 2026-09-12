"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { AlertCircle, Palette, Save } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

const DEFAULT_FORM = {
  mode: "light",
  sidebar_style: "default",
  card_style: "rounded",
  density: "comfortable",
  accent_color: "#2563EB",
  sidebar_color: "#1e293b",
  sidebar_text_color: "#f8fafc",
};

export default function ThemePage() {
  return <PluginGate slug="white_label"><ThemeContent /></PluginGate>;
}

function ThemeContent() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["white-label-theme"],
    queryFn: async () => { const r = await api.get("/schools/white-label/theme"); return r.data?.data ?? r.data; },
    retry: 1,
  });

  useEffect(() => {
    if (data && form === null) {
      setForm({
        mode: data?.mode ?? DEFAULT_FORM.mode,
        sidebar_style: data?.sidebar_style ?? DEFAULT_FORM.sidebar_style,
        card_style: data?.card_style ?? DEFAULT_FORM.card_style,
        density: data?.density ?? DEFAULT_FORM.density,
        accent_color: data?.accent_color ?? DEFAULT_FORM.accent_color,
        sidebar_color: data?.sidebar_color ?? DEFAULT_FORM.sidebar_color,
        sidebar_text_color: data?.sidebar_text_color ?? DEFAULT_FORM.sidebar_text_color,
      });
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: async () => (await api.patch("/schools/white-label/theme", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["white-label-theme"] }); toast.success("Theme saved"); },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Failed to save theme"),
  });

  if (isLoading || (isError && !form)) return <AOSModuleLoadingState label="Loading theme settings…" />;

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
              <AlertCircle className="h-8 w-8" style={{ color: "var(--w11-accent)" }} />
              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                Failed to load theme settings. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  if (!form) return <AOSModuleLoadingState label="Loading theme settings…" />;

  const ColorField = ({ label, field }: { label: string; field: string }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={form[field]}
          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          className="w-12 h-10 rounded cursor-pointer"
          style={{ border: "1px solid var(--w11-control-border)", borderRadius: "var(--w11-radius-sm)" }}
        />
        <span
          className="flex items-center text-sm"
          style={{ color: "var(--w11-text-secondary)", fontFamily: "var(--w11-font-mono)" }}
        >
          {form[field]}
        </span>
      </div>
    </div>
  );

  const SelectField = ({ label, field, options }: { label: string; field: string; options: { value: string; label: string }[] }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <AdvancedSelect value={form[field]} onChange={(v) => setForm({ ...form, [field]: v })}
        options={options.map((o) => ({ value: o.value, label: o.label }))} />
    </div>
  );

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Palette className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Theme Settings"
        subtitle="Customize the admin app appearance"
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : <><Save className="h-4 w-4 mr-2" />Save Theme</>}
          </Button>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DataPanel title="Appearance">
            <div className="space-y-4">
              <SelectField label="Color Mode" field="mode" options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Follow System" }]} />
              <SelectField label="Sidebar Style" field="sidebar_style" options={[{ value: "default", label: "Default" }, { value: "compact", label: "Compact" }, { value: "icon-only", label: "Icon Only" }]} />
              <SelectField label="Card Style" field="card_style" options={[{ value: "rounded", label: "Rounded" }, { value: "sharp", label: "Sharp" }, { value: "flat", label: "Flat" }]} />
              <SelectField label="UI Density" field="density" options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }, { value: "spacious", label: "Spacious" }]} />
            </div>
          </DataPanel>

          <DataPanel title="Colors">
            <div className="space-y-4">
              <ColorField label="Accent Color" field="accent_color" />
              <ColorField label="Sidebar Background" field="sidebar_color" />
              <ColorField label="Sidebar Text" field="sidebar_text_color" />
            </div>
          </DataPanel>

          <DataPanel className="lg:col-span-2" title="Preview">
            <div
              className="flex h-32 rounded-lg overflow-hidden border border-[var(--w11-border-default)]"
            >
              <div className="w-48 h-full flex flex-col p-3 gap-2" style={{ backgroundColor: form.sidebar_color, color: form.sidebar_text_color }}>
                <div className="text-xs font-bold opacity-80">Sidebar</div>
                {["Dashboard", "Students", "Exams"].map((item) => (
                  <div key={item} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: `${form.accent_color}22` }}>{item}</div>
                ))}
              </div>
              <div className="flex-1 p-4" style={{ background: "var(--w11-card-bg)" }}>
                <div className="h-4 w-24 rounded mb-2" style={{ backgroundColor: form.accent_color }} />
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
