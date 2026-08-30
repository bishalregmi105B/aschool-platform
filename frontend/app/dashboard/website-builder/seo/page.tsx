"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { revalidateSchoolSite } from "@/lib/revalidate";

interface SeoSettings {
  meta_title: string;
  meta_description: string;
  og_image: string;
  google_analytics_id: string;
  google_site_verification: string;
  sitemap_enabled: boolean;
  robots_txt: string;
}

export default function SeoPage() {
  const qc = useQueryClient();

  const { data: seo, isLoading, isError, refetch } = useQuery<SeoSettings>({
    queryKey: ["website-seo"],
    queryFn: () => api.get("/website-builder/seo").then((r) => r.data.data),
    retry: 1,
  });

  const [form, setForm] = useState<SeoSettings | null>(null);

  // Initialize form when data loads
  if (seo && !form) {
    setForm(seo);
  }

  const saveMut = useMutation({
    mutationFn: (data: SeoSettings) => api.put("/website-builder/seo", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-seo"] });
      revalidateSchoolSite();
      alert("SEO settings saved!");
    },
  });

  if (isError) {
    return (
      <div className="p-6 max-w-2xl">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load SEO settings. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  if (isLoading || !form) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const updateField = (key: keyof SeoSettings, value: string | boolean) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">🔍 SEO Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Optimize your school website for search engines
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMut.mutate(form);
        }}
        className="space-y-6"
      >
        {/* Meta Title */}
        <div className="border rounded-lg p-5 space-y-4">
          <h3 className="font-medium text-sm">Basic SEO</h3>

          <div>
            <label className="block text-sm font-medium mb-1">Meta Title</label>
            <input
              type="text"
              value={form.meta_title}
              onChange={(e) => updateField("meta_title", e.target.value)}
              placeholder="Your School Name — Quality Education in Nepal"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={60}
            />
            <p className="text-xs text-gray-400 mt-1">
              {form.meta_title.length}/60 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Meta Description</label>
            <textarea
              value={form.meta_description}
              onChange={(e) => updateField("meta_description", e.target.value)}
              rows={3}
              placeholder="Short description of your school for search engine results"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={160}
            />
            <p className="text-xs text-gray-400 mt-1">
              {form.meta_description.length}/160 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">OG Image URL</label>
            <input
              type="url"
              value={form.og_image}
              onChange={(e) => updateField("og_image", e.target.value)}
              placeholder="https://..."
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Image shown when your website is shared on social media (1200x630px recommended)
            </p>
          </div>
        </div>

        {/* Search Preview */}
        <div className="border rounded-lg p-5">
          <h3 className="font-medium text-sm mb-3">Search Preview</h3>
          <div className="bg-white border rounded p-4">
            <p className="text-blue-700 text-lg hover:underline cursor-pointer">
              {form.meta_title || "Your School Name"}
            </p>
            <p className="text-green-700 text-sm">yourschool.aschool.com.np</p>
            <p className="text-gray-600 text-sm mt-1">
              {form.meta_description || "Add a meta description to control how your school appears in search results."}
            </p>
          </div>
        </div>

        {/* Analytics */}
        <div className="border rounded-lg p-5 space-y-4">
          <h3 className="font-medium text-sm">Analytics & Verification</h3>

          <div>
            <label className="block text-sm font-medium mb-1">Google Analytics ID</label>
            <input
              type="text"
              value={form.google_analytics_id}
              onChange={(e) => updateField("google_analytics_id", e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className="w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Google Site Verification</label>
            <input
              type="text"
              value={form.google_site_verification}
              onChange={(e) => updateField("google_site_verification", e.target.value)}
              placeholder="Verification code from Google Search Console"
              className="w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Sitemap & Robots */}
        <div className="border rounded-lg p-5 space-y-4">
          <h3 className="font-medium text-sm">Sitemap & Crawling</h3>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.sitemap_enabled}
              onChange={(e) => updateField("sitemap_enabled", e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Auto-generate sitemap.xml</span>
          </label>

          <div>
            <label className="block text-sm font-medium mb-1">Custom robots.txt</label>
            <textarea
              value={form.robots_txt}
              onChange={(e) => updateField("robots_txt", e.target.value)}
              rows={4}
              placeholder={`User-agent: *\nAllow: /\nSitemap: https://yourschool.aschool.com.np/sitemap.xml`}
              className="w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saveMut.isPending}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saveMut.isPending ? "Saving..." : "Save SEO Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
