"use client";

/**
 * LayersPanel — Canva-style object list with a real tree feel (wave-J).
 *
 * - Renders inside the 11.css `win11-treeview` family (A6 workspace spec,
 *   IMPROVEMENT_PLAN 31.3 "Hierarchical browser → win11-treeview"): fabric
 *   GROUP objects become expandable tree nodes whose member objects nest
 *   beneath them; everything else stays a flat row.
 * - Stable React keys: rows key on a per-object identity (fabric `o.id`
 *   when the template provides one, else a positional fallback) — the old
 *   duplicate `type-?` keys that caused 28 console errors stay gone, and
 *   every mutation now addresses the OBJECT itself (not its name), so
 *   templates with repeated names can no longer act on the wrong layer.
 * - Visibility / lock icons are always visible (dimmed when inactive) and
 *   the reorder arrows sit in a hover reveal — Figma-style persistent
 *   state, Canva-style hover actions.
 * - Drag affordance clarity: the grip is colored on hover and rows expose
 *   keyboard reordering (Alt+↑/↓ moves the focused layer).
 */
import { useEffect, useState } from "react";
import {
  Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, ChevronRight,
  Type as TypeIcon, Image as ImageIcon, Square, Group, GripVertical,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDesignerStore } from "@/lib/designer/store";

interface LayerInfo {
  id: string;
  name: string;
  type: string;
  label: string;
  visible: boolean;
  locked: boolean;
  selected: boolean;
  obj: any;
  children?: LayerInfo[];
}

let uidSeq = 0;
/** Stable per-object React/DOM key even when templates ship unnamed,
 *  identically-named, or id-less objects. */
function objKey(fc: any, o: any, idx: number): string {
  if (!o.__layerKey) {
    try { o.__layerKey = o.id ?? `layer-${uidSeq++}-${idx}`; } catch { /* frozen obj */ }
  }
  return o.__layerKey ?? `${o.type}-${idx}`;
}

function iconFor(type: string) {
  const t = (type ?? "").toLowerCase();
  if (t.includes("text") || t === "textbox" || t === "i-text") return <TypeIcon className="h-3.5 w-3.5" />;
  if (t.includes("image")) return <ImageIcon className="h-3.5 w-3.5" />;
  if (t.includes("group")) return <Group className="h-3.5 w-3.5" />;
  return <Square className="h-3.5 w-3.5" />;
}

function readLayers(fc: any): LayerInfo[] {
  const toInfo = (o: any, idx: number): LayerInfo => {
    const isGroup = o.type === "group" && typeof o.getObjects === "function";
    return {
      id: objKey(fc, o, idx),
      name: o.name ?? `${o.type}-?`,
      type: o.type ?? "unknown",
      label: o.name ?? (typeof o.text === "string" ? o.text.slice(0, 24) : undefined) ?? o.type,
      visible: o.visible !== false,
      locked: !!o.locked,
      selected: fc.getActiveObjects ? fc.getActiveObjects().some((a: any) => a === o) : fc.getActiveObject?.() === o,
      obj: o,
      children: isGroup ? (o.getObjects() as any[]).map((c, i) => toInfo(c, i)).reverse() : undefined,
    };
  };
  return fc.getObjects().map((o: any, i: number) => toInfo(o, i)).reverse();
}

