"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import { ColorField } from "@/components/ui/color-field";
import { AlertCircle, Palette, Save } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

const DEFAULT_FORM = {
  school_name_display: "",
  tagline: "",
  primary_color: "#2563EB",
  secondary_color: "#10B981",
  font_family: "Inter",
  hide_aschool_branding: false,
  footer_text: "",
  logo_url: "",
};

export default function BrandingPage() {
  return <PluginGate slug="white_label"><BrandingContent /></PluginGate>;
}

function BrandingContent() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["white-label-branding"],
    queryFn: async () => { const r = await api.get("/schools/white-label/branding"); return r.data?.data ?? r.data; },
    retry: 1,
  });

  useEffect(() => {
    if (data && form === null) {
      setForm({
        school_name_display: data.school_name_display ?? DEFAULT_FORM.school_name_display,
        tagline: data.tagline ?? DEFAULT_FORM.tagline,
        primary_color: data.primary_color || DEFAULT_FORM.primary_color,
        secondary_color: data.secondary_color || DEFAULT_FORM.secondary_color,
        font_family: data.font_family || DEFAULT_FORM.font_family,
        hide_aschool_branding: data.hide_aschool_branding ?? false,
        footer_text: data.footer_text ?? DEFAULT_FORM.footer_text,
        logo_url: data.logo_url ?? DEFAULT_FORM.logo_url,
      });
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: async () => (await api.patch("/schools/white-label/branding", form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["white-label-branding"] });
      qc.invalidateQueries({ queryKey: ["white-label-overview"] });
      toast.success("Branding saved");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Failed to save"),
  });

  if (isLoading || (isError && !form)) return <AOSModuleLoadingState label="Loading branding settings…" />;

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
              <AlertCircle className="h-8 w-8" style={{ color: "var(--w11-accent)" }} />
              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                Failed to load branding settings. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  if (!form) return <AOSModuleLoadingState label="Loading branding settings…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Palette className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Branding Settings"
        subtitle="Customize your school's brand identity"
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
          </Button>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DataPanel title="Identity">
            <div className="space-y-4">
              <div className="space-y-2"><Label>Display Name</Label><Input value={form.school_name_display} onChange={(e) => setForm({ ...form, school_name_display: e.target.value })} placeholder="School name shown to users" /></div>
              <div className="space-y-2"><Label>Tagline</Label><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Your school tagline" /></div>
              <div className="space-y-2"><Label>Footer Text</Label><Input value={form.footer_text} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} placeholder="Footer copyright text" /></div>
              <div className="flex items-center gap-3">
                <FormCheckbox id="hide_brand" label="Hide ASchool branding" checked={form.hide_aschool_branding} onCheckedChange={(v) => setForm({ ...form, hide_aschool_branding: v })} />
                <Label htmlFor="hide_brand">Hide &quot;Powered by ASchool&quot; branding</Label>
              </div>
            </div>
          </DataPanel>

          <DataPanel title="Colors &amp; Fonts">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <ColorField value={form.primary_color} onChange={(v) => setForm({ ...form, primary_color: v })} />
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <ColorField value={form.secondary_color} onChange={(v) => setForm({ ...form, secondary_color: v })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Font Family</Label>
                <AdvancedSelect
          value={form.font_family}
          onChange={(v) => setForm({ ...form, font_family: v })}
          options={[{ value: 'Inter', label: 'Inter' }, { value: 'Poppins', label: 'Poppins' }, { value: 'Roboto', label: 'Roboto' }, { value: 'Open Sans', label: 'Open Sans' }, { value: 'Nunito', label: 'Nunito' }]}
        />
              </div>
            </div>
          </DataPanel>

          <DataPanel className="lg:col-span-2" title="Logo">
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <div
                  className="h-20 w-20 border-2 border-dashed rounded-lg flex items-center justify-center text-xs overflow-hidden"
                  style={{
                    borderColor: "var(--w11-border-default)",
                    background: "var(--w11-control-hover)",
                    color: "var(--w11-text-secondary)",
                    borderRadius: "var(--w11-radius-lg)",
                  }}
                >
                  {form.logo_url ? <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain rounded-lg" /> : "No logo"}
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Logo URL</Label>
                  <div className="flex gap-2">
                    <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://... (PNG/SVG, max 2MB)" />
                    <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <Spinner /> : "Save"}</Button>
                  </div>
                  <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                    Paste a hosted logo URL (transparent background recommended). It is applied to your website and public profile.
                  </p>
                </div>
              </div>
            </div>
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
