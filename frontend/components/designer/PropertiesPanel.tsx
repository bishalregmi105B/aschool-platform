"use client";

/**
 * PropertiesPanel — right panel with object properties + page settings.
 * When nothing is selected → Page Settings (size, orientation, margins, bg).
 * When an object is selected → its type-specific properties.
 *
 * Skinned with 11.css (Win11 Fluent) tokens — var(--w11-*) — so the panel
 * adapts to the AOS light AND dark themes. Renders inside CanvasEditor's
 * win11 scope, so no scope of its own is needed.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PAGE_SIZES, PageMargins } from "@/lib/hooks/useCanvas";

// ── Google Fonts available in the picker ──────────────────────────────────────
const SYSTEM_FONTS = [
  "Arial", "Georgia", "Times New Roman", "Courier New",
  "Verdana", "Trebuchet MS", "Impact", "Comic Sans MS",
];

const GOOGLE_FONTS = [
  "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald",
  "Source Sans Pro", "Raleway", "Ubuntu", "Nunito", "Poppins",
  "Playfair Display", "Merriweather", "PT Serif", "PT Sans",
  "Libre Baskerville", "Josefin Sans", "Abril Fatface", "Lobster",
  "Dancing Script", "Pacifico", "Caveat", "Satisfy",
];

const ALL_FONTS = [...SYSTEM_FONTS, ...GOOGLE_FONTS];

/** Fluent section card: control surface + subtle border + soft radius. */
function SectionCard({ title, children, className = "" }: {
  title?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--w11-radius-lg)] border border-[var(--w11-border-subtle)] space-y-2.5 ${className}`}
      style={{ background: "var(--w11-control-bg)" }}
    >
      {title && (
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--w11-text-tertiary)]">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function loadGoogleFont(family: string) {
  const id = `gfont-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

interface Props {
  canvas: any;
}

