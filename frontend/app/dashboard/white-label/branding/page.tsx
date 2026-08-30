"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AlertCircle, Palette, Save } from "lucide-react";

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

  if (isLoading || (isError && !form)) return <PageLoader />;

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load branding settings. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!form) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Palette className="h-6 w-6 text-purple-600" /><div><h1 className="text-2xl font-bold">Branding Settings</h1><p className="text-muted-foreground">Customize your school&apos;s brand identity</p></div></div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <Spinner /> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Display Name</Label><Input value={form.school_name_display} onChange={(e) => setForm({ ...form, school_name_display: e.target.value })} placeholder="School name shown to users" /></div>
            <div className="space-y-2"><Label>Tagline</Label><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Your school tagline" /></div>
            <div className="space-y-2"><Label>Footer Text</Label><Input value={form.footer_text} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} placeholder="Footer copyright text" /></div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="hide_brand" checked={form.hide_aschool_branding} onChange={(e) => setForm({ ...form, hide_aschool_branding: e.target.checked })} />
              <Label htmlFor="hide_brand">Hide &quot;Powered by ASchool&quot; branding</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Colors &amp; Fonts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2"><Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-16 h-10 p-1" /><Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2"><Input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="w-16 h-10 p-1" /><Input value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} /></div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Font Family</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.font_family} onChange={(e) => setForm({ ...form, font_family: e.target.value })}>
                <option value="Inter">Inter</option><option value="Poppins">Poppins</option><option value="Roboto">Roboto</option><option value="Open Sans">Open Sans</option><option value="Nunito">Nunito</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted text-muted-foreground text-xs overflow-hidden">
                {form.logo_url ? <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain rounded-lg" /> : "No logo"}
              </div>
              <div className="flex-1 space-y-2">
                <Label>Logo URL</Label>
                <div className="flex gap-2">
                  <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://... (PNG/SVG, max 2MB)" />
                  <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <Spinner /> : "Save"}</Button>
                </div>
                <p className="text-xs text-muted-foreground">Paste a hosted logo URL (transparent background recommended). It is applied to your website and public profile.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
