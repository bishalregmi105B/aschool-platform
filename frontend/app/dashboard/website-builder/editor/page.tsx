"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { sanitizeCss } from "@/lib/sanitize";
import { ALL_WIDGETS, CATEGORIES, getWidgetDef, getWidgetsByCategory } from "@/lib/school-website/registry";
import { SectionRenderer } from "@/components/website/SectionRenderer";
import type { SchoolSection, SchoolWidgetDef, SchoolWidgetControl } from "@/lib/school-website/types";
import { generateThemeCSS, getThemeById } from "@/themes/registry";

type ContentState = Record<string, unknown>;

interface PageData {
  id: string;
  title: string;
  sections: SchoolSection[];
  is_published: boolean;
}

// ─── Widget Palette ─────────────────────────────────────────────────────────

function WidgetPalette({ onAdd }: { onAdd: (def: SchoolWidgetDef) => void }) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key);
  const [search, setSearch] = useState("");

  const widgets = search.trim()
    ? ALL_WIDGETS.filter(
        (w) =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          w.description.toLowerCase().includes(search.toLowerCase())
      )
    : getWidgetsByCategory(activeCategory as any);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search widgets..."
          className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {!search.trim() && (
        <div className="flex gap-1 p-2 border-b overflow-x-auto flex-shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeCategory === cat.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {widgets.map((def) => (
          <button
            key={def.type}
            onClick={() => onAdd(def)}
            className="w-full text-left p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl flex-shrink-0">{def.icon}</span>
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-900 group-hover:text-blue-700">{def.name}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{def.description}</p>
              </div>
            </div>
          </button>
        ))}
        {widgets.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No widgets found</p>
        )}
      </div>
    </div>
  );
}

// ─── Section List Item ────────────────────────────────────────────────────────