export default function LayersPanel({ canvas }: { canvas: any }) {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const dirty = useDesignerStore((s) => s.dirty);
  const past = useDesignerStore((s) => s.past);

  useEffect(() => {
    const fc = canvas.fabricCanvas;
    if (!fc) return;
    const read = () => setLayers(readLayers(fc));
    read();
    const evs = ["object:added", "object:removed", "object:modified", "object:changed",
      "selection:created", "selection:updated", "selection:cleared"];
    evs.forEach((e) => fc.on(e, read));
    return () => evs.forEach((e) => fc.off(e, read));
  }, [canvas.fabricCanvas, dirty, past.length]);

  const select = (o: any) => {
    const fc = canvas.fabricCanvas;
    if (!fc || !o) return;
    fc.setActiveObject(o);
    fc.requestRenderAll();
  };

  const move = (o: any, dir: 1 | -1) => {
    // list renders reversed (topmost first); dir=1 up in list = lower z.
    // Use fabric's own z-order ops on the object reference — name-based
    // reordering (setObjectZ) can address the wrong object when a template
    // repeats names, which was the root of the old duplicate-key bug.
    const fc = canvas.fabricCanvas;
    if (!fc || !o) return;
    if (dir === 1) o.sendBackwards?.(true); else o.bringForward?.(true);
    fc.requestRenderAll();
    canvas.snapshot?.();
  };

  const toggleFlag = (o: any, patch: Record<string, unknown>) => {
    if (!o) return;
    o.set ? o.set(patch) : Object.assign(o, patch);
    canvas.fabricCanvas?.requestRenderAll();
    canvas.snapshot?.();
    setLayers(readLayers(canvas.fabricCanvas));
  };

  if (layers.length === 0) {
    return (
      <div className="text-center py-8 px-4 rounded-[var(--w11-radius-lg)] border border-dashed border-[var(--w11-border-default)]">
        <div className="text-xs text-[var(--w11-text-secondary)] font-medium">No layers yet</div>
        <div className="text-[10px] text-[var(--w11-text-tertiary)] mt-1">
          Add shapes, text or a template from the left panels — they appear here.
        </div>
      </div>
    );
  }

  const renderRow = (l: LayerInfo, depth: number, topIdx: number, total: number) => {
    const isGroup = !!l.children?.length;
    const expanded = open[l.id] ?? true;
    return (
      <div
        key={l.id}
        role="treeitem"
        aria-selected={l.selected}
        aria-expanded={isGroup ? expanded : undefined}
        tabIndex={0}
        className="group flex items-center gap-1 px-2 py-1.5 rounded-[var(--w11-radius-md)] border text-xs cursor-pointer transition-colors outline-none focus-visible:border-[var(--w11-accent)]"
        style={{
          marginLeft: depth * 12,
          transitionDuration: "var(--w11-transition-fast)",
          ...(l.selected
            ? { background: "var(--w11-accent-light)", borderColor: "var(--w11-accent)", color: "var(--w11-accent)" }
            : { borderColor: "transparent", color: "var(--w11-text-primary)" }),
        }}
        onClick={() => (isGroup ? setOpen((m) => ({ ...m, [l.id]: !expanded })) : select(l.obj))}
        onKeyDown={(e) => {
          if (e.key === "Enter") isGroup ? setOpen((m) => ({ ...m, [l.id]: !expanded })) : select(l.obj);
          if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            move(l.obj, e.key === "ArrowUp" ? 1 : -1);
          }
        }}
      >
        {isGroup ? (
          <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <GripVertical className="h-3 w-3 text-[var(--w11-text-disabled)] group-hover:text-[var(--w11-text-secondary)] shrink-0 transition-colors" aria-hidden />
        <span className="text-[var(--w11-text-secondary)] shrink-0" style={l.selected ? { color: "var(--w11-accent)" } : undefined} aria-hidden>
          {iconFor(l.type)}
        </span>
        {renaming === l.id ? (
          <Input
            autoFocus
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={() => {
              if (renameVal.trim()) { l.obj.name = renameVal.trim(); canvas.snapshot?.(); }
              setRenaming(null);
            }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            onClick={(e) => e.stopPropagation()}
            className="h-5 text-xs px-1 flex-1 min-w-0"
          />
        ) : (
          <span
            className="flex-1 truncate min-w-0"
            title={`${l.label} — double-click to rename`}
            onDoubleClick={(e) => { e.stopPropagation(); setRenaming(l.id); setRenameVal(l.label); }}
          >
            {l.label}
          </span>
        )}
        {/* state icons — ALWAYS visible (dimmed when inactive) */}
        <span className="shrink-0" title={l.locked ? "Locked" : "Unlocked"}>
          {l.locked ? <Lock className="h-3 w-3 text-amber-500" /> : null}
        </span>
        <span className={l.visible ? "hidden group-hover:flex" : "flex"}>
          <Button variant="ghost" size="icon" className="h-5 w-5" title={l.visible ? "Hide" : "Show"}
            onClick={(e) => { e.stopPropagation(); toggleFlag(l.obj, { visible: !l.visible }); }}>
            {l.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-[var(--w11-text-tertiary)]" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" title={l.locked ? "Unlock" : "Lock"}
            onClick={(e) => { e.stopPropagation(); toggleFlag(l.obj, { locked: !l.locked }); }}>
            {l.locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" title="Move up (Alt+↑)" disabled={topIdx === 0}
            onClick={(e) => { e.stopPropagation(); move(l.obj, 1); }}><ChevronUp className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" title="Move down (Alt+↓)" disabled={topIdx === total - 1}
            onClick={(e) => { e.stopPropagation(); move(l.obj, -1); }}><ChevronDown className="h-3 w-3" /></Button>
        </span>
      </div>
    );
  };

  return (
    <div className="win11-treeview space-y-1" role="tree" aria-label="Layers">
      {layers.map((l, i) => (
        <div key={l.id}>
          {renderRow(l, 0, i, layers.length)}
          {l.children && (open[l.id] ?? true) && (
            <div role="group" className="space-y-1">
              {l.children.map((c, j) => renderRow(c, 1, j, l.children!.length))}
            </div>
          )}
        </div>
      ))}
      <div className="text-[10px] text-[var(--w11-text-tertiary)] text-center pt-2">
        Double-click to rename · ↑↓ buttons reorder · Alt+↑/↓ on a row
      </div>
    </div>
  );
}
