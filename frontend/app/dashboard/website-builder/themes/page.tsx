"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ALL_TEMPLATES } from "@/lib/school-website/templates";
import { revalidateSchoolSite } from "@/lib/revalidate";
import type { SchoolTemplate } from "@/lib/school-website/types";

interface Theme {
  id: string;
  name: string;
  description: string;
  tier: "free" | "pro";
  preview_image?: string;
  colors: { primary: string; secondary: string; accent: string; bg: string; text: string };
  fonts: { heading: string; body: string };
}

// ─── Template Preset Card ──────────────────────────────────────────────────────

function TemplateCard({
  template,
  onApply,
  applying,
}: {
  template: SchoolTemplate;
  onApply: () => void;
  applying: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="border rounded-xl overflow-hidden hover:shadow-lg transition-shadow group">
      {/* Color preview header */}
      <div
        className="h-36 relative flex flex-col justify-end p-4 text-white"
        style={{
          background: `linear-gradient(135deg, ${template.colorScheme.primary} 0%, ${template.colorScheme.secondary} 60%, ${template.colorScheme.accent} 100%)`,
        }}
      >
        {/* Emoji badge */}
        <span className="absolute top-3 left-3 text-3xl">{template.emoji}</span>
        {/* Category badge */}
        <span className="absolute top-3 right-3 bg-black/30 text-white text-xs font-medium px-2 py-0.5 rounded-full capitalize">
          {template.category}
        </span>
        {/* Mini section blocks preview */}
        <div className="flex gap-1 flex-wrap mb-1">
          {template.sections.slice(0, 6).map((s, i) => (
            <span key={i} className="bg-white/20 rounded px-1.5 py-0.5 text-[10px] font-medium">
              {s.type}
            </span>
          ))}
          {template.sections.length > 6 && (
            <span className="bg-white/20 rounded px-1.5 py-0.5 text-[10px] font-medium">
              +{template.sections.length - 6} more
            </span>
          )}
        </div>
        {/* Color swatches */}
        <div className="flex gap-1">
          {Object.values(template.colorScheme).slice(0, 4).map((c, i) => (
            <div key={i} className="w-4 h-4 rounded-full border border-white/40 shadow-sm" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-gray-900">{template.name}</h3>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {template.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <div className="flex gap-1 items-center text-xs text-gray-400">
            <span className="font-medium text-gray-600">{template.sections.length}</span> sections
          </div>
          <div className="flex-1" />
          {showConfirm ? (
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-2.5 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { onApply(); setShowConfirm(false); }}
                disabled={applying}
                className="px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {applying ? "Applying..." : "Confirm"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 group-hover:bg-blue-700 transition-colors"
            >
              Use Template
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Themes Page ──────────────────────────────────────────────────────────

export default function ThemesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"themes" | "templates">("templates");
  const [filter, setFilter] = useState<"all" | "free" | "pro">("all");
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  const { data: themes = [], isLoading: themesLoading, isError: themesError, refetch: refetchThemes } = useQuery<Theme[]>({
    queryKey: ["website-themes"],
    queryFn: () => api.get("/website-builder/themes").then((r) => r.data.data.themes || []),
    retry: 1,
  });

  const applyThemeMut = useMutation({
    mutationFn: (themeId: string) => api.post("/website-builder/themes/apply", { theme_id: themeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-status"] });
      revalidateSchoolSite();
      alert("Theme applied successfully!");
    },
  });

  // Apply a full template — creates/replaces the home page sections
  const applyTemplateMut = useMutation({
    mutationFn: async (template: SchoolTemplate) => {
      setApplyingTemplate(template.id);
      // 1. Get or create the home page
      const pagesRes = await api.get("/website-builder/pages");
      const pages = pagesRes.data?.data || [];
      let homePage = pages.find((p: any) => p.page_type === "home" || p.slug === "home" || p.slug === "/");

      if (!homePage) {
        const createRes = await api.post("/website-builder/pages", {
          title: "Home",
          slug: "home",
          page_type: "home",
          is_published: true,
        });
        homePage = createRes.data?.data;
      }

      if (!homePage?.id) throw new Error("Could not get or create home page");

      // 2. Delete existing sections
      const pageRes = await api.get(`/website-builder/pages/${homePage.id}`);
      const existingSections = pageRes.data?.data?.sections || [];
      for (const section of existingSections) {
        await api.delete(`/website-builder/pages/${homePage.id}/sections/${section.id}`);
      }

      // 3. Apply color scheme to the website config
      await api.put("/website/config", {
        customizations: {
          template_id: template.id,
          colors: template.colorScheme,
        },
      });

      // 4. Add template sections
      for (const section of template.sections) {
        await api.post(`/website-builder/pages/${homePage.id}/sections`, {
          type: section.type,
          title: section.title,
          content: section.content,
        });
      }
      return homePage;
    },
    onSuccess: () => {
      setApplyingTemplate(null);
      qc.invalidateQueries({ queryKey: ["website-status"] });
      revalidateSchoolSite();
      alert("✅ Template applied! Go to Pages → Edit Home to customize the sections.");
    },
    onError: () => setApplyingTemplate(null),
  });

  const filtered = themes.filter((t) => (filter === "all" ? true : t.tier === filter));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">🎨 Themes & Templates</h1>
        <p className="text-gray-500 text-sm mt-1">
          Choose from beautiful themes or apply a complete page template
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "templates"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📐 Page Templates
          <span className="ml-1.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
            {ALL_TEMPLATES.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("themes")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "themes"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🖌️ Color Themes
          <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
            {themes.length}
          </span>
        </button>
      </div>

      {/* Templates tab */}
      {activeTab === "templates" && (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 text-sm text-blue-700">
            <strong>💡 How templates work:</strong> Applying a template replaces all sections on your Home page
            with a professionally designed layout. You can then customize each section using the editor.
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ALL_TEMPLATES.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onApply={() => applyTemplateMut.mutate(template)}
                applying={applyingTemplate === template.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Themes tab */}
      {activeTab === "themes" && (
        <div>
          {/* Filter */}
          <div className="flex gap-2 mb-5">
            {(["all", "free", "pro"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                {f === "all" ? `All (${themes.length})` : f === "free" ? `Free (${themes.filter((t) => t.tier === "free").length})` : `Pro (${themes.filter((t) => t.tier === "pro").length})`}
              </button>
            ))}
          </div>

          {themesError ? (
            <div className="flex flex-col items-center py-16 space-y-3">
              <p className="text-sm text-destructive">Failed to load themes. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetchThemes()}>Retry</Button>
            </div>
          ) : themesLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((theme) => (
                <div key={theme.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div
                    className="h-40 relative"
                    style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})` }}
                  >
                    {theme.tier === "pro" && (
                      <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded">PRO</span>
                    )}
                    {theme.tier === "free" && (
                      <span className="absolute top-2 right-2 bg-green-400 text-green-900 text-xs font-bold px-2 py-0.5 rounded">FREE</span>
                    )}
                    <div className="absolute bottom-3 left-3 flex gap-1">
                      {Object.values(theme.colors).slice(0, 4).map((c, i) => (
                        <div key={i} className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold">{theme.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{theme.description}</p>
                    <p className="text-xs text-gray-400 mt-1">Fonts: {theme.fonts.heading} / {theme.fonts.body}</p>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => setPreviewTheme(theme)} className="flex-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">Preview</button>
                      <button onClick={() => applyThemeMut.mutate(theme.id)} disabled={applyThemeMut.isPending} className="flex-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Apply</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Theme Preview Modal */}
      {previewTheme && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{previewTheme.name}</h2>
                <button onClick={() => setPreviewTheme(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>
              <div className="rounded-lg overflow-hidden border" style={{ fontFamily: previewTheme.fonts.body }}>
                <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${previewTheme.colors.primary}, ${previewTheme.colors.secondary})` }}>
                  <h3 className="text-2xl font-bold" style={{ fontFamily: previewTheme.fonts.heading }}>School Name</h3>
                  <p className="opacity-80 text-sm">Kathmandu, Nepal</p>
                </div>
                <div className="p-6" style={{ backgroundColor: previewTheme.colors.bg }}>
                  <h4 className="text-lg font-semibold mb-2" style={{ color: previewTheme.colors.primary, fontFamily: previewTheme.fonts.heading }}>Website Welcome</h4>
                  <p className="text-sm mb-4" style={{ color: previewTheme.colors.text }}>Preview of <strong>{previewTheme.name}</strong> theme.</p>
                  <div className="flex gap-2">
                    <span className="px-4 py-2 rounded text-white text-sm" style={{ backgroundColor: previewTheme.colors.primary }}>Primary Button</span>
                    <span className="px-4 py-2 rounded text-white text-sm" style={{ backgroundColor: previewTheme.colors.accent }}>Accent Button</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setPreviewTheme(null)} className="px-4 py-2 border rounded-lg text-sm">Close</button>
                <button onClick={() => { applyThemeMut.mutate(previewTheme.id); setPreviewTheme(null); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">Apply Theme</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