export default function PropertiesPanel({ canvas }: Props) {
  const obj  = canvas.selectedObject;
  const page = canvas.currentPageSettings;

  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate(n => n + 1), []);

  useEffect(() => { refresh(); }, [obj, refresh]);

  if (!obj) {
    // ── Page Settings ───────────────────────────────────────────
    return <PageSettingsPanel canvas={canvas} page={page} />;
  }

  const set = (props: Record<string, any>) => {
    obj.set(props);
    obj.canvas?.renderAll();
    refresh();
  };

  const isText  = ["textbox", "text", "i-text"].includes(obj.type);
  const isShape = ["rect", "circle", "triangle", "polygon", "path", "line"].includes(obj.type);
  const isImage = obj.type === "image";

  return (
    <div className="p-3 space-y-3.5 text-sm overflow-y-auto h-full custom-scrollbar text-[var(--w11-text-primary)]">

      {/* Position & Size */}
      <SectionCard title="Transform & Dimensions">
        <div className="grid grid-cols-2 gap-2">
          {[
            ["X", "left"],
            ["Y", "top"],
          ].map(([label, prop]) => (
            <div key={prop} className="relative flex items-center">
              <span className="absolute left-2.5 text-[10px] font-bold text-[var(--w11-text-tertiary)] pointer-events-none">{label}</span>
              <Input type="number" className="h-8 pl-7 text-xs" value={Math.round(obj[prop] ?? 0)}
                onChange={(e) => set({ [prop]: Number(e.target.value) })} />
            </div>
          ))}
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[10px] font-bold text-[var(--w11-text-tertiary)] pointer-events-none">W</span>
            <Input type="number" className="h-8 pl-7 text-xs"
              value={Math.round(obj.getScaledWidth?.() ?? obj.width ?? 0)}
              onChange={(e) => set({ scaleX: Number(e.target.value) / (obj.width || 1) })} />
          </div>
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[10px] font-bold text-[var(--w11-text-tertiary)] pointer-events-none">H</span>
            <Input type="number" className="h-8 pl-7 text-xs"
              value={Math.round(obj.getScaledHeight?.() ?? obj.height ?? 0)}
              onChange={(e) => set({ scaleY: Number(e.target.value) / (obj.height || 1) })} />
          </div>
        </div>

        {/* Rotation & Opacity */}
        <div className="space-y-2 pt-2 border-t border-[var(--w11-border-subtle)]">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)]">Rotation</Label>
              <span className="text-[10px] font-mono text-[var(--w11-text-primary)] font-semibold">{Math.round(obj.angle ?? 0)}°</span>
            </div>
            <Slider min={0} max={360} step={1} value={[obj.angle ?? 0]}
              onValueChange={([v]) => set({ angle: v })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)]">Opacity</Label>
              <span className="text-[10px] font-mono text-[var(--w11-text-primary)] font-semibold">{Math.round((obj.opacity ?? 1) * 100)}%</span>
            </div>
            <Slider min={0} max={100} step={1} value={[Math.round((obj.opacity ?? 1) * 100)]}
              onValueChange={([v]) => set({ opacity: v / 100 })} />
          </div>
        </div>
      </SectionCard>

      {/* ── Text properties ──────────────────────────────── */}
      {isText && (
        <SectionCard title="Text & Typography" className="space-y-3">
          {/* Font family */}
          <div>
            <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)] mb-1 block">Font Family</Label>
            <Select value={obj.fontFamily ?? "Arial"} onValueChange={(v) => {
              if (GOOGLE_FONTS.includes(v)) loadGoogleFont(v);
              set({ fontFamily: v });
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                <div className="px-2 py-1 text-[10px] text-[var(--w11-text-tertiary)] font-semibold">System Fonts</div>
                {SYSTEM_FONTS.map(f => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                ))}
                <div className="px-2 py-1 text-[10px] text-[var(--w11-text-tertiary)] font-semibold mt-1">Google Fonts</div>
                {GOOGLE_FONTS.map(f => (
                  <SelectItem key={f} value={f}>
                    <span style={{ fontFamily: SYSTEM_FONTS.includes(f) ? f : undefined }}>{f}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size + color */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)] mb-1 block">Font Size</Label>
              <Input type="number" className="h-8 text-xs" value={obj.fontSize ?? 20}
                onChange={(e) => set({ fontSize: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)] mb-1 block">Color</Label>
              <div className="flex items-center gap-2 p-1 rounded-[var(--w11-radius-md)] border border-[var(--w11-border-subtle)]"
                style={{ background: "var(--w11-control-bg)" }}>
                <input type="color" className="h-6 w-8 rounded-[var(--w11-radius-sm)] border-0 cursor-pointer block p-0"
                  value={typeof obj.fill === "string" && obj.fill.startsWith("#") ? obj.fill : "#000000"}
                  onChange={(e) => set({ fill: e.target.value })} />
                <span className="text-[10px] font-mono text-[var(--w11-text-tertiary)] uppercase truncate">{typeof obj.fill === "string" ? obj.fill : "#000"}</span>
              </div>
            </div>
          </div>

          {/* Bold / Italic / Underline / Strike */}
          <div>
            <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)] mb-1 block">Formatting</Label>
            <div className="flex gap-1">
              {([
                ["B", "fontWeight",  "bold",   "normal"],
                ["I", "fontStyle",   "italic", "normal"],
                ["U", "underline",   true,     false   ],
                ["S", "linethrough", true,     false   ],
              ] as const).map(([lbl, prop, on, off]) => {
                const active = obj[prop as string] === on;
                return (
                  <button key={lbl as string}
                    className="flex-1 h-8 text-xs rounded-[var(--w11-radius-md)] border font-bold"
                    style={{
                      transition: "background var(--w11-transition-fast), color var(--w11-transition-fast)",
                      ...(active
                        ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)", borderColor: "transparent" }
                        : { background: "var(--w11-control-bg)", color: "var(--w11-text-secondary)", borderColor: "var(--w11-border-default)" }),
                    }}
                    onClick={() => set({ [prop as string]: obj[prop as string] === on ? off : on })}
                  >{lbl as string}</button>
                );
              })}
            </div>
          </div>

          {/* Line height */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)]">Line Height</Label>
              <span className="text-[10px] font-mono font-semibold text-[var(--w11-text-primary)]">{(obj.lineHeight ?? 1.4).toFixed(1)}</span>
            </div>
            <Slider min={8} max={30} step={1} value={[Math.round((obj.lineHeight ?? 1.4) * 10)]}
              onValueChange={([v]) => set({ lineHeight: v / 10 })} />
          </div>

          {/* Char spacing */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)]">Letter Spacing</Label>
              <span className="text-[10px] font-mono font-semibold text-[var(--w11-text-primary)]">{obj.charSpacing ?? 0}</span>
            </div>
            <Slider min={-100} max={400} step={10} value={[obj.charSpacing ?? 0]}
              onValueChange={([v]) => set({ charSpacing: v })} />
          </div>

          {/* Alignment */}
          <div>
            <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)] mb-1 block">Alignment</Label>
            <div className="flex gap-1">
              {["left", "center", "right", "justify"].map(a => {
                const active = obj.textAlign === a;
                return (
                  <button key={a}
                    className="flex-1 py-1 text-[11px] rounded-[var(--w11-radius-md)] border capitalize font-medium"
                    style={{
                      transition: "background var(--w11-transition-fast), color var(--w11-transition-fast)",
                      ...(active
                        ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)", borderColor: "transparent" }
                        : { background: "var(--w11-control-bg)", color: "var(--w11-text-secondary)", borderColor: "var(--w11-border-default)" }),
                    }}
                    onClick={() => set({ textAlign: a })}
                  >{a[0].toUpperCase() + a.slice(1)}</button>
                );
              })}
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── Shape properties ─────────────────────────────── */}
      {isShape && (
        <SectionCard title="Shape & Style" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)] mb-1 block">Fill</Label>
              <div className="flex items-center gap-2 p-1.5 rounded-[var(--w11-radius-md)] border border-[var(--w11-border-subtle)]"
                style={{ background: "var(--w11-control-bg)" }}>
                <input type="color" className="h-6 w-8 rounded-[var(--w11-radius-sm)] border-0 cursor-pointer block p-0"
                  value={typeof obj.fill === "string" && obj.fill.startsWith("#") ? obj.fill : "#3b82f6"}
                  onChange={(e) => set({ fill: e.target.value })} />
                <span className="text-[10px] font-mono uppercase text-[var(--w11-text-tertiary)] truncate">{typeof obj.fill === "string" ? obj.fill : "Color"}</span>
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)] mb-1 block">Stroke</Label>
              <div className="flex items-center gap-2 p-1.5 rounded-[var(--w11-radius-md)] border border-[var(--w11-border-subtle)]"
                style={{ background: "var(--w11-control-bg)" }}>
                <input type="color" className="h-6 w-8 rounded-[var(--w11-radius-sm)] border-0 cursor-pointer block p-0"
                  value={obj.stroke ?? "#000000"}
                  onChange={(e) => set({ stroke: e.target.value })} />
                <span className="text-[10px] font-mono uppercase text-[var(--w11-text-tertiary)] truncate">{obj.stroke || "None"}</span>
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)]">Stroke Width</Label>
              <span className="text-[10px] font-mono font-semibold text-[var(--w11-text-primary)]">{obj.strokeWidth ?? 0}px</span>
            </div>
            <Slider min={0} max={20} step={1} value={[obj.strokeWidth ?? 0]}
              onValueChange={([v]) => set({ strokeWidth: v })} />
          </div>
          {obj.type === "rect" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)]">Corner Radius</Label>
                <span className="text-[10px] font-mono font-semibold text-[var(--w11-text-primary)]">{obj.rx ?? 0}px</span>
              </div>
              <Slider min={0} max={60} step={1} value={[obj.rx ?? 0]}
                onValueChange={([v]) => set({ rx: v, ry: v })} />
            </div>
          )}
          {/* Shadow */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--w11-border-subtle)]">
            <Label className="text-xs font-medium text-[var(--w11-text-primary)]">Drop Shadow</Label>
            <Switch checked={!!obj.shadow}
              onCheckedChange={(v) => {
                if (v) {
                  import("fabric").then(({ Shadow }) => {
                    obj.set({ shadow: new Shadow({ color: "rgba(0,0,0,0.25)", blur: 12, offsetX: 4, offsetY: 4 }) });
                    obj.canvas?.renderAll(); refresh();
                  });
                } else { set({ shadow: null }); }
              }} />
          </div>
        </SectionCard>
      )}

      {/* ── Image properties ─────────────────────────────── */}
      {isImage && (
        <SectionCard title="Image Filters & Effects" className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-[var(--w11-text-primary)]">Lock Aspect Ratio</Label>
            <Switch checked={!!obj.lockUniScaling}
              onCheckedChange={(v) => set({ lockUniScaling: v })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] font-medium text-[var(--w11-text-secondary)]">Brightness</Label>
              <span className="text-[10px] font-mono font-semibold text-[var(--w11-text-primary)]">{obj._fbBrightness ?? 0}</span>
            </div>
            <Slider min={-100} max={100} step={5}
              value={[obj._fbBrightness ?? 0]}
              onValueChange={([v]) => {
                import("fabric").then(({ filters }) => {
                  obj._fbBrightness = v;
                  const existing = (obj.filters ?? []).filter((f: any) => f.type !== "Brightness");
                  if (v !== 0) existing.push(new filters.Brightness({ brightness: v / 100 }));
                  obj.filters = existing;
                  obj.applyFilters(); obj.canvas?.renderAll(); refresh();
                });
              }} />
          </div>
          <ImageEffects obj={obj} refresh={refresh} />
          <PhotoFrames obj={obj} refresh={refresh} />
          <CropTool obj={obj} refresh={refresh} />
        </SectionCard>
      )}

      {/* Lock Position */}
      <SectionCard className="!space-y-0 p-3 flex items-center justify-between">
        <Label className="text-xs font-medium text-[var(--w11-text-primary)]">Lock Position (Freeze)</Label>
        <Switch
          checked={!!obj.lockMovementX}
          onCheckedChange={(v) => set({ lockMovementX: v, lockMovementY: v })}
        />
      </SectionCard>
    </div>
  );
}

