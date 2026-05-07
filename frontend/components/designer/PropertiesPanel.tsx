"use client";

/**
 * PropertiesPanel — right panel with object properties + page settings.
 * When nothing is selected → Page Settings (size, orientation, margins, bg).
 * When an object is selected → its type-specific properties.
 */
import { useEffect, useState, useCallback } from "react";
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
    <div className="p-3 space-y-4 text-sm overflow-y-auto h-full">

      {/* Position & Size */}
      <div>
        <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Position & Size</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["X", "left"],
            ["Y", "top"],
          ].map(([label, prop]) => (
            <div key={prop}>
              <Label className="text-xs">{label}</Label>
              <Input type="number" className="h-7 text-xs" value={Math.round(obj[prop] ?? 0)}
                onChange={(e) => set({ [prop]: Number(e.target.value) })} />
            </div>
          ))}
          <div>
            <Label className="text-xs">W</Label>
            <Input type="number" className="h-7 text-xs"
              value={Math.round(obj.getScaledWidth?.() ?? obj.width ?? 0)}
              onChange={(e) => set({ scaleX: Number(e.target.value) / (obj.width || 1) })} />
          </div>
          <div>
            <Label className="text-xs">H</Label>
            <Input type="number" className="h-7 text-xs"
              value={Math.round(obj.getScaledHeight?.() ?? obj.height ?? 0)}
              onChange={(e) => set({ scaleY: Number(e.target.value) / (obj.height || 1) })} />
          </div>
        </div>
      </div>

      {/* Rotation */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rotation</Label>
          <span className="text-xs">{Math.round(obj.angle ?? 0)}°</span>
        </div>
        <Slider min={0} max={360} step={1} value={[obj.angle ?? 0]}
          onValueChange={([v]) => set({ angle: v })} />
      </div>

      {/* Opacity */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opacity</Label>
          <span className="text-xs">{Math.round((obj.opacity ?? 1) * 100)}%</span>
        </div>
        <Slider min={0} max={100} step={1} value={[Math.round((obj.opacity ?? 1) * 100)]}
          onValueChange={([v]) => set({ opacity: v / 100 })} />
      </div>

      <Separator />

      {/* ── Text properties ──────────────────────────────── */}
      {isText && (
        <div className="space-y-3">
          <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Text</p>

          {/* Font family */}
          <div>
            <Label className="text-xs">Font Family</Label>
            <Select value={obj.fontFamily ?? "Arial"} onValueChange={(v) => {
              if (GOOGLE_FONTS.includes(v)) loadGoogleFont(v);
              set({ fontFamily: v });
            }}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold">System</div>
                {SYSTEM_FONTS.map(f => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                ))}
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold mt-1">Google Fonts</div>
                {GOOGLE_FONTS.map(f => (
                  <SelectItem key={f} value={f}>
                    <span style={{ fontFamily: SYSTEM_FONTS.includes(f) ? f : undefined }}>{f}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size + color */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-xs">Size</Label>
              <Input type="number" className="h-7 text-xs" value={obj.fontSize ?? 20}
                onChange={(e) => set({ fontSize: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <input type="color" className="h-7 w-12 rounded border cursor-pointer block"
                value={obj.fill ?? "#000000"}
                onChange={(e) => set({ fill: e.target.value })} />
            </div>
          </div>

          {/* Bold / Italic / Underline / Strike */}
          <div className="flex flex-wrap gap-1">
            {([
              ["B", "fontWeight",  "bold",   "normal"],
              ["I", "fontStyle",   "italic", "normal"],
              ["U", "underline",   true,     false   ],
              ["S", "linethrough", true,     false   ],
            ] as const).map(([lbl, prop, on, off]) => (
              <button key={lbl as string}
                className={`w-7 h-7 text-xs rounded border font-semibold transition-colors ${
                  obj[prop as string] === on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
                onClick={() => set({ [prop as string]: obj[prop as string] === on ? off : on })}
              >{lbl as string}</button>
            ))}
          </div>

          {/* Line height */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Line Height</Label>
              <span className="text-xs">{(obj.lineHeight ?? 1.4).toFixed(1)}</span>
            </div>
            <Slider min={8} max={30} step={1} value={[Math.round((obj.lineHeight ?? 1.4) * 10)]}
              onValueChange={([v]) => set({ lineHeight: v / 10 })} />
          </div>

          {/* Char spacing */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Letter Spacing</Label>
              <span className="text-xs">{obj.charSpacing ?? 0}</span>
            </div>
            <Slider min={-100} max={400} step={10} value={[obj.charSpacing ?? 0]}
              onValueChange={([v]) => set({ charSpacing: v })} />
          </div>

          {/* Alignment */}
          <div>
            <Label className="text-xs">Alignment</Label>
            <div className="flex gap-1 mt-1">
              {["left", "center", "right", "justify"].map(a => (
                <button key={a}
                  className={`flex-1 py-0.5 text-[10px] rounded border capitalize ${
                    obj.textAlign === a ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  onClick={() => set({ textAlign: a })}
                >{a[0].toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Shape properties ─────────────────────────────── */}
      {isShape && (
        <div className="space-y-3">
          <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Shape</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fill</Label>
              <input type="color" className="h-7 w-full rounded border cursor-pointer block"
                value={typeof obj.fill === "string" && obj.fill.startsWith("#") ? obj.fill : "#3b82f6"}
                onChange={(e) => set({ fill: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Stroke</Label>
              <input type="color" className="h-7 w-full rounded border cursor-pointer block"
                value={obj.stroke ?? "#000000"}
                onChange={(e) => set({ stroke: e.target.value })} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Stroke Width</Label>
              <span className="text-xs">{obj.strokeWidth ?? 0}px</span>
            </div>
            <Slider min={0} max={20} step={1} value={[obj.strokeWidth ?? 0]}
              onValueChange={([v]) => set({ strokeWidth: v })} />
          </div>
          {obj.type === "rect" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Corner Radius</Label>
                <span className="text-xs">{obj.rx ?? 0}px</span>
              </div>
              <Slider min={0} max={60} step={1} value={[obj.rx ?? 0]}
                onValueChange={([v]) => set({ rx: v, ry: v })} />
            </div>
          )}
          {/* Shadow */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Shadow</Label>
            <Switch checked={!!obj.shadow}
              onCheckedChange={(v) => {
                if (v) {
                  import("fabric").then(({ Shadow }) => {
                    obj.set({ shadow: new Shadow({ color: "rgba(0,0,0,0.3)", blur: 10, offsetX: 4, offsetY: 4 }) });
                    obj.canvas?.renderAll(); refresh();
                  });
                } else { set({ shadow: null }); }
              }} />
          </div>
        </div>
      )}

      {/* ── Image properties ─────────────────────────────── */}
      {isImage && (
        <div className="space-y-3">
          <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Image</p>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Lock Aspect Ratio</Label>
            <Switch checked={!!obj.lockUniScaling}
              onCheckedChange={(v) => set({ lockUniScaling: v })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Brightness</Label>
              <span className="text-xs">{obj._fbBrightness ?? 0}</span>
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
        </div>
      )}

      <Separator />
      <div className="flex items-center justify-between">
        <Label className="text-xs">Lock Position</Label>
        <Switch
          checked={!!obj.lockMovementX}
          onCheckedChange={(v) => set({ lockMovementX: v, lockMovementY: v })}
        />
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
    <div className="p-3 space-y-4 text-sm overflow-y-auto h-full">
      <div className="text-center p-3 bg-muted/50 rounded-md">
        <p className="font-medium text-sm">Page Settings</p>
        <p className="text-xs text-muted-foreground">No element selected</p>
      </div>

      {/* Page Size */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Page Size</Label>
        <Select value={sizeName} onValueChange={(v) => canvas.changePageSize(v)}>
          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.keys(PAGE_SIZES).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 mt-2">
          <Input type="number" className="h-7 text-xs" value={page?.width ?? 794}
            placeholder="W"
            onChange={(e) => canvas.updatePageSettings({ width: Number(e.target.value) })} />
          <span className="text-muted-foreground self-center text-xs">×</span>
          <Input type="number" className="h-7 text-xs" value={page?.height ?? 1123}
            placeholder="H"
            onChange={(e) => canvas.updatePageSettings({ height: Number(e.target.value) })} />
          <span className="text-muted-foreground self-center text-xs">px</span>
        </div>
      </div>

      {/* Orientation */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Orientation</Label>
        <div className="flex gap-2 mt-1">
          {(["portrait", "landscape"] as const).map(o => (
            <button key={o}
              className={`flex-1 py-1.5 text-xs rounded border capitalize transition-colors ${
                page?.orientation === o ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              }`}
              onClick={() => canvas.updatePageSettings({ orientation: o })}
            >{o === "portrait" ? "🖺 Portrait" : "🖻 Landscape"}</button>
          ))}
        </div>
      </div>

      {/* Background */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Background</Label>
        <div className="flex items-center gap-2 mt-1">
          <input type="color" className="h-8 w-12 rounded border cursor-pointer"
            value={page?.background ?? "#ffffff"}
            onChange={(e) => canvas.updatePageSettings({ background: e.target.value })} />
          <div className="flex gap-1">
            {["#ffffff", "#f8fafc", "#1e293b", "#dbeafe", "#fef3c7"].map(c => (
              <button key={c} className="w-6 h-6 rounded border transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
                onClick={() => canvas.updatePageSettings({ background: c })} />
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* Margins */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Margins (px)</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {(["top", "right", "bottom", "left"] as const).map(side => (
            <div key={side}>
              <Label className="text-xs capitalize">{side}</Label>
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
      <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/30 rounded">
        <p>Size: {page?.width ?? 794} × {page?.height ?? 1123} px</p>
        <p>Orientation: {page?.orientation ?? "portrait"}</p>
        <p>Pages: {canvas.pages?.length ?? 1}</p>
      </div>
    </div>
  );
}
