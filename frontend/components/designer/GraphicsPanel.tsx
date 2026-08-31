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

  /** color baked into the svg string so canvas.addSVG inserts it pre-colored
   *  (fabric keeps `currentColor` literal, so fill AND stroke must be baked) */
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
    <div className="space-y-3 flex flex-col min-h-0">
      {/* QR */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
          <QrCode className="h-3 w-3" /> QR Code
        </p>
        <div className="flex gap-1.5">
          <Input
            placeholder="URL or text…"
            value={qrValue}
            onChange={(e) => setQrValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && qrValue.trim()) { onAddQr(qrValue.trim()); setQrValue(""); }}}
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-2 text-xs shrink-0"
            onClick={() => { if (qrValue.trim()) { onAddQr(qrValue.trim()); setQrValue(""); }}}>
            Insert
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          The QR re-generates automatically for each student during bulk fill.
        </p>
      </div>

      <Separator />

      {/* Watermark */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
          <Stamp className="h-3 w-3" /> Watermark Stamp
        </p>
        <div className="flex gap-1.5">
          <Input value={wmText} onChange={(e) => setWmText(e.target.value)} className="h-8 text-xs" />
          <Button size="sm" variant="outline" className="h-8 px-2 text-xs shrink-0"
            onClick={() => wmText.trim() && onAddWatermark(wmText.trim())}>
            Stamp
          </Button>
        </div>
        <div className="flex gap-1 mt-2">
          {["DRAFT", "COPY", "CONFIDENTIAL", "VERIFIED"].map((t) => (
            <button key={t} onClick={() => onAddWatermark(t)}
              className="text-[9px] px-1.5 py-1 border rounded hover:bg-muted transition-colors">{t}</button>
          ))}
        </div>
      </div>

      <Separator />

      {/* ── Elements browser (Canva-style) ─────────────────────── */}
      <div className="min-h-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
          <Shapes className="h-3 w-3" /> Elements
          <span className="font-normal normal-case tracking-normal">({ELEMENT_TOTAL})</span>
        </p>

        {/* search */}
        <div className="relative mb-2">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder={`Search ${ELEMENT_TOTAL} elements…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>

        {/* accent color row */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-muted-foreground shrink-0">Color</span>
          <ColorRow color={accent} onChange={setAccent} />
        </div>

        <div className="flex gap-2 min-h-0">
          {/* left category rail */}
          <div className="flex flex-col gap-1 shrink-0 overflow-y-auto pr-0.5 max-h-[340px]">
            {ELEMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                title={cat.label}
                onClick={() => { setActiveCat(cat.id); setQuery(""); }}
                className={`w-9 h-9 rounded-lg text-base flex items-center justify-center transition-colors ${
                  activeCat === cat.id && !query.trim()
                    ? "bg-primary/15 ring-1 ring-primary/40"
                    : "hover:bg-muted"
                }`}
              >
                {cat.icon}
              </button>
            ))}
          </div>

          {/* items grid */}
          <div className="flex-1 min-w-0 overflow-y-auto max-h-[340px] pr-0.5">
            {listing.groups.map((group) => (
              <div key={group.id} className="mb-2">
                {query.trim() && (
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">
                    {group.label} · {group.items.length} found
                  </p>
                )}
                {group.items.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-3">
                    No elements match “{query.trim()}”. Try shapes, star, arrow, bubble…
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        title={item.label}
                        onClick={() => insert(item.svg)}
                        className="aspect-square flex items-center justify-center border rounded-lg p-1.5
                          text-muted-foreground hover:text-foreground hover:bg-primary/5 hover:border-primary
                          transition-all [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-9 [&>svg]:max-w-9"
                        dangerouslySetInnerHTML={{ __html: item.svg }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground mt-1.5">
          Click an element to insert it with the selected color. Recolor later from the Properties panel.
        </p>
      </div>
    </div>
  );
}
