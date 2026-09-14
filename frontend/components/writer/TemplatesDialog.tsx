"use client";

/**
 * Writer v2 — Templates gallery dialog.
 *
 * Acrylic (Fluent mica) dialog showing the WRITER templates
 * (editor_type === "writer") from /design-studio/templates: a grid of
 * TemplateThumb cards (real thumbnail or deterministic gradient fallback)
 * with name + category chip. Clicking a template loads it into the editor
 * (same flow as the ?template= param: doc content from the template,
 * docName from the template name, dirty).
 */
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search, FileText, LayoutTemplate, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { TemplateThumb } from "@/components/designer/TemplateThumb";

export interface WriterTemplate {
  id: string;
  template_key?: string;
  name: string;
  category?: string;
  editor_type?: string;
  thumbnail_url?: string | null;
  thumbnail_emoji?: string;
  description?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

/** localStorage trail of the templates this user opened last (wave-J: the
 *  gallery sorts recent-first so the common path is one click). */
const RECENT_KEY = "writer-templates-recent";
function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === "string") : [];
  } catch { return []; }
}
function writeRecent(ids: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(ids)); } catch { /* private mode */ }
}

export function WriterTemplatesDialog({
  open,
  onClose,
  onPick,
  activeTemplateId,
}: {
  open: boolean;
  onClose: () => void;
  /** Load this template into the editor (page handles legacy conversion). */
  onPick: (tpl: WriterTemplate) => void;
  activeTemplateId?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  // recently-used template ids, newest first (persisted across sessions)
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => { if (open) setRecentIds(readRecent()); }, [open]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["design-templates", "writer-gallery"],
    queryFn: async () => {
      const r = await api.get("/design-studio/templates");
      const all = Array.isArray(r.data?.data) ? r.data.data : [];
      return (all as WriterTemplate[]).filter((t) => t.editor_type === "writer");
    },
    enabled: open,
  });

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => { if (t.category) set.add(t.category); });
    return ["all", ...Array.from(set).sort()];
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name?.toLowerCase().includes(q)
        || t.description?.toLowerCase().includes(q)
        || t.category?.toLowerCase().includes(q)
      );
    });
    // recent-first (this user's last-opened ids lead), then newest template
    // by updated_at so a freshly-saved school template floats to the top.
    const rank = new Map(recentIds.map((id, i) => [id, i]));
    return [...list].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
    });
  }, [templates, search, category, recentIds]);

  const pick = (tpl: WriterTemplate) => {
    const next = [tpl.id, ...recentIds.filter((x) => x !== tpl.id)].slice(0, 12);
    setRecentIds(next);
    writeRecent(next);
    onPick(tpl);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      style={{ background: "rgba(0,0,0,0.36)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[86vh] flex flex-col rounded-[var(--w11-radius-lg)] border shadow-2xl overflow-hidden"
        style={{
          background: "rgba(243,243,243,0.92)",
          backdropFilter: "blur(24px) saturate(1.4)",
          borderColor: "var(--w11-window-border)",
          color: "var(--w11-text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div
          className="flex items-center gap-3 px-5 h-14 shrink-0 border-b"
          style={{ borderColor: "var(--w11-border-subtle)" }}
        >
          <LayoutTemplate className="h-5 w-5 shrink-0" style={{ color: "var(--w11-accent)" }} />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">Templates</h2>
            <p className="text-[11px] leading-tight" style={{ color: "var(--w11-text-secondary)" }}>
              Start from a document template — loads into the editor
            </p>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="ml-auto commandbar-button !h-8 !min-h-0 w-8 text-[var(--w11-text-secondary)]"
            style={{ borderRadius: "var(--w11-radius-sm)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* filter row */}
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0 flex-wrap border-b" style={{ borderColor: "var(--w11-border-subtle)" }}>
          <div className="relative w-56">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--w11-text-tertiary)" }} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="pl-7 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className="win11-chip"
                style={
                  category === c
                    ? { borderColor: "var(--w11-accent)", background: "var(--w11-accent-light)", color: "var(--w11-accent)" }
                    : undefined
                }
              >
                {c === "all" ? "All" : c.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[10px]" style={{ color: "var(--w11-text-tertiary)" }}>
            {filtered.length} template{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-2" style={{ color: "var(--w11-text-secondary)" }}>
              <span className="win11-spinner" /> <span className="text-xs">Loading templates…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2" style={{ color: "var(--w11-text-secondary)" }}>
              <FileText className="h-8 w-8 opacity-40" />
              <span className="text-xs">No templates match</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {filtered.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => pick(tpl)}
                  title={tpl.description || tpl.name}
                  className="group relative rounded-[var(--w11-radius-md)] border text-left overflow-hidden transition-all hover:-translate-y-0.5"
                  style={{
                    borderColor: activeTemplateId === tpl.id ? "var(--w11-accent)" : "var(--w11-border-default)",
                    background: "var(--w11-surface-solid)",
                    boxShadow: activeTemplateId === tpl.id
                      ? "0 0 0 1px var(--w11-accent)"
                      : "var(--w11-elevation-card)",
                  }}
                >
                  {/* 4:3 thumb area */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <TemplateThumb
                      url={tpl.thumbnail_url}
                      name={tpl.name || "Template"}
                      eager={filtered.length <= 8}
                      className="transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                    {/* recently-used badge (wave-J: recent-first) */}
                    {recentIds.includes(tpl.id) && (
                      <span
                        className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-[var(--w11-radius-full)] px-1.5 py-0.5 text-[9px] font-semibold backdrop-blur-md"
                        style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
                      >
                        <Clock className="h-2.5 w-2.5" /> Recent
                      </span>
                    )}
                  </div>
                  {/* name + category chip */}
                  <div className="px-2.5 py-2 flex items-center gap-1.5">
                    <span className="text-[11px] font-medium truncate flex-1">{tpl.name}</span>
                    {tpl.category && (
                      <span
                        className="shrink-0 px-1.5 py-0.5 rounded-[var(--w11-radius-full)] text-[9px] font-semibold uppercase tracking-wide"
                        style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}
                      >
                        {tpl.category.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
