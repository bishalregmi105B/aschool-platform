"use client";

/**
 * GraphicsPanel — Canva-style elements browser (search + category rail +
 * thumbnail grid with accent recolor), plus the QR generator and watermark
 * stamps from the original panel.
 *
 * Element library lives in lib/designer/elements.ts. Clicking a thumbnail
 * bakes the accent color into the SVG string and hands it to onAddIcon,
 * which CanvasEditor wires to canvas.addSVG(svg, {}, color) — a colorable
 * fabric Group.
 *
 * Skinned with 11.css (Win11 Fluent) tokens — var(--w11-*) — so the panel
 * adapts to the AOS light AND dark themes. Renders inside CanvasEditor's
 * win11 scope, so no scope of its own is needed.
 */
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { QrCode, Stamp, Search, Shapes } from "lucide-react";
import {
  ELEMENT_CATEGORIES, ELEMENT_PRESET_COLORS, ELEMENT_TOTAL, searchElements,
} from "@/lib/designer/elements";

const ICON_COLOR = "#64748b";

interface Props {
  onAddQr: (value: string) => void;
  onAddWatermark: (text: string) => void;
  onAddIcon: (svg: string, color: string) => void;
}

/** Fluent section card: control surface + subtle border + soft radius. */
function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--w11-radius-lg)] border border-[var(--w11-border-subtle)] space-y-2 ${className}`}
      style={{ background: "var(--w11-control-bg)" }}
    >
      {children}
    </div>
  );
}

/** Canva-style swatch row: preset colors + native free color input. */
function ColorRow({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ELEMENT_PRESET_COLORS.map((c) => (
        <button
          key={c}
          title={c}
          onClick={() => onChange(c)}
          style={{ background: c }}
          className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${
            color.toLowerCase() === c.toLowerCase()
              ? "ring-2 ring-[var(--w11-accent)] ring-offset-1 ring-offset-[var(--w11-surface-solid)] border-transparent"
              : "border-[var(--w11-border-default)]"
          }`}
        />
      ))}
      <label
        title="Custom color"
        className="w-6 h-6 rounded-full border border-[var(--w11-border-default)] cursor-pointer relative overflow-hidden hover:scale-110 transition-transform"
        style={{
          background:
            "conic-gradient(#ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
        }}
      >
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
    </div>
  );
}

