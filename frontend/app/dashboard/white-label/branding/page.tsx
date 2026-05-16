"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Palette, Save, Upload } from "lucide-react";

export default function BrandingPage() {
  return <PluginGate slug="white_label"><BrandingContent /></PluginGate>;
}

function BrandingContent() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["white-label-branding"],
    queryFn: async () => { const r = await api.get("/schools/white-label/branding"); return r.data?.data ?? r.data; },
  });

  const [form, setForm] = useState<any>(null);

  if (!isLoading && data && form === null) {
    setForm({
      school_name_display: data.school_name_display ?? "",
      tagline: data.tagline ?? "",
      primary_color: data.primary_color ?? "#2563EB",
      secondary_color: data.secondary_color ?? "#10B981",
      font_family: data.font_family ?? "Inter",
      hide_aschool_branding: data.hide_aschool_branding ?? false,
      footer_text: data.footer_text ?? "",
    });
  }

  const save = useMutation({
    mutationFn: async () => (await api.patch("/schools/white-label/branding", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["white-label-branding"] }); toast.success("Branding saved"); },
    onError: () => toast.error("Failed to save"),
  });

  if (isLoading || !form) return <PageLoader />;

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
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted text-muted-foreground text-xs">
                {data?.logo_url ? <img src={data.logo_url} alt="Logo" className="h-full w-full object-contain rounded-lg" /> : "No logo"}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Upload your school logo (PNG/SVG, max 2MB, transparent background recommended)</p>
                <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Upload Logo</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
