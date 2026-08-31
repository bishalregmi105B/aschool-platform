"use client";

/**
 * LayersPanel — Canva-style object list.
 * Reverse-stacked (top object first), with rename, lock, hide, select and
 * drag/arrow z-reorder. Reads live objects from the fabric canvas.
 */
import { useEffect, useState } from "react";
import {
  Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Type as TypeIcon,
  Image as ImageIcon, Square, Group, GripVertical,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDesignerStore } from "@/lib/designer/store";

interface LayerInfo {
  name: string;
  type: string;
  label: string;
  visible: boolean;
  locked: boolean;
  selected: boolean;
}

function iconFor(type: string) {
  const t = (type ?? "").toLowerCase();
  if (t.includes("text") || t === "textbox" || t === "i-text") return <TypeIcon className="h-3.5 w-3.5" />;
  if (t.includes("image")) return <ImageIcon className="h-3.5 w-3.5" />;
  if (t.includes("group")) return <Group className="h-3.5 w-3.5" />;
  return <Square className="h-3.5 w-3.5" />;
}

export default function LayersPanel({ canvas }: { canvas: any }) {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const dirty = useDesignerStore((s) => s.dirty);
  const past = useDesignerStore((s) => s.past);

  useEffect(() => {
    const fc = canvas.fabricCanvas;
    if (!fc) return;
    const read = () => {
      const objs: LayerInfo[] = fc.getObjects().map((o: any) => ({
        name: o.name ?? `${o.type}-?`,
        type: o.type ?? "unknown",
        label: o.name ?? o.text?.slice(0, 24) ?? o.type,
        visible: o.visible !== false,
        locked: !!o.locked,
        selected: !!fc.getActiveObject && fc.getActiveObjects?.().some((a: any) => a === o),
      }));
      setLayers(objs.reverse()); // topmost first, Canva-style
    };
    read();
    fc.on("object:added", read);
    fc.on("object:removed", read);
    fc.on("object:modified", read);
    fc.on("selection:created", read);
    fc.on("selection:updated", read);
    fc.on("selection:cleared", read);
    return () => {
      fc.off("object:added", read);
      fc.off("object:removed", read);
      fc.off("object:modified", read);
      fc.off("selection:created", read);
      fc.off("selection:updated", read);
      fc.off("selection:cleared", read);
    };
  }, [canvas.fabricCanvas, dirty, past.length]);

  const find = (name: string) =>
    canvas.fabricCanvas?.getObjects().find((o: any) => (o.name ?? "") === name);

  const select = (name: string) => {
    const obj = find(name);
    if (!obj) return;
    canvas.fabricCanvas.setActiveObject(obj);
    canvas.fabricCanvas.requestRenderAll();
  };

  const move = (name: string, dir: 1 | -1) => {
    // layers render reversed; dir=1 (up in list) = lower z index
    const objs = canvas.fabricCanvas.getObjects();
    const idx = objs.findIndex((o: any) => (o.name ?? "") === name);
    const target = idx - dir;
    if (idx < 0 || target < 0 || target >= objs.length) return;
    canvas.setObjectZ(name, target);
  };

  if (layers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        No layers yet. Add elements from the left panels.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {layers.map((l, i) => (
        <div
          key={l.name}
          className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all cursor-pointer
            ${l.selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-transparent hover:bg-muted"}`}
          onClick={() => select(l.name)}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <span className="text-muted-foreground shrink-0">{iconFor(l.type)}</span>
          {renaming === l.name ? (
            <Input
              autoFocus
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onBlur={() => {
                const obj = find(l.name);
                if (obj && renameVal.trim()) { obj.name = renameVal.trim(); canvas.snapshot?.(); }
                setRenaming(null);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="h-5 text-xs px-1 flex-1 min-w-0"
            />
          ) : (
            <span
              className="flex-1 truncate min-w-0"
              onDoubleClick={(e) => { e.stopPropagation(); setRenaming(l.name); setRenameVal(l.label); }}
            >
              {l.label}
            </span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-5 w-5" title="Move up"
              onClick={(e) => { e.stopPropagation(); move(l.name, 1); }}><ChevronUp className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" title="Move down"
              onClick={(e) => { e.stopPropagation(); move(l.name, -1); }}><ChevronDown className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" title={l.locked ? "Unlock" : "Lock"}
              onClick={(e) => { e.stopPropagation(); canvas.setLocked(l.name, !l.locked); }}>
              {l.locked ? <Lock className="h-3 w-3 text-amber-600" /> : <Unlock className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" title={l.visible ? "Hide" : "Show"}
              onClick={(e) => { e.stopPropagation(); canvas.toggleVisible(l.name); }}>
              {l.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
            </Button>
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Double-click to rename · drag with ↑↓ buttons to reorder
      </p>
    </div>
  );
}
