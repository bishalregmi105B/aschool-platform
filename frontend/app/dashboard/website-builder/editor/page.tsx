"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { revalidateSchoolSite } from "@/lib/revalidate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sanitizeCss } from "@/lib/sanitize";
import { ALL_WIDGETS, CATEGORIES, getWidgetDef, getWidgetsByCategory } from "@/lib/school-website/registry";
import { EditorSectionRenderer } from "@/components/website/EditorSectionRenderer";
import type { SchoolSection, SchoolWidgetDef, SchoolWidgetControl } from "@/lib/school-website/types";
import { generateThemeCSS, getThemeById, DEFAULT_THEME_ID } from "@/themes/registry";

type ContentState = Record<string, unknown>;
type SectionDraft = { title?: string; content?: ContentState };

interface PageState {
  title: string;
  slug?: string;
  is_published: boolean;
  sections: SchoolSection[];
}

/**
 * Normalize whatever the backend stores in WebsitePage.sections into the
 * editor's SchoolSection shape. Legacy rows (pre-normalizer) may store
 * {slug, category, settings, data} without ids — give those stable local ids
 * so selection/editing works; the next save persists the normalized shape
 * (backend PUT /pages accepts the full sections array, so ids stick).
 */
function normalizeSections(raw: unknown): SchoolSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s, i) => {
      const fallbackKey = typeof s.slug === "string" ? s.slug : typeof s.type === "string" ? s.type : String(i);
      return {
        id: typeof s.id === "string" && s.id ? s.id : `sec-${i}-${fallbackKey}`,
        type: (s.type as string) || (s.slug as string) || "custom",
        title: (s.title as string) || (s.label as string) || "Untitled Section",
        content: (s.content as ContentState) || (s.data as ContentState) || {},
        sort_order: typeof s.sort_order === "number" ? s.sort_order : i,
      };
    });
}

const AUTOSAVE_DELAY_MS = 1500;

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
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-foreground"
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
          <button onClick={onMoveUp} disabled={index === 0} title="Move up" className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-xs">↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} title="Move down" className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-xs">↓</button>
          <button onClick={onDelete} title="Delete" className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 text-xs">✕</button>
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
    case "image":
      return (
        <div className="space-y-1.5">
          <input type="text" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="https://... image URL" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {(value as string) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value as string} alt="Preview" className="h-16 rounded border object-cover" />
          )}
        </div>
      );
    default:
      return (
        <input type="text" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={control.placeholder} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      );
  }
}

// ─── Properties Panel ─────────────────────────────────────────────────────────

