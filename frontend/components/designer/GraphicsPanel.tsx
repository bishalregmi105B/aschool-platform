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
              ? "ring-2 ring-offset-1 ring-primary border-transparent"
              : "border-border"
          }`}
        />
      ))}
      <label
        title="Custom color"
        className="w-6 h-6 rounded-full border border-border cursor-pointer relative overflow-hidden hover:scale-110 transition-transform"
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
    <div className="space-y-4">
      {/* QR Code Card */}
      <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm space-y-2 shadow-xs">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <QrCode className="h-3.5 w-3.5 text-primary" /> QR Code Generator
          </p>
        </div>
        <div className="flex gap-1.5">
          <Input
            placeholder="URL, student symbol no or text…"
            value={qrValue}
            onChange={(e) => setQrValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && qrValue.trim()) { onAddQr(qrValue.trim()); setQrValue(""); }}}
            className="h-8 text-xs bg-background/80 rounded-xl"
          />
          <Button size="sm" className="h-8 px-3 text-xs rounded-xl shadow-xs shrink-0"
            onClick={() => { if (qrValue.trim()) { onAddQr(qrValue.trim()); setQrValue(""); }}}>
            Insert
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">
          QR codes automatically bind to individual student tokens during bulk generation.
        </p>
      </div>

      {/* Watermark Card */}
      <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm space-y-2.5 shadow-xs">
        <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
          <Stamp className="h-3.5 w-3.5 text-amber-500" /> Watermark Stamp
        </p>
        <div className="flex gap-1.5">
          <Input
            value={wmText}
            onChange={(e) => setWmText(e.target.value)}
            className="h-8 text-xs bg-background/80 rounded-xl"
            placeholder="Stamp text…"
          />
          <Button size="sm" variant="outline" className="h-8 px-3 text-xs rounded-xl shrink-0"
            onClick={() => wmText.trim() && onAddWatermark(wmText.trim())}>
            Apply
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["DRAFT", "COPY", "CONFIDENTIAL", "VERIFIED", "ORIGINAL"].map((t) => (
            <button
              key={t}
              onClick={() => onAddWatermark(t)}
              className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-border/80 bg-background/60 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-150"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Elements browser (Canva-style) ─────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <Shapes className="h-3.5 w-3.5 text-primary" /> Graphics & Elements
            <span className="text-[10px] font-normal text-muted-foreground">({ELEMENT_TOTAL})</span>
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder={`Search ${ELEMENT_TOTAL} vector elements…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-xs pl-8 bg-background/80 rounded-xl"
          />
        </div>

        {/* Accent Color Picker Row */}
        <div className="flex items-center justify-between py-1">
          <span className="text-[10px] font-medium text-muted-foreground">Color</span>
          <ColorRow color={accent} onChange={setAccent} />
        </div>

        {/* Horizontal Category Pill Strip */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
          {ELEMENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCat(cat.id); setQuery(""); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all duration-150 shrink-0 ${
                activeCat === cat.id && !query.trim()
                  ? "bg-primary text-primary-foreground font-medium shadow-xs"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Elements Grid (Clean, single scroll with parent) */}
        <div>
          {listing.groups.map((group) => (
            <div key={group.id} className="space-y-2">
              {query.trim() && (
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {group.label} · {group.items.length} found
                </p>
              )}
              {group.items.length === 0 ? (
                <div className="text-center py-6 px-3 bg-muted/20 rounded-2xl border border-dashed border-border/60">
                  <p className="text-xs text-muted-foreground font-medium">No elements found</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">Try shapes, star, arrow, heart, badge…</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      title={item.label}
                      onClick={() => insert(item.svg)}
                      className="aspect-square flex items-center justify-center border border-border/70 rounded-xl p-2
                        bg-card/60 hover:bg-primary/10 hover:border-primary hover:shadow-md hover:scale-[1.06]
                        transition-all duration-150 text-muted-foreground hover:text-foreground
                        [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-8 [&>svg]:max-w-8"
                      dangerouslySetInnerHTML={{ __html: item.svg }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground/80 text-center pt-1">
          Click any element to add. Re-color anytime from the Properties panel.
        </p>
      </div>
    </div>
  );
}