export default function GraphicsPanel({ onAddQr, onAddWatermark, onAddIcon }: Props) {
  const [qrValue, setQrValue] = useState("");
  const [wmText, setWmText] = useState("DRAFT");

  // elements browser state
  const [accent, setAccent] = useState(ICON_COLOR);
  const [activeCat, setActiveCat] = useState(ELEMENT_CATEGORIES[0].id);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  /** color baked into the svg string so canvas.addSVG inserts it pre-colored */
  const insert = (svg: string) => onAddIcon(svg.replace(/currentColor/g, accent), accent);

  /** items for the active category, or search hits across all categories */
  const listing = useMemo(() => {
    const q = query.trim();
    if (q) {
      return { mode: "search" as const, groups: [{ id: "__search", label: "Results", icon: "🔎", items: searchElements(q).map((r) => r.item) }] };
    }
    const cat = ELEMENT_CATEGORIES.find((c) => c.id === activeCat) ?? ELEMENT_CATEGORIES[0];
    return { mode: "browse" as const, groups: [cat] };
  }, [query, activeCat]);

  return (
    <div className="space-y-4 text-[var(--w11-text-primary)]">
      {/* QR Code Card */}
      <SectionCard className="p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-[var(--w11-text-primary)] flex items-center gap-1.5">
            <QrCode className="h-3.5 w-3.5" style={{ color: "var(--w11-accent)" }} /> QR Code Generator
          </p>
        </div>
        <div className="flex gap-1.5">
          <Input
            placeholder="URL, student symbol no or text…"
            value={qrValue}
            onChange={(e) => setQrValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && qrValue.trim()) { onAddQr(qrValue.trim()); setQrValue(""); }}}
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-3 text-xs shrink-0"
            onClick={() => { if (qrValue.trim()) { onAddQr(qrValue.trim()); setQrValue(""); }}}>
            Insert
          </Button>
        </div>
        <div className="text-[10px] text-[var(--w11-text-secondary)] leading-tight">
          QR codes automatically bind to individual student tokens during bulk generation.
        </div>
      </SectionCard>

      {/* Watermark Card */}
      <SectionCard className="p-3.5 space-y-2.5">
        <p className="text-[11px] font-semibold text-[var(--w11-text-primary)] flex items-center gap-1.5">
          <Stamp className="h-3.5 w-3.5 text-amber-500" /> Watermark Stamp
        </p>
        <div className="flex gap-1.5">
          <Input
            value={wmText}
            onChange={(e) => setWmText(e.target.value)}
            className="h-8 text-xs"
            placeholder="Stamp text…"
          />
          <Button size="sm" variant="outline" className="h-8 px-3 text-xs shrink-0"
            onClick={() => wmText.trim() && onAddWatermark(wmText.trim())}>
            Apply
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["DRAFT", "COPY", "CONFIDENTIAL", "VERIFIED", "ORIGINAL"].map((t) => (
            <button
              key={t}
              onClick={() => onAddWatermark(t)}
              className="text-[10px] font-medium px-2.5 py-1 rounded-[var(--w11-radius-full)] border border-[var(--w11-border-default)] hover:bg-[var(--w11-accent-light)] hover:border-[var(--w11-accent)] hover:text-[var(--w11-accent)] transition-colors"
              style={{ background: "var(--w11-control-bg)", transitionDuration: "var(--w11-transition-fast)" }}
            >
              {t}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── Elements browser (Canva-style) ─────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-[var(--w11-text-primary)] flex items-center gap-1.5">
            <Shapes className="h-3.5 w-3.5" style={{ color: "var(--w11-accent)" }} /> Graphics &amp; Elements
            <span className="text-[10px] font-normal text-[var(--w11-text-secondary)]">({ELEMENT_TOTAL})</span>
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--w11-text-tertiary)] pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder={`Search ${ELEMENT_TOTAL} vector elements…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>

        {/* Accent Color Picker Row */}
        <div className="flex items-center justify-between py-1">
          <span className="text-[10px] font-medium text-[var(--w11-text-secondary)]">Color</span>
          <ColorRow color={accent} onChange={setAccent} />
        </div>

        {/* Horizontal Category Pill Strip — active = accent-light + accent text */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
          {ELEMENT_CATEGORIES.map((cat) => {
            const on = activeCat === cat.id && !query.trim();
            return (
              <button
                key={cat.id}
                onClick={() => { setActiveCat(cat.id); setQuery(""); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--w11-radius-full)] text-[11px] whitespace-nowrap shrink-0"
                style={{
                  transition: "background var(--w11-transition-fast), color var(--w11-transition-fast)",
                  ...(on
                    ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)", fontWeight: 600 }
                    : { background: "var(--w11-control-hover)", color: "var(--w11-text-secondary)" }),
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Elements Grid (Clean, single scroll with parent) */}
        <div>
          {listing.groups.map((group) => (
            <div key={group.id} className="space-y-2">
              {query.trim() && (
                <div className="text-[10px] font-medium text-[var(--w11-text-tertiary)] uppercase tracking-wider">
                  {group.label} · {group.items.length} found
                </div>
              )}
              {group.items.length === 0 ? (
                <div className="text-center py-6 px-3 rounded-[var(--w11-radius-lg)] border border-dashed border-[var(--w11-border-default)]">
                  <div className="text-xs text-[var(--w11-text-secondary)] font-medium">No elements found</div>
                  <div className="text-[10px] text-[var(--w11-text-tertiary)] mt-0.5">Try shapes, star, arrow, heart, badge…</div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      title={item.label}
                      onClick={() => insert(item.svg)}
                      className="aspect-square flex items-center justify-center border border-[var(--w11-border-subtle)] rounded-[var(--w11-radius-md)] p-2
                        hover:bg-[var(--w11-accent-light)] hover:border-[var(--w11-accent)] transition-colors text-[var(--w11-text-secondary)]
                        [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-8 [&>svg]:max-w-8"
                      style={{ background: "var(--w11-control-bg)", transitionDuration: "var(--w11-transition-fast)" }}
                      dangerouslySetInnerHTML={{ __html: item.svg }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-[10px] text-[var(--w11-text-tertiary)] text-center pt-1">
          Click any element to add. Re-color anytime from the Properties panel.
        </div>
      </div>
    </div>
  );
}
