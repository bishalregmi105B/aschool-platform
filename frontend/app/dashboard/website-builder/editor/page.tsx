"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAOSRouteParams } from "@/lib/aos-window-route";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { revalidateSchoolSite } from "@/lib/revalidate";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sanitizeCss } from "@/lib/sanitize";
import { ALL_WIDGETS, CATEGORIES, getWidgetDef, getWidgetsByCategory } from "@/lib/school-website/registry";
import { EditorSectionRenderer } from "@/components/website/EditorSectionRenderer";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { ColorField } from "@/components/ui/color-field";
import { VaultImageField } from "@/components/files/VaultImageField";
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
      <div className="p-3 border-b border-[var(--w11-border-subtle)]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search widgets..."
          className="w-full text-sm"
          style={{
            background: "var(--w11-control-bg)",
            color: "var(--w11-text-primary)",
            border: "1px solid var(--w11-control-border)",
            borderRadius: "var(--w11-radius-md)",
            padding: "6px 12px",
          }}
        />
      </div>
      {!search.trim() && (
        <div className="flex gap-1 p-2 border-b border-[var(--w11-border-subtle)] overflow-x-auto flex-shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex-shrink-0 text-xs font-medium transition-colors win11-chip ${activeCategory === cat.key ? "accent" : ""}`}
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
            className="w-full text-left p-3 rounded-lg border border-[var(--w11-border-default)] hover:border-[var(--w11-accent)] hover:bg-[var(--w11-accent-light)] transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl flex-shrink-0">{def.icon}</span>
              <div className="min-w-0">
                <p className="font-medium text-sm group-hover:text-[var(--w11-accent)]" style={{ color: "var(--w11-text-primary)" }}>{def.name}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: "var(--w11-text-tertiary)" }}>{def.description}</p>
              </div>
            </div>
          </button>
        ))}
        {widgets.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: "var(--w11-text-tertiary)" }}>No widgets found</p>
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
      className="border rounded-lg p-3 cursor-pointer transition-all"
      style={
        isSelected
          ? { borderColor: "var(--w11-accent)", background: "var(--w11-accent-light)", boxShadow: "var(--w11-elevation-card)" }
          : { borderColor: "var(--w11-border-default)" }
      }
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <span className="text-base flex-shrink-0">{def?.icon ?? "📦"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--w11-text-primary)" }}>{section.title}</p>
          <p className="text-xs capitalize" style={{ color: "var(--w11-text-tertiary)" }}>{section.type}</p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onMoveUp} disabled={index === 0} title="Move up" className="p-1 rounded hover:bg-[var(--w11-control-hover)] disabled:opacity-30 text-xs">↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} title="Move down" className="p-1 rounded hover:bg-[var(--w11-control-hover)] disabled:opacity-30 text-xs">↓</button>
          <button onClick={onDelete} title="Delete" className="p-1 rounded hover:bg-[var(--w11-control-hover)] text-xs">✕</button>
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
          style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)", border: "1px solid var(--w11-control-border)", borderRadius: "var(--w11-radius-md)", padding: "8px 12px" }} className="w-full text-sm resize-y"
        />
      );
    case "color":
      return (
        <ColorField
          value={(value as string) ?? ""}
          onChange={(v) => onChange(v)}
          className="flex-1"
        />
      );
    case "number":
      return (
        <input type="number" value={(value as number) ?? ""} onChange={(e) => onChange(Number(e.target.value))} step="any" style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)", border: "1px solid var(--w11-control-border)", borderRadius: "var(--w11-radius-md)", padding: "8px 12px" }} className="w-full text-sm" />
      );
    case "toggle":
      return (
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange(!value)}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            style={{ background: value ? "var(--w11-accent)" : "var(--w11-control-active)" }}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{value ? "Enabled" : "Disabled"}</span>
        </div>
      );
    case "select":
      return (
        <AdvancedSelect value={(value as string) ?? ""} onChange={(v) => onChange(v)}
          options={(control.options || []).map((opt) => ({ value: opt.value, label: opt.label }))} />
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
              <input type="text" value={item.label} onChange={(e) => updateItem(i, "label", e.target.value)} placeholder="Students" style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)", border: "1px solid var(--w11-control-border)", borderRadius: "var(--w11-radius-sm)", padding: "6px 8px" }} className="flex-1 text-sm" />
              <button onClick={() => removeItem(i)} style={{ color: "var(--w11-text-secondary)" }} className="text-sm hover:text-[var(--w11-text-primary)]">✕</button>
            </div>
          ))}
          <button onClick={() => onChange([...items, { value: "0+", label: "Label" }])} style={{ border: "2px dashed var(--w11-border-default)", borderRadius: "var(--w11-radius-lg)", color: "var(--w11-text-secondary)" }} className="w-full py-2 text-sm hover:border-[var(--w11-accent)] hover:text-[var(--w11-accent)] transition-colors">+ Add Stat</button>
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
            <div key={i} className="border border-[var(--w11-border-default)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: "var(--w11-text-secondary)" }}>Slide {i + 1}</span>
                <button onClick={() => removeSlide(i)} style={{ color: "var(--w11-text-secondary)" }} className="text-xs hover:text-[var(--w11-text-primary)]">Remove</button>
              </div>
              {["title", "subtitle", "image", "cta_text", "cta_link"].map((key) => (
                <div key={key}>
                  <label className="block text-xs mb-0.5 capitalize" style={{ color: "var(--w11-text-secondary)" }}>{key.replace("_", " ")}</label>
                  <input type="text" value={(slide[key] as string) ?? ""} onChange={(e) => updateSlide(i, key, e.target.value)} style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)", border: "1px solid var(--w11-control-border)", borderRadius: "var(--w11-radius-sm)", padding: "6px 8px" }} className="w-full text-xs" />
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => onChange([...slides, { title: "New Slide", subtitle: "", image: "", cta_text: "Learn More", cta_link: "#" }])} style={{ border: "2px dashed var(--w11-border-default)", borderRadius: "var(--w11-radius-lg)", color: "var(--w11-text-secondary)" }} className="w-full py-2 text-sm hover:border-[var(--w11-accent)] hover:text-[var(--w11-accent)] transition-colors">+ Add Slide</button>
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
            <div key={i} className="border border-[var(--w11-border-default)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: "var(--w11-text-secondary)" }}>Item {i + 1}</span>
                <button onClick={() => removeItem(i)} style={{ color: "var(--w11-text-secondary)" }} className="text-xs hover:text-[var(--w11-text-primary)]">Remove</button>
              </div>
              {Object.entries(item).map(([k, v]) => (
                <div key={k}>
                  <label className="block text-xs mb-0.5 capitalize" style={{ color: "var(--w11-text-secondary)" }}>{k}</label>
                  <input type="text" value={(v as string) ?? ""} onChange={(e) => updateItem(i, k, e.target.value)} style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)", border: "1px solid var(--w11-control-border)", borderRadius: "var(--w11-radius-sm)", padding: "6px 8px" }} className="w-full text-xs" />
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => onChange([...items, { title: "New Item", desc: "" }])} style={{ border: "2px dashed var(--w11-border-default)", borderRadius: "var(--w11-radius-lg)", color: "var(--w11-text-secondary)" }} className="w-full py-2 text-sm hover:border-[var(--w11-accent)] hover:text-[var(--w11-accent)] transition-colors">+ Add Item</button>
        </div>
      );
    }
    case "image":
      return (
        <VaultImageField
          value={(value as string) || null}
          onChange={(url) => onChange(url ?? "")}
          label="Image"
        />
      );
    default:
      return (
        <input type="text" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={control.placeholder} style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)", border: "1px solid var(--w11-control-border)", borderRadius: "var(--w11-radius-md)", padding: "8px 12px" }} className="w-full text-sm" />
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
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>Click a section in the preview to edit its content and style</p>
        <p className="text-xs mt-2" style={{ color: "var(--w11-text-tertiary)" }}>Changes appear instantly and save automatically</p>
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
      <div className="p-4 border-b border-[var(--w11-border-subtle)] flex items-center gap-2 flex-shrink-0">
        <span className="text-xl">{def.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: "var(--w11-text-primary)" }}>{def.name}</p>
          <p className="text-xs truncate" style={{ color: "var(--w11-text-tertiary)" }}>{def.description}</p>
        </div>
        <button onClick={onClose} className="text-lg leading-none" style={{ color: "var(--w11-text-secondary)" }}>×</button>
      </div>

      <div className="p-4 border-b border-[var(--w11-border-subtle)] flex-shrink-0">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--w11-text-secondary)" }}>Section Label</label>
        <input type="text" value={section.title} onChange={(e) => onTitleChange(e.target.value)} style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)", border: "1px solid var(--w11-control-border)", borderRadius: "var(--w11-radius-md)", padding: "8px 12px" }} className="w-full text-sm" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {["content", "style", "advanced"].map((group) => {
          const controls = groups[group];
          if (!controls || controls.length === 0) return null;
          return (
            <div key={group}>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--w11-text-tertiary)" }}>{GROUP_LABELS[group]}</p>
              <div className="space-y-4">
                {controls.map((control) => (
                  <div key={control.key}>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--w11-text-primary)" }}>{control.label}</label>
                    {control.hint && <p className="text-xs mb-1.5" style={{ color: "var(--w11-text-tertiary)" }}>{control.hint}</p>}
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
            ? "ring-2 ring-[var(--w11-accent)] ring-offset-0"
            : "ring-0 group-hover:ring-2 group-hover:ring-[var(--w11-accent-light)] group-hover:ring-offset-0"
        }`}
      />
      {/* Type badge — always visible on hover, highlighted when selected */}
      <div
        className={`absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm transition-all pointer-events-none ${
          isSelected
            ? "opacity-100 bg-[var(--w11-accent)] text-white"
            : "opacity-0 group-hover:opacity-100 text-[var(--w11-text-primary)] border border-[var(--w11-border-default)]"
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
  const searchParams = useAOSRouteParams();
  const pageId = searchParams.get("page");

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<"sections" | "widgets">("sections");
  const [draft, setDraft] = useState<Record<string, SectionDraft>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
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
      // W-02: autosave lands in the DRAFT — the live site keeps rendering
      // the published sections until the user hits Publish.
      const res = await api.put(`/website-builder/pages/${pageId}`, {
        draft: true,
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
      // NOTE: no revalidate here — draft saves must not purge the LIVE site cache.
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

  /** W-02: publish the draft to the live site (single action). */
  const publishDraft = useCallback(async () => {
    if (!pageId) return;
    setSaveState("saving");
    try {
      await api.post(`/website-builder/pages/${pageId}/publish-draft`);
      qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] });
      setSaveState("saved");
      revalidateSchoolSite();
    } catch {
      setSaveState("error");
    }
  }, [pageId, qc]);

  // FC-C03: load history when the panel opens
  useEffect(() => {
    if (!showHistory || !pageId) return;
    api.get(`/website-builder/pages/${pageId}/history`)
      .then((r) => setHistory(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setHistory([]));
  }, [showHistory, pageId]);

  /** FC-C03: discard unsaved draft edits — the live site is untouched. */
  const revertDraft = useCallback(async () => {
    if (!pageId) return;
    setSaveState("saving");
    try {
      await api.post(`/website-builder/pages/${pageId}/revert-draft`);
      setDraft({});
      qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] });
      setSaveState("saved");
      toast.success("Draft reverted to the published version");
    } catch {
      setSaveState("error");
    }
  }, [pageId, qc]);

  /** FC-C03: restore a snapshot from page history. */
  const restoreHistory = useCallback(async (index: number) => {
    if (!pageId) return;
    setSaveState("saving");
    try {
      await api.post(`/website-builder/pages/${pageId}/history/${index}/restore`);
      setDraft({});
      qc.invalidateQueries({ queryKey: ["website-page-sections", pageId] });
      setSaveState("saved");
      revalidateSchoolSite();
      toast.success("Restored from history");
    } catch {
      setSaveState("error");
      toast.error("Restore failed");
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
      <div className="p-8 text-center win11">
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--w11-text-primary)" }}>No page selected</h2>
        <p className="mb-4" style={{ color: "var(--w11-text-secondary)" }}>Go to Pages and click Edit on a page to open the editor.</p>
        <a href="/dashboard/website-builder/pages" className="underline" style={{ color: "var(--w11-accent)" }}>← Go to Pages</a>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="win11 h-screen flex items-center justify-center">
        <div className="win11-spinner" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="win11 h-screen flex items-center justify-center p-6">
        <div className="win11-card max-w-2xl">
          <div className="py-10 text-center space-y-3">
            <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>Failed to load the page content. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetchPage()}>Retry</Button>
          </div>
        </div>
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
  const saveBadgeStyle: React.CSSProperties = {
    color: saveState === "saving" ? "var(--w11-accent)"
      : saveState === "unsaved" ? "var(--w11-text-secondary)"
      : saveState === "error" ? "var(--w11-text-primary)"
      : "var(--w11-accent)",
    background: saveState === "saving" || saveState === "saved" ? "var(--w11-accent-light)" : "var(--w11-control-hover)",
    border: "1px solid var(--w11-border-default)",
  };

  return (
    <div className="win11 flex h-screen overflow-hidden" style={{ background: "var(--w11-window-bg)" }}>
      {/* LEFT PANEL — outline */}
      <div className="w-64 border-r border-[var(--w11-border-default)] flex flex-col flex-shrink-0 z-10 shadow-sm" style={{ background: "var(--w11-surface-solid)" }}>
        <div className="p-3 border-b border-[var(--w11-border-subtle)] flex-shrink-0">
          <a href="/dashboard/website-builder/pages" className="text-xs hover:underline" style={{ color: "var(--w11-accent)" }}>← Pages</a>
          <h2 className="font-bold mt-0.5 truncate text-sm" style={{ color: "var(--w11-text-primary)" }}>{page?.title || "Page"}</h2>
        </div>
        <div className="flex border-b border-[var(--w11-border-subtle)] flex-shrink-0">
          <button
            onClick={() => setLeftTab("sections")}
            className="flex-1 py-2 text-xs font-medium transition-colors"
            style={leftTab === "sections"
              ? { borderBottom: "2px solid var(--w11-accent)", color: "var(--w11-accent)" }
              : { color: "var(--w11-text-secondary)" }}
          >
            Sections ({sortedView.length})
          </button>
          <button
            onClick={() => setLeftTab("widgets")}
            className="flex-1 py-2 text-xs font-medium transition-colors"
            style={leftTab === "widgets"
              ? { borderBottom: "2px solid var(--w11-accent)", color: "var(--w11-accent)" }
              : { color: "var(--w11-text-secondary)" }}
          >
            + Add
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {leftTab === "sections" ? (
            <div className="h-full overflow-y-auto p-2 space-y-1">
              {sortedView.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs" style={{ color: "var(--w11-text-tertiary)" }}>No sections yet</p>
                  <button onClick={() => setLeftTab("widgets")} className="mt-2 text-xs underline" style={{ color: "var(--w11-accent)" }}>Add section →</button>
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
      <div className="flex-1 overflow-y-auto" style={{ background: "var(--w11-control-hover)" }}>
        {/* Toolbar */}
        <div className="sticky top-0 z-20 backdrop-blur border-b border-[var(--w11-border-default)] px-4 py-2 flex items-center justify-between shadow-sm" style={{ background: "var(--w11-surface-solid)" }}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium" style={{ color: "var(--w11-text-secondary)" }}>Live Preview</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={saveBadgeStyle}>{saveBadge}</span>
            {/* W-02: draft saves no longer touch the live site — publish here */}
            <button
              onClick={() => void publishDraft()}
              disabled={saveState === "saving"}
              className="win11-btn accent text-xs"
            >
              Publish
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void revertDraft()}
              disabled={saveState === "saving"}
              className="win11-btn text-xs"
            >
              Revert draft
            </button>
            <button
              onClick={() => void setShowHistory((v) => !v)}
              className="win11-btn text-xs"
            >
              History
            </button>
            <button
              onClick={handleSaveNow}
              disabled={saveState === "saving"}
              className="win11-btn accent text-xs"
            >
              {saveState === "saving" ? "Saving…" : "Save now"}
            </button>
            <a href="/dashboard/website-builder" target="_blank" className="text-xs hover:underline" style={{ color: "var(--w11-accent)" }}>Open Site ↗</a>
          </div>
        </div>

        {/* FC-C03: publish history — restore a previous live version */}
        {showHistory && (
          <div className="mx-6 mt-3 rounded-lg border border-[var(--w11-border-default)] p-3" style={{ background: "var(--w11-card-bg)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Publish history</span>
              <button className="text-xs" style={{ color: "var(--w11-text-secondary)" }} onClick={() => setShowHistory(false)}>close</button>
            </div>
            {history.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>No snapshots yet — publish to create one.</p>
            ) : (
              <ul className="divide-y text-sm">
                {history.map((h: any, i: number) => (
                  <li key={i} className="flex items-center justify-between py-2">
                    <span>
                      {h.published_at
                        ? new Date(h.published_at).toLocaleString()
                        : `Snapshot ${i + 1}`}
                      {typeof h.section_count === "number" ? (
                        <span style={{ color: "var(--w11-text-secondary)" }}> — {h.section_count} sections</span>
                      ) : null}
                    </span>
                    <button className="text-xs hover:underline" style={{ color: "var(--w11-accent)" }}
                      onClick={() => void restoreHistory(i)}>
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Page canvas */}
        {sortedView.length === 0 ? (
          <div className="m-6 rounded-lg border-2 border-dashed p-16 text-center" style={{ background: "var(--w11-card-bg)", borderColor: "var(--w11-border-default)" }}>
            <p className="text-4xl mb-3">🏫</p>
            <p className="text-lg font-medium mb-1" style={{ color: "var(--w11-text-secondary)" }}>No sections yet</p>
            <p className="text-sm mb-4" style={{ color: "var(--w11-text-secondary)" }}>Use the panel on the left to add sections to your page</p>
            <button onClick={() => setLeftTab("widgets")} className="win11-btn accent">+ Add First Section</button>
          </div>
        ) : (
          <div className="shadow-lg mx-auto" style={{ maxWidth: "900px", minHeight: "100%", background: "#ffffff", boxShadow: "var(--w11-elevation-flyout)" }}>
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
      <div className="w-80 border-l border-[var(--w11-border-default)] flex-shrink-0 flex flex-col overflow-hidden shadow-sm z-10" style={{ background: "var(--w11-surface-solid)" }}>
        <div className="p-3 border-b border-[var(--w11-border-subtle)] flex-shrink-0">
          <h3 className="font-semibold text-sm" style={{ color: "var(--w11-text-primary)" }}>Properties</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--w11-text-tertiary)" }}>
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
