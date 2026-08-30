"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Save, School, Clock, Calendar, Shield, Globe, PenTool, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useInstalledPlugins } from "@/lib/plugins";

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
      const res = await api.get<ApiResponse>("/schools/current");
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

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load school settings. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }
  if (!school) return <p className="text-center py-8 text-muted-foreground">Unable to load settings</p>;

  const previewUrl = `${origin || ""}/school/${school.slug}`;
  const liveUrl = websiteStatus?.public_url || (websiteStatus?.default_domain ? `https://${websiteStatus.default_domain}` : "");

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">School Settings</h1>
          <p className="text-muted-foreground">Manage your school profile and configuration</p>
        </div>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          <Save className="h-4 w-4 mr-2" /> {saveMut.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* General Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><School className="h-5 w-5" /> General Information</CardTitle>
          <CardDescription>Basic school details visible across the system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">School Name (English)</label>
              <Input value={form.name || ""} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">School Name (नेपाली)</label>
              <Input value={form.name_nepali || ""} onChange={(e) => update("name_nepali", e.target.value)} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input type="email" value={form.email || ""} onChange={(e) => update("email", e.target.value)} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">District</label>
              <Input value={form.district || ""} onChange={(e) => update("district", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Municipality</label>
              <Input value={form.municipality || ""} onChange={(e) => update("municipality", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Branding</CardTitle>
          <CardDescription>Logo and banner used on the public website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Logo URL</label>
            <Input value={form.logo_url || ""} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Banner URL</label>
            <Input value={form.banner_url || ""} onChange={(e) => update("banner_url", e.target.value)} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      {/* Website */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Website & Design</CardTitle>
          <CardDescription>Preview your public website and open the dedicated website design page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground mb-1">Local Preview</p>
              <p className="font-medium break-all">{previewUrl}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground mb-1">Live Domain</p>
              <p className="font-medium break-all">{liveUrl || "Not published yet"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
            <Button asChild>
              <Link href="/dashboard/settings/website-design">
                <PenTool className="h-4 w-4 mr-2" /> Open Design Center
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> School Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              <Badge variant="outline">{school.type}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Level:</span>{" "}
              <Badge variant="outline">{school.level}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Established:</span>{" "}
              <Badge variant="outline">{school.established_year_bs || "—"} BS</Badge>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-sm">Slug:</span>{" "}
            <code className="text-sm bg-muted px-2 py-0.5 rounded">{school.slug}</code>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Config JSON */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Advanced Configuration</CardTitle>
          <CardDescription>JSON configuration for working days, hours, academic year, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            className="font-mono text-xs"
            rows={10}
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
