"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Theme {
  id: string;
  name: string;
  description: string;
  tier: "free" | "pro";
  preview_image?: string;
  colors: { primary: string; secondary: string; accent: string; bg: string; text: string };
  fonts: { heading: string; body: string };
}

export default function ThemesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "free" | "pro">("all");
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);

  const { data: themes = [], isLoading } = useQuery<Theme[]>({
    queryKey: ["website-themes"],
    queryFn: () => api.get("/website-builder/themes").then((r) => r.data.data.themes || []),
  });

  const applyMut = useMutation({
    mutationFn: (themeId: string) =>
      api.post("/website-builder/themes/apply", { theme_id: themeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-status"] });
      alert("Theme applied successfully!");
    },
  });

  const filtered = themes.filter((t) => (filter === "all" ? true : t.tier === filter));

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🎨 Themes</h1>
          <p className="text-gray-500 text-sm mt-1">
            Choose from 20 beautiful themes designed for Nepali schools
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "free", "pro"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? `All (${themes.length})` : f === "free" ? `Free (${themes.filter((t) => t.tier === "free").length})` : `Pro (${themes.filter((t) => t.tier === "pro").length})`}
          </button>
        ))}
      </div>

      {/* Theme Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map((theme) => (
          <div key={theme.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            <div
              className="h-40 relative"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
              }}
            >
              {theme.tier === "pro" && (
                <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded">
                  PRO
                </span>
              )}
              {theme.tier === "free" && (
                <span className="absolute top-2 right-2 bg-green-400 text-green-900 text-xs font-bold px-2 py-0.5 rounded">
                  FREE
                </span>
              )}
              {/* Color swatches */}
              <div className="absolute bottom-3 left-3 flex gap-1">
                {Object.values(theme.colors).slice(0, 4).map((c, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold">{theme.name}</h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{theme.description}</p>
              <p className="text-xs text-gray-400 mt-1">
                Fonts: {theme.fonts.heading} / {theme.fonts.body}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setPreviewTheme(theme)}
                  className="flex-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                >
                  Preview
                </button>
                <button
                  onClick={() => applyMut.mutate(theme.id)}
                  disabled={applyMut.isPending}
                  className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewTheme && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{previewTheme.name}</h2>
                <button onClick={() => setPreviewTheme(null)} className="text-gray-400 hover:text-gray-600 text-2xl">
                  ×
                </button>
              </div>

              {/* Preview */}
              <div
                className="rounded-lg overflow-hidden border"
                style={{ fontFamily: previewTheme.fonts.body }}
              >
                <div
                  className="p-6 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${previewTheme.colors.primary}, ${previewTheme.colors.secondary})`,
                  }}
                >
                  <h3
                    className="text-2xl font-bold"
                    style={{ fontFamily: previewTheme.fonts.heading }}
                  >
                    School Name
                  </h3>
                  <p className="opacity-80 text-sm">Kathmandu, Nepal</p>
                </div>
                <div className="p-6" style={{ backgroundColor: previewTheme.colors.bg }}>
                  <h4
                    className="text-lg font-semibold mb-2"
                    style={{ color: previewTheme.colors.primary, fontFamily: previewTheme.fonts.heading }}
                  >
                    Website Welcome Section
                  </h4>
                  <p className="text-sm" style={{ color: previewTheme.colors.text }}>
                    This is a preview of how your school website will look with the{" "}
                    <strong>{previewTheme.name}</strong> theme.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <span
                      className="px-4 py-2 rounded text-white text-sm"
                      style={{ backgroundColor: previewTheme.colors.primary }}
                    >
                      Primary Button
                    </span>
                    <span
                      className="px-4 py-2 rounded text-white text-sm"
                      style={{ backgroundColor: previewTheme.colors.accent }}
                    >
                      Accent Button
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setPreviewTheme(null)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    applyMut.mutate(previewTheme.id);
                    setPreviewTheme(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Apply Theme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