// ── Image effects (fabric v6 native filters) ─────────────────────────────────
function ImageEffects({ obj, refresh }: { obj: any; refresh: () => void }) {
  const active = (type: string) => (obj.filters ?? []).some((f: any) => f.type === type);

  const toggle = (type: string) => {
    import("fabric").then(({ filters }) => {
      const rest = (obj.filters ?? []).filter((f: any) => f.type !== type);
      if (!active(type)) {
        const map: Record<string, () => any> = {
          Grayscale: () => new filters.Grayscale(),
          Sepia: () => new filters.Sepia(),
          Blur: () => new filters.Blur({ blur: 0.15 }),
        };
        if (map[type]) rest.push(map[type]());
      }
      obj.filters = rest;
      obj.applyFilters();
      obj.canvas?.requestRenderAll();
      refresh();
    });
  };

  const adjust = (type: "Contrast" | "Saturation", v: number) => {
    import("fabric").then(({ filters }) => {
      const rest = (obj.filters ?? []).filter((f: any) => f.type !== type);
      const Ctor = type === "Contrast" ? filters.Contrast : filters.Saturation;
      const key = type === "Contrast" ? "contrast" : "saturation";
      rest.push(new Ctor({ [key]: v / 100 }));
      obj.filters = rest;
      obj.applyFilters();
      obj.canvas?.requestRenderAll();
      refresh();
    });
  };

  const current = (type: "Contrast" | "Saturation") => {
    const f = (obj.filters ?? []).find((x: any) => x.type === type);
    if (!f) return 0;
    return Math.round(((type === "Contrast" ? f.contrast : f.saturation) ?? 0) * 100);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-[var(--w11-text-primary)]">Effects</Label>
      <div className="flex flex-wrap gap-1">
        {["Grayscale", "Sepia", "Blur"].map((t) => {
          const on = active(t);
          return (
            <button key={t} onClick={() => toggle(t)}
              className="text-[10px] px-2 py-1 rounded-[var(--w11-radius-sm)] border"
              style={{
                transition: "background var(--w11-transition-fast), color var(--w11-transition-fast)",
                ...(on
                  ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)", borderColor: "transparent" }
                  : { background: "var(--w11-control-bg)", color: "var(--w11-text-secondary)", borderColor: "var(--w11-border-default)" }),
              }}>
              {t}
            </button>
          );
        })}
      </div>
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <Label className="text-[10px] text-[var(--w11-text-secondary)]">Contrast</Label>
          <span className="text-[10px] text-[var(--w11-text-tertiary)]">{current("Contrast")}</span>
        </div>
        <Slider min={-100} max={100} step={5} value={[current("Contrast")]}
          onValueChange={([v]) => adjust("Contrast", v)} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <Label className="text-[10px] text-[var(--w11-text-secondary)]">Saturation</Label>
          <span className="text-[10px] text-[var(--w11-text-tertiary)]">{current("Saturation")}</span>
        </div>
        <Slider min={-100} max={100} step={5} value={[current("Saturation")]}
          onValueChange={([v]) => adjust("Saturation", v)} />
      </div>
    </div>
  );
}