function PropertiesPanel({
  section, onContentChange, onTitleChange, onClose,
}: {
  section: SchoolSection | null; onContentChange: (c: ContentState) => void;
  onTitleChange: (t: string) => void; onClose: () => void;
}) {
  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <span className="text-4xl mb-3">👈</span>
        <p className="text-gray-500 text-sm">Click a section in the preview to edit its content and style</p>
        <p className="text-gray-400 text-xs mt-2">Changes appear instantly and save automatically</p>
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
            ? "opacity-100 bg-primary text-primary-foreground"
            : "opacity-0 group-hover:opacity-100 bg-white/90 text-gray-700 border border-gray-200"
        }`}
      >
        <span>{def?.icon ?? "📦"}</span>
        <span>{section.title}</span>
        {isSelected && <span className="ml-0.5">✏️</span>}
      </div>
      {/* Actual rendered section */}
      <EditorSectionRenderer section={section} />
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
  const [draft, setDraft] = useState<Record<string, SectionDraft>>({});
  const [saveState, setSaveState] = useState<"idle" | "unsaved" | "saving" | "saved" | "error">("idle");

  const draftRef = useRef(draft);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistingRef = useRef(false);
  const rerunPersistRef = useRef(false);
  const sectionElsRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => { draftRef.current = draft; }, [draft]);

  const { data: page, isLoading, isError: pageError, refetch: refetchPage } = useQuery<PageState>({
    queryKey: ["website-page-sections", pageId],
    queryFn: async () => {
      const res = await api.get(`/website-builder/pages/${pageId}`);
      const d = res.data?.data ?? {};
      return {
        title: (d.title as string) || "Page",
        slug: d.slug as string | undefined,
        is_published: !!d.is_published,
        sections: normalizeSections(d.sections),
      };
    },
    enabled: !!pageId,
    retry: 1,
    // The cache holds in-progress editor drafts; never let a background
    // refetch (window focus etc.) swap sections mid-edit. We control
    // reconciliation via setQueryData after each successful mutation.
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  // Fetch website config for theme CSS injection in the preview canvas
  const { data: websiteConfig } = useQuery<{ theme_slug?: string; customizations?: { colors?: Record<string, string>; custom_css?: string } }>({
    queryKey: ["website-config-theme"],
    queryFn: () => api.get("/website/config").then((r) => r.data.data || r.data),
    staleTime: 60_000,
  });

  const previewThemeCss = useMemo(() => {
    const themeSlug = websiteConfig?.theme_slug || DEFAULT_THEME_ID;
    const activeTheme = getThemeById(themeSlug) || getThemeById(DEFAULT_THEME_ID);
    const colorOverrides = websiteConfig?.customizations?.colors || {};
    if (!activeTheme) return "";
    // sanitizeCss defends against custom_css smuggled through the config row;
    // generated theme CSS is registry-controlled but passes through the same gate.
    return sanitizeCss(
      generateThemeCSS(activeTheme, colorOverrides) +
        (websiteConfig?.customizations?.custom_css || "")
    );
  }, [websiteConfig]);

  /** Sections as shown/edited: server cache with unsaved drafts applied. */
  const viewSections: SchoolSection[] = useMemo(() => {
    return (page?.sections ?? []).map((s) => {
      const d = draft[s.id];
      return d ? { ...s, title: d.title ?? s.title, content: d.content ?? s.content } : s;
    });
  }, [page?.sections, draft]);

  const selectedSection = viewSections.find((s) => s.id === selectedSectionId) ?? null;

  // ── Persistence: full-page sections PUT ─────────────────────────────────────
  // A single PUT with the complete sections array is used for every change
  // (content edits, reorder, delete). Unlike the per-section endpoints it also
  // works for legacy sections stored without ids: our normalized ids are
  // persisted on the first save, so subsequent saves update the right section.
  const persistSections = useCallback(async () => {
    if (!pageId || persistingRef.current) {
      if (persistingRef.current) rerunPersistRef.current = true;
      return;
    }
    persistingRef.current = true;
    setSaveState("saving");
    // Snapshot everything we are about to send.
    const sentDraft = draftRef.current;
    const base = qc.getQueryData<PageState>(["website-page-sections", pageId])?.sections ?? [];
    const payload = base.map((s) => {
      const d = sentDraft[s.id];
      return d ? { ...s, title: d.title ?? s.title, content: d.content ?? s.content } : s;
    });
    try {
      const res = await api.put(`/website-builder/pages/${pageId}`, {
        sections: payload.map((s, i) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          content: s.content,
          sort_order: typeof s.sort_order === "number" ? s.sort_order : i,
        })),
      });
      const serverSections = normalizeSections(res.data?.data?.sections);
      qc.setQueryData<PageState>(["website-page-sections", pageId], (old) => ({
        ...(old ?? { title: "Page", is_published: false, sections: [] }),
        sections: serverSections,
      }));
      // Drop exactly the draft entries we sent — newer edits (new object
      // identities) survive and trigger the next autosave.
      setDraft((prev) => {
        const next: Record<string, SectionDraft> = {};
        for (const [id, val] of Object.entries(prev)) {
          if (sentDraft[id] !== val) next[id] = val;
        }
        return next;
      });
      setSaveState("saved");
      revalidateSchoolSite();
    } catch {
      setSaveState("error");
      rerunPersistRef.current = false;
      // Retry once after a short pause so transient failures still autosave
      // (the next user edit reschedules this anyway).
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => void persistSections(), 4000);
      return;
    } finally {
      persistingRef.current = false;
    }
    if (rerunPersistRef.current) {
      rerunPersistRef.current = false;
      void persistSections();
    }
  }, [pageId, qc]);

  /** Single shared autosave timer (debounced) used by every change type. */
  const schedulePersist = useCallback(() => {
    setSaveState((cur) => (cur === "saving" ? "saving" : "unsaved"));
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => void persistSections(), AUTOSAVE_DELAY_MS);
  }, [persistSections]);

  // Debounced autosave whenever drafts change.
  useEffect(() => {
    if (Object.keys(draft).length === 0) return;
    schedulePersist();
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [draft, schedulePersist]);

  // Ctrl/Cmd+S flushes immediately.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void persistSections();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persistSections]);

  useEffect(() => () => { if (persistTimerRef.current) clearTimeout(persistTimerRef.current); }, []);

  const handleSaveNow = useCallback(() => {
    void persistSections().then(() => {
      if (Object.keys(draftRef.current).length === 0) toast.success("Changes saved");
    });
  }, [persistSections]);

  // ── Edit handlers ────────────────────────────────────────────────────────────

  const handleContentChange = useCallback(
    (content: ContentState) => {
      if (!selectedSectionId) return;
      setDraft((prev) => ({ ...prev, [selectedSectionId]: { ...prev[selectedSectionId], content } }));
    },
    [selectedSectionId]
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!selectedSectionId) return;
      setDraft((prev) => ({ ...prev, [selectedSectionId]: { ...prev[selectedSectionId], title } }));
    },
    [selectedSectionId]
  );

  const addSectionMut = useMutation({
    mutationFn: (s: { type: string; title: string; content: Record<string, unknown> }) =>
      api.post(`/website-builder/pages/${pageId}/sections`, s).then((r) => normalizeSections([r.data?.data])[0]),
    onSuccess: (newSection) => {
      if (!newSection) return;
      qc.setQueryData<PageState>(["website-page-sections", pageId], (old) => ({
        ...(old ?? { title: "Page", is_published: false, sections: [] }),
        sections: [...(old?.sections ?? []), newSection],
      }));
      // The POST endpoint already persists the new section.
      setSaveState((cur) => (cur === "saving" ? cur : "saved"));
    },
    onError: () => toast.error("Failed to add the section"),
  });

  const handleAddWidget = useCallback(
    (def: SchoolWidgetDef) => {
      setLeftTab("sections");
      addSectionMut.mutate(
        { type: def.type, title: def.name, content: def.defaultContent },
        {
          onSuccess: (newSection) => {
            if (newSection) setSelectedSectionId(newSection.id);
            toast.success(`"${def.name}" section added`);
          },
        }
      );
    },
    [addSectionMut]
  );

  const handleMove = useCallback(
    (sectionId: string, direction: "up" | "down") => {
      qc.setQueryData<PageState>(["website-page-sections", pageId], (old) => {
        if (!old) return old;
        const list = [...old.sections].sort((a, b) => a.sort_order - b.sort_order);
        const idx = list.findIndex((s) => s.id === sectionId);
        const target = direction === "up" ? idx - 1 : idx + 1;
        if (idx === -1 || target < 0 || target >= list.length) return old;
        [list[idx], list[target]] = [list[target], list[idx]];
        return { ...old, sections: list.map((s, i) => ({ ...s, sort_order: i })) };
      });
      schedulePersist();
    },
    [pageId, qc, schedulePersist]
  );

  const handleDelete = useCallback(
    (sectionId: string) => {
      if (!confirm("Delete this section?")) return;
      qc.setQueryData<PageState>(["website-page-sections", pageId], (old) =>
        old
          ? { ...old, sections: old.sections.filter((s) => s.id !== sectionId).map((s, i) => ({ ...s, sort_order: i })) }
          : old
      );
      setDraft((prev) => {
        if (!(sectionId in prev)) return prev;
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });
      if (selectedSectionId === sectionId) setSelectedSectionId(null);
      schedulePersist();
    },
    [pageId, qc, selectedSectionId, schedulePersist]
  );

  const selectSection = useCallback((sectionId: string, fromOutline = false) => {
    setSelectedSectionId(sectionId);
    if (fromOutline) {
      sectionElsRef.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // ── Guards ───────────────────────────────────────────────────────────────────

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

  if (pageError) {
    return (
      <div className="p-6 max-w-2xl">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load the page content. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetchPage()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  const sortedView = [...viewSections].sort((a, b) => a.sort_order - b.sort_order);
  const saveBadge =
    saveState === "saving" ? "Saving…"
    : saveState === "unsaved" ? "● Unsaved"
    : saveState === "error" ? "⚠ Save failed — retrying"
    : saveState === "saved" ? "✓ Saved"
    : "All changes saved";
  const saveBadgeClass =
    saveState === "saving" ? "text-blue-700 bg-blue-50 border-blue-200"
    : saveState === "unsaved" ? "text-amber-700 bg-amber-50 border-amber-200"
    : saveState === "error" ? "text-red-700 bg-red-50 border-red-200"
    : "text-green-700 bg-green-50 border-green-200";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* LEFT PANEL — outline */}
      <div className="w-64 bg-white border-r flex flex-col flex-shrink-0 z-10 shadow-sm">
        <div className="p-3 border-b flex-shrink-0">
          <a href="/dashboard/website-builder/pages" className="text-xs text-blue-600 hover:underline">← Pages</a>
          <h2 className="font-bold text-gray-900 mt-0.5 truncate text-sm">{page?.title || "Page"}</h2>
        </div>
        <div className="flex border-b flex-shrink-0">
          <button
            onClick={() => setLeftTab("sections")}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${leftTab === "sections" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
          >
            Sections ({sortedView.length})
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
              {sortedView.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-400 text-xs">No sections yet</p>
                  <button onClick={() => setLeftTab("widgets")} className="mt-2 text-blue-600 text-xs underline">Add section →</button>
                </div>
              ) : (
                sortedView.map((section, idx) => (
                  <SectionItem
                    key={section.id}
                    section={section}
                    index={idx}
                    total={sortedView.length}
                    isSelected={selectedSectionId === section.id}
                    onSelect={() => selectSection(section.id, true)}
                    onMoveUp={() => handleMove(section.id, "up")}
                    onMoveDown={() => handleMove(section.id, "down")}
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
            <span className={`text-xs px-2 py-0.5 rounded-full border ${saveBadgeClass}`}>{saveBadge}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveNow}
              disabled={saveState === "saving"}
              className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saveState === "saving" ? "Saving…" : "Save now"}
            </button>
            <a href="/dashboard/website-builder" target="_blank" className="text-xs text-blue-600 hover:underline">Open Site ↗</a>
          </div>
        </div>

        {/* Page canvas */}
        {sortedView.length === 0 ? (
          <div className="m-6 bg-white rounded-lg border-2 border-dashed border-gray-300 p-16 text-center">
            <p className="text-4xl mb-3">🏫</p>
            <p className="text-gray-400 text-lg font-medium mb-1">No sections yet</p>
            <p className="text-gray-400 text-sm mb-4">Use the panel on the left to add sections to your page</p>
            <button onClick={() => setLeftTab("widgets")} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">+ Add First Section</button>
          </div>
        ) : (
          <div className="bg-white shadow-lg mx-auto" style={{ maxWidth: "900px", minHeight: "100%" }}>
            {/* Inject school theme CSS vars scoped to this canvas */}
            {previewThemeCss && (
              <style dangerouslySetInnerHTML={{ __html: previewThemeCss.replace(/:root\s*\{/, ".website-canvas {") }} />
            )}
            <div className="website-canvas">
              {sortedView.map((section) => (
                <div
                  key={section.id}
                  ref={(el) => { sectionElsRef.current[section.id] = el; }}
                >
                  <EditableSectionBlock
                    section={section}
                    isSelected={selectedSectionId === section.id}
                    onClick={() => selectSection(section.id)}
                  />
                </div>
              ))}
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
            section={selectedSection}
            onContentChange={handleContentChange}
            onTitleChange={handleTitleChange}
            onClose={() => setSelectedSectionId(null)}
          />
        </div>
      </div>
    </div>
  );
}