function SectionItem({
  section, index, total, isSelected, onSelect, onMoveUp, onMoveDown, onDelete,
}: {
  section: SchoolSection; index: number; total: number; isSelected: boolean;
  onSelect: () => void; onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
}) {
  const def = getWidgetDef(section.type);
  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer transition-all ${
        isSelected ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <span className="text-base flex-shrink-0">{def?.icon ?? "📦"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{section.title}</p>
          <p className="text-xs text-gray-400 capitalize">{section.type}</p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onMoveUp} disabled={index === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-xs">↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-xs">↓</button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      </div>
    </div>
  );
}

// ─── Control Renderers ────────────────────────────────────────────────────────

function ControlRenderer({ control, value, onChange }: {
  control: SchoolWidgetControl; value: unknown; onChange: (v: unknown) => void;
}) {
  switch (control.type) {
    case "textarea":
    case "richtext":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={control.placeholder}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      );
    case "color":
      return (
        <div className="flex items-center gap-2">
          <input type="color" value={(value as string) || "#000000"} onChange={(e) => onChange(e.target.value)} className="h-9 w-16 border rounded cursor-pointer" />
          <input type="text" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      );
    case "number":
      return (
        <input type="number" value={(value as number) ?? ""} onChange={(e) => onChange(Number(e.target.value))} step="any" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      );
    case "toggle":
      return (
        <div className="flex items-center gap-3">
          <button onClick={() => onChange(!value)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-blue-600" : "bg-gray-300"}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <span className="text-sm text-gray-600">{value ? "Enabled" : "Disabled"}</span>
        </div>
      );
    case "select":
      return (
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {(control.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    case "stats": {
      const items = (value as { value: string; label: string }[]) ?? [];
      const updateItem = (i: number, k: string, v: string) => onChange(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
      const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="text" value={item.value} onChange={(e) => updateItem(i, "value", e.target.value)} placeholder="500+" className="w-20 border rounded px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <input type="text" value={item.label} onChange={(e) => updateItem(i, "label", e.target.value)} placeholder="Students" className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
            </div>
          ))}
          <button onClick={() => onChange([...items, { value: "0+", label: "Label" }])} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors">+ Add Stat</button>
        </div>
      );
    }
    case "slides": {
      const slides = (value as Record<string, unknown>[]) ?? [];
      const updateSlide = (i: number, k: string, v: string) => onChange(slides.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
      const removeSlide = (i: number) => onChange(slides.filter((_, idx) => idx !== i));
      return (
        <div className="space-y-2">
          {slides.map((slide, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500">Slide {i + 1}</span>
                <button onClick={() => removeSlide(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
              </div>
              {["title", "subtitle", "image", "cta_text", "cta_link"].map((key) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-0.5 capitalize">{key.replace("_", " ")}</label>
                  <input type="text" value={(slide[key] as string) ?? ""} onChange={(e) => updateSlide(i, key, e.target.value)} className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => onChange([...slides, { title: "New Slide", subtitle: "", image: "", cta_text: "Learn More", cta_link: "#" }])} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors">+ Add Slide</button>
        </div>
      );
    }
    case "items": {
      const items = (value as Record<string, unknown>[]) ?? [];
      const updateItem = (i: number, k: string, v: string) => onChange(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
      const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500">Item {i + 1}</span>
                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
              </div>
              {Object.entries(item).map(([k, v]) => (
                <div key={k}>
                  <label className="block text-xs text-gray-500 mb-0.5 capitalize">{k}</label>
                  <input type="text" value={(v as string) ?? ""} onChange={(e) => updateItem(i, k, e.target.value)} className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => onChange([...items, { title: "New Item", desc: "" }])} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors">+ Add Item</button>
        </div>
      );
    }
    default:
      return (
        <input type="text" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={control.placeholder} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      );
  }
}

// ─── Properties Panel ─────────────────────────────────────────────────────────

function PropertiesPanel({
  section, onContentChange, onTitleChange, onSave, saving, onClose,
}: {
  section: SchoolSection | null; onContentChange: (c: ContentState) => void;
  onTitleChange: (t: string) => void; onSave: () => void; saving: boolean; onClose: () => void;
}) {
  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <span className="text-4xl mb-3">👈</span>
        <p className="text-gray-500 text-sm">Click a section in the preview to edit its content and style</p>
      </div>
    );
  }

  const def = getWidgetDef(section.type);
  if (!def) return null;

  const groups: Record<string, SchoolWidgetControl[]> = {};
  for (const control of def.controls) {
    const g = control.group ?? "content";
    if (!groups[g]) groups[g] = [];
    groups[g].push(control);
  }

  const GROUP_LABELS: Record<string, string> = { content: "Content", style: "Appearance", advanced: "Advanced" };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center gap-2 flex-shrink-0">
        <span className="text-xl">{def.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{def.name}</p>
          <p className="text-xs text-gray-400 truncate">{def.description}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      <div className="p-4 border-b flex-shrink-0">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Section Label</label>
        <input type="text" value={section.title} onChange={(e) => onTitleChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {["content", "style", "advanced"].map((group) => {
          const controls = groups[group];
          if (!controls || controls.length === 0) return null;
          return (
            <div key={group}>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{GROUP_LABELS[group]}</p>
              <div className="space-y-4">
                {controls.map((control) => (
                  <div key={control.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{control.label}</label>
                    {control.hint && <p className="text-xs text-gray-400 mb-1.5">{control.hint}</p>}
                    <ControlRenderer
                      control={control}
                      value={section.content[control.key]}
                      onChange={(v) => onContentChange({ ...section.content, [control.key]: v })}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t flex-shrink-0">
        <button onClick={onSave} disabled={saving} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Editable Section Block ───────────────────────────────────────────────────

function EditableSectionBlock({
  section, isSelected, onClick,
}: {
  section: SchoolSection; isSelected: boolean; onClick: () => void;
}) {
  const def = getWidgetDef(section.type);
  return (
    <div className="relative group cursor-pointer" onClick={onClick}>
      {/* Selection ring overlay */}
      <div
        className={`absolute inset-0 z-10 pointer-events-none transition-all rounded-sm ${
          isSelected
            ? "ring-2 ring-blue-500 ring-offset-0"
            : "ring-0 group-hover:ring-2 group-hover:ring-blue-300 group-hover:ring-offset-0"
        }`}
      />
      {/* Type badge — always visible on hover, highlighted when selected */}
      <div
        className={`absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm transition-all pointer-events-none ${
          isSelected
            ? "opacity-100 bg-blue-600 text-white"
            : "opacity-0 group-hover:opacity-100 bg-white/90 text-gray-700 border border-gray-200"
        }`}
      >
        <span>{def?.icon ?? "📦"}</span>
        <span>{section.title}</span>
        {isSelected && <span className="ml-0.5">✏️</span>}
      </div>
      {/* Actual rendered section */}
      <SectionRenderer section={section} />
    </div>
  );
}

// ─── Main Editor Page ──────────────────────────────────────────────────────────

export default function WebsiteEditor() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const pageId = searchParams.get("page");

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<"sections" | "widgets">("sections");
  const [localSections, setLocalSections] = useState<SchoolSection[] | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, { title?: string; content?: ContentState }>>({});

  const { data: pageData, isLoading } = useQuery<PageData>({
    queryKey: ["website-page-sections", pageId],
    queryFn: () => api.get(`/website-builder/pages/${pageId}`).then((r) => r.data.data),
    enabled: !!pageId,
  });

  // Fetch website config for theme CSS injection in the preview canvas
  const { data: websiteConfig } = useQuery<{ theme_slug?: string; customizations?: { colors?: Record<string, string>; custom_css?: string } }>({
    queryKey: ["website-config-theme"],
    queryFn: () => api.get("/website/config").then((r) => r.data.data || r.data),
    staleTime: 60_000,
  });

  const previewThemeCss = (() => {
    const themeSlug = websiteConfig?.theme_slug || "modern-minimal";
    const activeTheme = getThemeById(themeSlug) || getThemeById("modern-minimal");
    const colorOverrides = websiteConfig?.customizations?.colors || {};
    if (!activeTheme) return "";
    // sanitizeCss defends against custom_css smuggled through the config row;
    // generated theme CSS is registry-controlled but passes through the same gate.
    return sanitizeCss(
      generateThemeCSS(activeTheme, colorOverrides) +
        (websiteConfig?.customizations?.custom_css || "")
    );
  })();

  const sections: SchoolSection[] = (localSections ?? pageData?.sections ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;
  const selectedWithPending: SchoolSection | null = selectedSection
    ? {
        ...selectedSection,
        title: pendingChanges[selectedSection.id]?.title ?? selectedSection.title,
        content: pendingChanges[selectedSection.id]?.content ?? selectedSection.content,
      }
    : null;

  // Sync local sections when query data arrives
  if (pageData && localSections === null) {
    setLocalSections(pageData.sections || []);
  }

  const addSectionMut = useMutation({
    mutationFn: (s: { type: string; title: string; content: Record<string, unknown> }) =>
      api.post(`/website-builder/pages/${pageId}/sections`, s),
    onSuccess: (res) => {
      const newSection = res.data?.data;
      if (newSection) {
        setLocalSections((prev) => [...(prev ?? []), newSection]);
      }
      qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] });
    },
  });

  const updateSectionMut = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: Record<string, unknown> }) =>
      api.put(`/website-builder/pages/${pageId}/sections/${sectionId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] });
      setPendingChanges({});
    },
  });

  const deleteSectionMut = useMutation({
    mutationFn: (sectionId: string) => api.delete(`/website-builder/pages/${pageId}/sections/${sectionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] });
      setSelectedSectionId(null);
    },
  });

  const moveSectionMut = useMutation({
    mutationFn: ({ sectionId, direction }: { sectionId: string; direction: "up" | "down" }) =>
      api.put(`/website-builder/pages/${pageId}/sections/${sectionId}/reorder`, { direction }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] }),
  });

  const handleAddWidget = useCallback(
    (def: SchoolWidgetDef) => {
      addSectionMut.mutate({ type: def.type, title: def.name, content: def.defaultContent });
      setLeftTab("sections");
    },
    [addSectionMut]
  );

  const handleContentChange = useCallback(
    (content: ContentState) => {
      if (!selectedSectionId) return;
      setPendingChanges((prev) => ({ ...prev, [selectedSectionId]: { ...prev[selectedSectionId], content } }));
      setLocalSections((prev) => prev ? prev.map((s) => s.id === selectedSectionId ? { ...s, content } : s) : prev);
    },
    [selectedSectionId]
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!selectedSectionId) return;
      setPendingChanges((prev) => ({ ...prev, [selectedSectionId]: { ...prev[selectedSectionId], title } }));
      setLocalSections((prev) => prev ? prev.map((s) => s.id === selectedSectionId ? { ...s, title } : s) : prev);
    },
    [selectedSectionId]
  );

  const handleSave = useCallback(() => {
    if (!selectedSectionId) return;
    const changes = pendingChanges[selectedSectionId];
    if (!changes) return;
    updateSectionMut.mutate({ sectionId: selectedSectionId, data: changes });
  }, [selectedSectionId, pendingChanges, updateSectionMut]);

  const handleDelete = useCallback(
    (sectionId: string) => {
      if (!confirm("Delete this section?")) return;
      deleteSectionMut.mutate(sectionId);
    },
    [deleteSectionMut]
  );

  if (!pageId) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">No page selected</h2>
        <p className="text-gray-500 mb-4">Go to Pages and click Edit on a page to open the editor.</p>
        <a href="/dashboard/website-builder/pages" className="text-blue-600 underline">← Go to Pages</a>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* LEFT PANEL — outline */}
      <div className="w-64 bg-white border-r flex flex-col flex-shrink-0 z-10 shadow-sm">
        <div className="p-3 border-b flex-shrink-0">
          <a href="/dashboard/website-builder/pages" className="text-xs text-blue-600 hover:underline">← Pages</a>
          <h2 className="font-bold text-gray-900 mt-0.5 truncate text-sm">{pageData?.title || "Page"}</h2>
        </div>
        <div className="flex border-b flex-shrink-0">
          <button
            onClick={() => setLeftTab("sections")}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${leftTab === "sections" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
          >
            Sections ({sections.length})
          </button>
          <button
            onClick={() => setLeftTab("widgets")}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${leftTab === "widgets" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
          >
            + Add
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {leftTab === "sections" ? (
            <div className="h-full overflow-y-auto p-2 space-y-1">
              {sections.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-400 text-xs">No sections yet</p>
                  <button onClick={() => setLeftTab("widgets")} className="mt-2 text-blue-600 text-xs underline">Add section →</button>
                </div>
              ) : (
                sections.map((section, idx) => (
                  <SectionItem
                    key={section.id}
                    section={section}
                    index={idx}
                    total={sections.length}
                    isSelected={selectedSectionId === section.id}
                    onSelect={() => setSelectedSectionId(section.id)}
                    onMoveUp={() => moveSectionMut.mutate({ sectionId: section.id, direction: "up" })}
                    onMoveDown={() => moveSectionMut.mutate({ sectionId: section.id, direction: "down" })}
                    onDelete={() => handleDelete(section.id)}
                  />
                ))
              )}
            </div>
          ) : (
            <WidgetPalette onAdd={handleAddWidget} />
          )}
        </div>
      </div>

      {/* CENTER — live site preview */}
      <div className="flex-1 overflow-y-auto bg-gray-200">
        {/* Toolbar */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b px-4 py-2 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">Live Preview</span>
            {hasPendingChanges && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">● Unsaved</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a href="/dashboard/website-builder" target="_blank" className="text-xs text-blue-600 hover:underline">Open Site ↗</a>
          </div>
        </div>

        {/* Page canvas */}
        {sections.length === 0 ? (
          <div className="m-6 bg-white rounded-lg border-2 border-dashed border-gray-300 p-16 text-center">
            <p className="text-4xl mb-3">🏫</p>
            <p className="text-gray-400 text-lg font-medium mb-1">No sections yet</p>
            <p className="text-gray-400 text-sm mb-4">Use the panel on the left to add sections to your page</p>
            <button onClick={() => setLeftTab("widgets")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">+ Add First Section</button>
          </div>
        ) : (
          <div className="bg-white shadow-lg mx-auto" style={{ maxWidth: "900px", minHeight: "100%" }}>
            {/* Inject school theme CSS vars scoped to this canvas */}
            {previewThemeCss && (
              <style dangerouslySetInnerHTML={{ __html: previewThemeCss.replace(/:root\s*\{/, ".website-canvas {") }} />
            )}
            <div className="website-canvas">
            {sections.map((section) => {
              // Apply pending changes for live preview
              const rendered: SchoolSection =
                pendingChanges[section.id]
                  ? {
                      ...section,
                      content: pendingChanges[section.id]?.content ?? section.content,
                      title: pendingChanges[section.id]?.title ?? section.title,
                    }
                  : section;
              return (
                <EditableSectionBlock
                  key={section.id}
                  section={rendered}
                  isSelected={selectedSectionId === section.id}
                  onClick={() => setSelectedSectionId(section.id)}
                />
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL — properties */}
      <div className="w-80 bg-white border-l flex-shrink-0 flex flex-col overflow-hidden shadow-sm z-10">
        <div className="p-3 border-b flex-shrink-0">
          <h3 className="font-semibold text-gray-900 text-sm">Properties</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {selectedSection ? "Editing selected section" : "Click a section to edit"}
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <PropertiesPanel
            section={selectedWithPending}
            onContentChange={handleContentChange}
            onTitleChange={handleTitleChange}
            onSave={handleSave}
            saving={updateSectionMut.isPending}
            onClose={() => setSelectedSectionId(null)}
          />
        </div>
      </div>
    </div>
  );
}