// ── Photo frames — fabric clipPath masks for student photos ──────────────────
const FRAME_SHAPES = [
  { id: "none", label: "None" },
  { id: "circle", label: "Circle" },
  { id: "rounded", label: "Rounded" },
  { id: "hexagon", label: "Hexagon" },
  { id: "star", label: "Star" },
  { id: "arch", label: "Arch" },
] as const;

// ── Crop tool — non-destructive crop via fractional clipPath (Canva-style) ───
function CropTool({ obj, refresh }: { obj: any; refresh: () => void }) {
  const [crop, setCrop] = useState<{ l: number; t: number; r: number; b: number } | null>(null);

  // crop state is stored on the object so it survives undo/redo + JSON round-trips
  React.useEffect(() => {
    const c = obj.__crop;
    setCrop(c && typeof c === "object" ? c : null);
  }, [obj]);

  const applyCrop = (l: number, t: number, r: number, b: number) => {
    import("fabric").then(({ Rect }) => {
      const state = { l, t, r, b };
      if (l === 0 && t === 0 && r === 0 && b === 0) {
        delete obj.__crop;
        obj.clipPath = null;
      } else {
        obj.__crop = state;
        // fractional crop: cover-fill rect inset by the trim amounts —
        // positioned relative to the image center (origin left/top from the
        // un-cropped top-left corner), so it moves/scales with the image
        const w = obj.width ?? 1;
        const h = obj.height ?? 1;
        obj.clipPath = new Rect({
          left: -w / 2 + w * l,
          top: -h / 2 + h * t,
          width: Math.max(8, w * (1 - l - r)),
          height: Math.max(8, h * (1 - t - b)),
          originX: "left",
          originY: "top",
          absolutePositioned: false,
        });
      }
      obj.dirty = true;
      obj.canvas?.requestRenderAll();
      refresh();
    });
  };

  const num = (v: number | undefined) => Math.round((v ?? 0) * 100);
  const setSide = (side: "l" | "t" | "r" | "b", pct: number) => {
    const base = crop ?? { l: 0, t: 0, r: 0, b: 0 };
    const next = { ...base, [side]: Math.max(0, Math.min(45, pct)) / 100 };
    setCrop(next);
    applyCrop(next.l, next.t, next.r, next.b);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-[var(--w11-text-primary)]">Crop</Label>
        {crop && (
          <button className="text-[10px] text-[var(--w11-text-tertiary)] hover:text-[var(--w11-text-primary)] underline"
            onClick={() => { setCrop(null); applyCrop(0, 0, 0, 0); }}>
            Reset
          </button>
        )}
      </div>
      {([["l", "Left"], ["t", "Top"], ["r", "Right"], ["b", "Bottom"]] as const).map(([side, label]) => (
        <div key={side}>
          <div className="flex items-center justify-between mb-0.5">
            <Label className="text-[10px] text-[var(--w11-text-secondary)]">{label}</Label>
            <span className="text-[10px] text-[var(--w11-text-tertiary)]">{num(crop?.[side])}%</span>
          </div>
          <Slider min={0} max={45} step={1} value={[num(crop?.[side])]}
            onValueChange={([v]) => setSide(side, v)} />
        </div>
      ))}
      <div className="text-[9px] text-[var(--w11-text-tertiary)]">Trim edges without deleting pixels — re-crop anytime.</div>
    </div>
  );
}

function PhotoFrames({ obj, refresh }: { obj: any; refresh: () => void }) {
  const current = obj.clipPath ? ((obj.clipPath as any).data?.frame ?? "custom") : "none";

  const applyFrame = (id: string) => {
    import("fabric").then((fabric) => {
      if (id === "none") {
        obj.set({ clipPath: undefined });
        (obj as any).dirty = true;
        obj.canvas?.requestRenderAll();
        refresh();
        return;
      }
      const w = obj.getScaledWidth();
      const h = obj.getScaledHeight();
      // cover-fill mask centered on the image (absolutePositioned semantics
      // avoided: mask is object-relative, scaled to the image frame)
      let mask: any;
      if (id === "circle") {
        const r = Math.min(w, h) / 2;
        mask = new fabric.Circle({ radius: r, originX: "center", originY: "center", left: w / 2, top: h / 2 });
      } else if (id === "rounded") {
        mask = new fabric.Rect({
          width: w, height: h, rx: Math.min(w, h) * 0.12, ry: Math.min(w, h) * 0.12,
          originX: "center", originY: "center", left: w / 2, top: h / 2,
        });
      } else if (id === "hexagon") {
        const r = Math.min(w, h) / 2;
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (2 * Math.PI * i) / 6 - Math.PI / 2;
          return { x: r * Math.cos(a), y: r * Math.sin(a) };
        });
        mask = new fabric.Polygon(pts, { originX: "center", originY: "center", left: w / 2, top: h / 2 });
      } else if (id === "star") {
        const outer = Math.min(w, h) / 2, inner = outer * 0.45;
        const pts = Array.from({ length: 10 }, (_, i) => {
          const a = (Math.PI * i) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? outer : inner;
          return { x: r * Math.cos(a), y: r * Math.sin(a) };
        });
        mask = new fabric.Polygon(pts, { originX: "center", originY: "center", left: w / 2, top: h / 2 });
      } else {
        // arch: rounded top, straight bottom
        mask = new fabric.Rect({
          width: w, height: h, rx: w / 2, ry: w / 2,
          originX: "center", originY: "center", left: w / 2, top: h / 2,
        });
      }
      mask.data = { frame: id };
      obj.set({ clipPath: mask });
      (obj as any).dirty = true;
      obj.canvas?.requestRenderAll();
      refresh();
    });
  };

  return (
    <div>
      <Label className="text-xs text-[var(--w11-text-primary)]">Photo Frame</Label>
      <div className="grid grid-cols-3 gap-1 mt-1">
        {FRAME_SHAPES.map((f) => {
          const on = current === f.id;
          return (
            <button key={f.id} onClick={() => applyFrame(f.id)}
              className="text-[10px] px-1.5 py-1 rounded-[var(--w11-radius-sm)] border"
              style={{
                transition: "background var(--w11-transition-fast), color var(--w11-transition-fast)",
                ...(on
                  ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)", borderColor: "transparent" }
                  : { background: "var(--w11-control-bg)", color: "var(--w11-text-secondary)", borderColor: "var(--w11-border-default)" }),
              }}>
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page Settings Panel ─────────────────────────────────────────────────────────
function PageSettingsPanel({ canvas, page }: { canvas: any; page: any }) {
  const [margins, setMargins] = useState<PageMargins>(
    page?.margins ?? { top: 72, right: 72, bottom: 72, left: 72 }
  );

  useEffect(() => {
    if (page?.margins) setMargins(page.margins);
  }, [page]);

  const sizeName = Object.entries(PAGE_SIZES).find(([, v]) =>
    v.width === page?.width && v.height === page?.height
  )?.[0] ?? "A4";

  const applyMargins = (m: PageMargins) => {
    canvas.updatePageSettings({ margins: m });
  };

  return (
    <div className="p-3 space-y-3.5 text-sm overflow-y-auto h-full custom-scrollbar text-[var(--w11-text-primary)]">
      <div className="text-center p-3.5 rounded-[var(--w11-radius-lg)] border border-[var(--w11-border-subtle)]"
        style={{ background: "var(--w11-control-hover)" }}>
        <p className="font-semibold text-xs text-[var(--w11-text-primary)]">Canvas Setup</p>
        <div className="text-[10px] text-[var(--w11-text-secondary)] mt-0.5">Configure page dimensions and canvas background</div>
      </div>

      {/* Page Size */}
      <SectionCard title="Document Format">
        <Select value={sizeName} onValueChange={(v) => canvas.changePageSize(v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.keys(PAGE_SIZES).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[10px] font-bold text-[var(--w11-text-tertiary)] pointer-events-none">W</span>
            <Input type="number" className="h-8 pl-7 text-xs" value={page?.width ?? 794}
              placeholder="W"
              onChange={(e) => canvas.updatePageSettings({ width: Number(e.target.value) })} />
          </div>
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[10px] font-bold text-[var(--w11-text-tertiary)] pointer-events-none">H</span>
            <Input type="number" className="h-8 pl-7 text-xs" value={page?.height ?? 1123}
              placeholder="H"
              onChange={(e) => canvas.updatePageSettings({ height: Number(e.target.value) })} />
          </div>
        </div>
      </SectionCard>

      {/* Orientation */}
      <SectionCard title="Orientation" className="space-y-2">
        <div className="flex gap-2">
          {(["portrait", "landscape"] as const).map(o => {
            const on = page?.orientation === o;
            return (
              <button key={o}
                className="flex-1 py-1.5 text-xs rounded-[var(--w11-radius-md)] border capitalize font-medium"
                style={{
                  transition: "background var(--w11-transition-fast), color var(--w11-transition-fast)",
                  ...(on
                    ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)", borderColor: "transparent", fontWeight: 600 }
                    : { background: "var(--w11-control-bg)", color: "var(--w11-text-secondary)", borderColor: "var(--w11-border-default)" }),
                }}
                onClick={() => canvas.updatePageSettings({ orientation: o })}
              >
                {o === "portrait" ? "Portrait" : "Landscape"}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Background */}
      <SectionCard title="Page Background" className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 p-1 rounded-[var(--w11-radius-md)] border border-[var(--w11-border-subtle)]"
            style={{ background: "var(--w11-control-bg)" }}>
            <input type="color" className="h-6 w-8 rounded-[var(--w11-radius-sm)] border-0 cursor-pointer block p-0"
              value={page?.background ?? "#ffffff"}
              onChange={(e) => canvas.updatePageSettings({ background: e.target.value })} />
            <span className="text-[10px] font-mono text-[var(--w11-text-tertiary)] uppercase">{page?.background ?? "#fff"}</span>
          </div>
          <div className="flex gap-1 ml-auto">
            {["#ffffff", "#f8fafc", "#1e293b", "#dbeafe", "#fef3c7"].map(c => (
              <button key={c} className="w-6 h-6 rounded-full border border-[var(--w11-border-default)] transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
                title={c}
                onClick={() => canvas.updatePageSettings({ background: c })} />
            ))}
          </div>
        </div>
      </SectionCard>

      <Separator className="bg-[var(--w11-border-subtle)]" />

      {/* Margins */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--w11-text-tertiary)]">Margins (px)</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {(["top", "right", "bottom", "left"] as const).map(side => (
            <div key={side}>
              <Label className="text-xs capitalize text-[var(--w11-text-secondary)]">{side}</Label>
              <Input type="number" className="h-7 text-xs"
                value={margins[side]}
                onChange={(e) => {
                  const m = { ...margins, [side]: Number(e.target.value) };
                  setMargins(m);
                  applyMargins(m);
                }} />
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs"
          onClick={() => {
            const m = { top: 72, right: 72, bottom: 72, left: 72 };
            setMargins(m); applyMargins(m);
          }}>
          Reset Margins (1 inch)
        </Button>
      </div>

      {/* Current page info */}
      <div className="text-xs text-[var(--w11-text-secondary)] space-y-1 p-2 rounded-[var(--w11-radius-md)]"
        style={{ background: "var(--w11-control-hover)" }}>
        <p>Size: {page?.width ?? 794} × {page?.height ?? 1123} px</p>
        <p>Orientation: {page?.orientation ?? "portrait"}</p>
        <p>Pages: {canvas.pages?.length ?? 1}</p>
      </div>
    </div>
  );
}
