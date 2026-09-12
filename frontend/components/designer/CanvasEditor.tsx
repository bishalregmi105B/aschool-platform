"use client";
/**
 * CanvasEditor v2 — Canva-like canvas designer.
 * Layout: [Icon Bar 64px] | [Sliding Panel 280px] | [Canvas + pages] | [Properties 256px]
 * v2: store-driven panels, real viewport zoom + wheel, pink snap guides,
 * layers panel, graphics (QR/watermark/icons), keyboard shortcuts, context
 * menu, page duplicate/reorder, save-as-template.
 */
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAOSRouteParams } from "@/lib/aos-window-route";
import { useWin11Scope } from "@/lib/win11-scope";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useCanvas, PAGE_SIZES } from "@/lib/hooks/useCanvas";
import { useExport } from "@/lib/hooks/useExport";
import { useDesignerStore, type DesignerPanel } from "@/lib/designer/store";
import { attachShortcuts } from "@/lib/designer/shortcuts";
import { absolutizeImageUrl } from "@/lib/designer/canvasImages";
import { TemplateThumb } from "@/components/designer/TemplateThumb";
import { fetchManagedFileAsFile, type ManagedFile } from "@/lib/services/files.service";

import { Button }   from "@/components/ui/button";
import { FilePicker } from "@/components/files/FilePicker";
import { Input }    from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Save, Download, Undo2, Redo2, ZoomIn, ZoomOut, Maximize,
  Sparkles, ChevronDown, Plus, FileJson, X, Copy, Trash2, FileOutput,
  LayoutTemplate, Upload, Search, Grid3x3, Magnet, Layers, MoreVertical,
  Compass, Type, Paintbrush, Database, Shapes, Image as LucideImage,
  FileDown, FileImage, Code2, PanelTop,
} from "lucide-react";

import PropertiesPanel from "./PropertiesPanel";
import AIAssistPanel   from "./AIAssistPanel";
import { AIChatPanel } from "./AIChatPanel";
import DataFillPanel   from "./DataFillPanel";
import LayersPanel     from "./LayersPanel";
import GraphicsPanel   from "./GraphicsPanel";
import ExplorePanel    from "./ExplorePanel";
import { VersionHistoryButton } from "./VersionHistoryButton";

const SHAPE_SVGS: Record<string, React.ReactNode> = {
  rect: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>,
  circle: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><circle cx="12" cy="12" r="9" /></svg>,
  triangle: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><polygon points="12,3 21,20 3,20" /></svg>,
  line: <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-2"><line x1="3" y1="12" x2="21" y2="12" /></svg>,
  arrow: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M5 13h10v3l6-4-6-4v3H5z" /></svg>,
  poly5: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><polygon points="12,2 22,9 18,21 6,21 2,9" /></svg>,
  poly6: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" /></svg>,
  poly8: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><polygon points="8,2 16,2 22,8 22,16 16,22 8,22 2,16 2,8" /></svg>,
  star4: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" /></svg>,
  star5: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" /></svg>,
  star6: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><polygon points="12,2 15,7 20,4 18,10 22,14 16,15 15,21 12,17 9,21 8,15 2,14 6,10 4,4 9,7" /></svg>,
};

const SHAPE_GROUPS = [
  { label: "Basic",    shapes: [{ id:"rect",label:"Rectangle"},{ id:"circle",label:"Circle"},{ id:"triangle",label:"Triangle"},{ id:"line",label:"Line"},{ id:"arrow",label:"Arrow"}] },
  { label: "Polygons", shapes: [{ id:"poly5",label:"Pentagon"},{ id:"poly6",label:"Hexagon"},{ id:"poly8",label:"Octagon"}] },
  { label: "Stars",    shapes: [{ id:"star4",label:"Star 4pt"},{ id:"star5",label:"Star 5pt"},{ id:"star6",label:"Star 6pt"}] },
];

const BG_PRESETS = [
  "#ffffff","#f8fafc","#f1f5f9","#e2e8f0","#fef3c7","#fce7f3","#ede9fe","#d1fae5",
  "#dbeafe","#fee2e2","#fdf4ff","#f0fdf4","#1e293b","#0f172a","#18181b","#7c2d12",
];

type SidebarIconDef = { id: DesignerPanel; Icon: React.ComponentType<{ className?: string }>; label: string };
const SIDEBAR_ICONS: SidebarIconDef[] = [
  { id: "explore",    Icon: Compass,        label: "Explore"   },
  { id: "templates",  Icon: LayoutTemplate, label: "Templates" },
  { id: "shapes",     Icon: Shapes,         label: "Shapes"    },
  { id: "text",       Icon: Type,           label: "Text"      },
  { id: "media",      Icon: LucideImage,    label: "Media"     },
  { id: "graphics",   Icon: Sparkles,       label: "Graphics"  },
  { id: "background", Icon: Paintbrush,     label: "Canvas BG" },
  { id: "data",       Icon: Database,       label: "Data Fill" },
  { id: "layers",     Icon: Layers,         label: "Layers"    },
];

interface ContextMenuState { x: number; y: number }
const CTX_NULL: ContextMenuState | null = null;

// ── drag-drop / clipboard-paste helpers ────────────────────────────────

/** Blob → data: URI (clipboard images and dropped files insert as data URIs,
 *  which never fail CORS and never taint the canvas for exports). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

/** Map a client (viewport) point to logical canvas coordinates — the same
 *  inversion fabric's getPointer does, done manually so it works with
 *  native DragEvent/DropEvent objects (fabric v6 expects its own events). */
function canvasPointFromClient(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
  const fc = (window as any).__activeCanvas;
  if (!fc?.getElement) return null;
  const rect = fc.getElement().getBoundingClientRect();
  const vpt: number[] = fc.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const [a, b, c, d, tx, ty] = vpt;
  const det = a * d - b * c;
  if (!det) return null;
  const px = e.clientX - rect.left - tx;
  const py = e.clientY - rect.top - ty;
  return { x: (d * px - b * py) / det, y: (-c * px + a * py) / det };
}

export default function CanvasEditor() {
  const router       = useRouter();
  const searchParams = useAOSRouteParams();
  // Win11 token scope mirrored from the AOS shell — the editor layout
  // hardcodes `win11` (light only), so re-establish the scope here to make
  // every --w11-* token flip with the OS light/dark theme (same as writer2).
  const win11        = useWin11Scope();
  const queryClient  = useQueryClient();
  const docId        = searchParams.get("doc");
  const templateId   = searchParams.get("template");
  const bulkSessionId = searchParams.get("bulk_session");

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLCanvasElement>(null);
  const canvas       = useCanvas(canvasRef, overlayRef);
  const { exportPDF, exportPNG, exportPagesZip, exportPPTX, exportSVG } = useExport();

  // export quality — multiplier over the 96dpi logical canvas (3.125 = 300 DPI)
  const [dpiScale, setDpiScale] = useState(3.125);
  const [exportJpeg, setExportJpeg] = useState(true);
  const [exporting, setExporting] = useState(false);

  // store-driven ui state
  const activePanel = useDesignerStore((s) => s.activePanel);
  const setActivePanel = useDesignerStore((s) => s.setActivePanel);
  const zoom = useDesignerStore((s) => s.zoom);
  const setZoom = useDesignerStore((s) => s.setZoom);
  const snapping = useDesignerStore((s) => s.snapping);
  const toggleSnapping = useDesignerStore((s) => s.toggleSnapping);
  const showGrid = useDesignerStore((s) => s.showGrid);
  const setDirty = useDesignerStore((s) => s.setDirty);
  const canUndo = useDesignerStore((s) => s.canUndo);
  const canRedo = useDesignerStore((s) => s.canRedo);

  const [docName, setDocName]         = useState("Untitled Design");
  const [templateIdState, setTemplateIdState] = useState<string | null>(templateId);
  const [showAI, setShowAI]           = useState(false);
  const [bgColor, setBgColor]         = useState("#ffffff");
  const [imgUrlInput, setImgUrlInput] = useState("");
  const [tplSearch, setTplSearch]     = useState("");
  const [ctxMenu, setCtxMenu]         = useState<ContextMenuState | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showDesignPicker, setShowDesignPicker] = useState(false);

  const templateLoadedRef = useRef(false);
  const docLoadedRef      = useRef(false);
  const initialFitRef     = useRef(false);

  // ── AI agent action execution (designer mode) ────────────────────────
  const getAgentContext = useCallback((): Record<string, unknown> => {
    const fc = (window as any).__activeCanvas;
    const sel = fc?.getActiveObject?.();
    return {
      page: { width: canvas.canvasSize?.width, height: canvas.canvasSize?.height },
      documentName: docName,
      selected: sel ? { type: sel.type, text: typeof sel.text === "string" ? sel.text.slice(0, 200) : undefined } : null,
    };
  }, [canvas.canvasSize, docName]);

  const executeAgentAction = useCallback((action: Record<string, unknown>) => {
    const kind = String(action.action || "");
    const text = String(action.text ?? "");
    const fc = (window as any).__activeCanvas;
    switch (kind) {
      case "add_text":
      case "add_heading": {
        const size = kind === "add_heading" ? 34 : Number(action.fontSize) || 22;
        canvas.addText(text, {
          fontSize: size,
          fontWeight: (action.fontWeight as string) === "bold" ? "bold" : "normal",
          fill: (action.fill as string) || "#0f172a",
          textAlign: (action.textAlign as string) || "left",
        });
        break;
      }
      case "replace_selected_text": {
        const sel = fc?.getActiveObject?.() ?? canvas.selectedObject;
        if (sel && typeof sel.set === "function" && "text" in sel) {
          sel.set({ text });
          fc?.renderAll?.();
        } else {
          canvas.addText(text, { fontSize: 18 });
        }
        break;
      }
      case "set_background": {
        const color = String(action.color || "#ffffff");
        canvas.updatePageSettings({ background: color });
        fc?.setBackgroundColor?.(color, () => fc.renderAll());
        setBgColor(color);
        break;
      }
      case "suggest_layout":
      case "insert_text_at_cursor":
      default:
        // layouts are template-choice prompts; cursor ops are writer-only —
        // degrade gracefully to a text element
        if (text) canvas.addText(text, { fontSize: 18 });
        break;
    }
  }, [canvas, setBgColor]);


  // fit the page into the viewport once the canvas is live (Canva-style)
  useEffect(() => {
    if (!canvas.isReady || initialFitRef.current) return;
    initialFitRef.current = true;
    const t = setTimeout(() => canvas.zoomToFit(), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.isReady]);

  const { data: docData } = useQuery({
    queryKey: ["designer-doc", docId],
    queryFn: async () => { const r = await api.get(`/design-studio/documents/${docId}`); return r.data?.data; },
    enabled: !!docId,
  } as any);

  useEffect(() => {
    if (!docData || docLoadedRef.current || !canvas.isReady) return;
    docLoadedRef.current = true;
    const doc = docData as any;
    setDocName(doc.name || "Untitled Design");
    if (doc.canvas_state) canvas.loadJSON(doc.canvas_state);
  }, [docData, canvas, canvas.isReady]);

  const { data: allTemplates = [] } = useQuery({
    queryKey: ["design-templates"],
    queryFn: async () => {
      const r = await api.get("/design-studio/templates");
      return Array.isArray(r.data?.data) ? r.data.data : [];
    },
  });

  useEffect(() => {
    if (!templateIdState || docId || templateLoadedRef.current || !allTemplates?.length || !canvas.isReady) return;
    const tpl = allTemplates.find((t: any) => t.id === templateIdState);
    if (!tpl) return;
    templateLoadedRef.current = true;
    setDocName(tpl.name);
    loadTemplate(tpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateIdState, docId, allTemplates, canvas, canvas.isReady]);

  /** Route a template into the right surface: writer docs open the writer,
   *  multi-page canvas JSON loads as pages, single-page into the canvas.
   *  editor_type is the single source of truth (mirrors the landing page and
   *  /templates page so a click anywhere routes the same way). */
  const loadTemplate = useCallback((tpl: any) => {
    setDocName(tpl.name);
    setTemplateIdState(tpl.id);
    if (tpl.editor_type === "writer") {
      // document-style template — belongs in the writer
      router.replace(`/dashboard/designer/writer?template=${tpl.id}`);
      toast.info(`${tpl.name} opens in the Writer`);
      return;
    }
    if (tpl.canvas_json && Object.keys(tpl.canvas_json).length > 0) {
      if (tpl.canvas_json.version === "multi-page") {
        canvas.loadJSON(tpl.canvas_json as any);
      } else {
        canvas.loadFromTemplateJson(tpl.canvas_json, tpl.width, tpl.height);
      }
    } else {
      canvas.loadPreset(tpl.id, tpl.category, tpl.page_size);
      toast.info(`${tpl.page_size ?? "Custom"} canvas ready — build from the left panels`);
    }
    // re-fit whenever a template changes the page size
    setTimeout(() => canvas.zoomToFit(), 120);
  }, [canvas, router]);

  useEffect(() => {
    if (!bulkSessionId || docLoadedRef.current || !canvas.isReady) return;
    const globalData = (window as any).__bulkSessionData;
    const key = `bulk_${bulkSessionId}`;
    const dataStr = sessionStorage.getItem(key);

    if (globalData || dataStr) {
      docLoadedRef.current = true;
      setDocName("Bulk Generation");
      try {
        const parsed = globalData || JSON.parse(dataStr!);
        canvas.loadJSON(parsed);
        delete (window as any).__bulkSessionData;
      } catch (err) {
        toast.error("Failed to load bulk data");
      }
    }
  }, [bulkSessionId, canvas, canvas.isReady]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fullJSON = canvas.toFullJSON();
      const thumb = (() => { try { const fc = (window as any).__activeCanvas; return fc ? fc.toDataURL({ format:"jpeg", quality:0.4, multiplier:0.3 }) : ""; } catch { return ""; } })();
      const payload: any = { name: docName, template_type: templateIdState || "custom", canvas_state: fullJSON, thumbnail_url: thumb };
      if (docId) payload.id = docId;
      const r = await api.post("/design-studio/documents", payload);
      return r.data?.data;
    },
    onSuccess: (data) => {
      toast.success("Design saved");
      setDirty(false);
      if (!docId && data?.id) router.replace(`/dashboard/designer/editor?doc=${data.id}`);
    },
    onError: () => toast.error("Failed to save"),
  });

  const saveAsTemplateMutation = useMutation({
    mutationFn: async () => {
      const fullJSON = canvas.toFullJSON();
      // multi-page docs save their whole page list; single-page saves one
      const pages = fullJSON.pages ?? [];
      const page = pages[0] ?? {};
      const payload: any = {
        name: docName,
        category: "custom",
        editor_type: "designer",
        description: `Custom template saved from "${docName}"`,
        page_size: "Custom",
        width: page.width ?? 794,
        height: page.height ?? 1123,
        page_count: Math.max(1, pages.length),
        thumbnail_emoji: "🧩",
        is_default: false,
        fields: [],
        canvas_json: pages.length > 1 ? fullJSON : (page.json ?? {}),
      };
      // editing an existing template → overwrite that school template in
      // place (key match = update, no duplicate rows)
      if (templateIdState) {
        payload.template_key = templateIdState;
        payload.page_size = allTemplates.find((t: any) => t.id === templateIdState)?.page_size ?? "Custom";
        payload.category = allTemplates.find((t: any) => t.id === templateIdState)?.category ?? "custom";
        payload.thumbnail_emoji = allTemplates.find((t: any) => t.id === templateIdState)?.thumbnail_emoji ?? "🧩";
      }
      return (await api.post("/design-studio/templates", payload)).data;
    },
    onSuccess: () => {
      toast.success("Saved as school template — find it under Templates");
      queryClient.invalidateQueries({ queryKey: ["design-templates"] });
    },
    onError: () => toast.error("Could not save as template"),
  });

  const serverPdfMutation = useMutation({
    mutationFn: async () => {
      // Saved documents render server-side from their stored JSON.
      if (!docId) throw new Error("save-first");
      const r = await api.post("/design-studio/export/pdf", { document_id: docId }, { responseType: "blob" });
      return r.data as Blob;
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docName.replace(/\s+/g, "_").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded (print-ready, Nepali-safe)");
    },
    onError: (e: any) => {
      if (e?.message === "save-first") toast.info("Save your design first, then export server PDF");
      else toast.error("Server PDF failed — try Export as PDF (browser)");
    },
  });

  const handleExport = useCallback(async (format: "pdf"|"png"|"zip"|"json") => {
    const name = docName.replace(/\s+/g,"_").toLowerCase();
    if (format === "json") {
      const blob = new Blob([JSON.stringify(canvas.toFullJSON(), null, 2)], { type:"application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.aschool-design`; a.click(); URL.revokeObjectURL(a.href);
      return;
    }
    const fc = (window as any).__activeCanvas;
    if (!fc) { toast.error("Canvas not ready"); return; }
    const multiPageDoc = canvas.toFullJSON() as any;
    const imgFormat: "png" | "jpeg" = exportJpeg ? "jpeg" : "png";
    const ext = imgFormat === "jpeg" ? "jpg" : "png";
    setExporting(true);
    try {
      if (format === "pdf") await exportPDF(fc, `${name}.pdf`, multiPageDoc, dpiScale, imgFormat);
      else if (format === "zip") await exportPagesZip(multiPageDoc, `${name}_pages.zip`, dpiScale, undefined, imgFormat);
      else if (format === "png" && (multiPageDoc.pages?.length ?? 0) > 1) {
        // multi-page designs export as a ZIP of per-page images (a stitched
        // strip is useless for print) — auto-detect, no extra click
        await exportPagesZip(multiPageDoc, `${name}_pages.zip`, dpiScale, undefined, imgFormat);
        toast.success(`Multi-page detected — exported ${multiPageDoc.pages.length} ${ext.toUpperCase()}s as ZIP at ${dpiScale}×`);
      }
      else await exportPNG(fc, `${name}.${ext}`, multiPageDoc, dpiScale, imgFormat);
      toast.success(`Exported at ${dpiScale}× (${Math.round(dpiScale * 96)} DPI, ${imgFormat.toUpperCase()})`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  }, [docName, canvas, exportPDF, exportPNG, exportPagesZip, dpiScale, exportJpeg]);

  /** Design import via the vault: fetch the picked file's text, then load it. */
  const handleDesignSelect = async (files: ManagedFile[]) => {
    const mf = files[0];
    if (!mf) return;
    try {
      const fileObj = await fetchManagedFileAsFile(mf);
      const text = await fileObj.text();
      try {
        canvas.loadJSON(JSON.parse(text));
        setDocName(fileObj.name.replace(/\.(aschool-design|json)$/, ""));
        toast.success("Design loaded");
      } catch {
        toast.error("Invalid file");
      }
    } catch {
      toast.error("Failed to load file from the file manager");
    }
  };

  const handleShape = (id: string) => {
    const map: Record<string, () => void> = {
      rect: canvas.addRect, circle: canvas.addCircle, triangle: canvas.addTriangle,
      line: canvas.addLine, arrow: canvas.addArrow,
      poly5: () => canvas.addPolygon(5), poly6: () => canvas.addPolygon(6), poly8: () => canvas.addPolygon(8),
      star4: () => canvas.addStar(4), star5: () => canvas.addStar(5), star6: () => canvas.addStar(6),
    };
    map[id]?.();
  };

  // ── keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    if (!canvas.isReady) return;
    return attachShortcuts({
      undo: canvas.undo,
      redo: canvas.redo,
      copy: canvas.copySelected,
      paste: canvas.pasteClipboard,
      duplicate: canvas.duplicateSelected,
      delete: canvas.deleteSelected,
      escape: () => { (window as any).__activeCanvas?.discardActiveObject?.(); (window as any).__activeCanvas?.requestRenderAll?.(); setCtxMenu(null); },
      nudge: canvas.nudgeSelected,
      group: canvas.groupSelected,
      ungroup: canvas.ungroupSelected,
      bringToFront: canvas.bringToFront,
      sendToBack: canvas.sendToBack,
      save: () => saveMutation.mutate(),
      zoomIn: () => canvas.zoomAt(zoom + 0.1),
      zoomOut: () => canvas.zoomAt(zoom - 0.1),
      zoomFit: canvas.zoomToFit,
      togglePanel: (p) => setActivePanel(p),
      nextPage: () => canvas.goToPage(Math.min(canvas.currentPageIdx + 1, canvas.pages.length - 1)),
      prevPage: () => canvas.goToPage(Math.max(canvas.currentPageIdx - 1, 0)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.isReady, zoom, canvas.currentPageIdx, canvas.pages.length]);

  // ── ctrl+wheel zoom on canvas area (cursor-anchored, non-passive) ──
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el || !canvas.isReady) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain wheel = native scroll/pan
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      canvas.zoomAtPointInContainer(
        canvas.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1),
        el,
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
      );
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.isReady, canvas.zoom]);

  // ── drag & drop images onto the canvas (files + image URLs) ──────
  // Separate effect so the non-passive ctrl+wheel listener above stays put.
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el || !canvas.isReady) return;
    let dragDepth = 0;

    const wantsDrop = (e: DragEvent) => {
      const dt = e.dataTransfer;
      if (!dt) return false;
      const types = Array.from(dt.types ?? []);
      return types.includes("Files") || types.includes("text/uri-list");
    };
    const showHint = () => {
      el.style.outline = "2px dashed var(--w11-accent)";
      el.style.outlineOffset = "-2px";
    };
    const hideHint = () => { el.style.outline = ""; };

    const onDragEnter = (e: DragEvent) => {
      if (!wantsDrop(e)) return;
      dragDepth += 1;
      e.preventDefault();
      showHint();
    };
    const onDragOver = (e: DragEvent) => {
      if (!wantsDrop(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      showHint();
    };
    const onDragLeave = (e: DragEvent) => {
      if (!wantsDrop(e)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) hideHint();
    };
    const onDrop = (e: DragEvent) => {
      dragDepth = 0;
      hideHint();
      if (!wantsDrop(e)) return;
      e.preventDefault();
      const dt = e.dataTransfer!;
      // insert centered on the drop point (logical canvas coords)
      const center = canvasPointFromClient(e) ?? undefined;

      // 1) dropped image files
      const file = Array.from(dt.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        blobToDataUrl(file)
          .then((dataUrl) => canvas.addImage(dataUrl, { center, intoFrame: "auto" }))
          .catch(() => toast.error("Couldn't load image"));
        return;
      }

      // 2) image URL dragged from another tab / the OS
      const uri = (dt.getData("text/uri-list") || dt.getData("text/plain") || "").trim();
      if (/^(https?:\/\/|data:image\/)/i.test(uri)) {
        canvas.addImage(uri, { center, intoFrame: "auto" });
        return;
      }
      toast.error("Only image files or image URLs can be dropped on the canvas");
    };

    el.addEventListener("dragenter", onDragEnter);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
      hideHint();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.isReady, canvas.addImage]);

  // ── paste images from the system clipboard (Ctrl+V) ──────────────
  // Only clipboard items of type image/* are handled, so the existing
  // copy/paste of fabric objects keeps working unchanged.
  useEffect(() => {
    if (!canvas.isReady) return;

    const isEditable = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

    /** True if an image was found on the system clipboard and inserted. */
    const insertClipboardImage = async () => {
      if (!navigator.clipboard?.read) return false;
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        canvas.addImage(await blobToDataUrl(blob), { intoFrame: "auto" });
        return true;
      }
      return false;
    };

    // attachShortcuts cancels Ctrl+V keydowns, which suppresses the native
    // `paste` event — so the reliable entry point is a capture-phase keydown
    // that reads the system clipboard itself. No image there → fall back to
    // the existing fabric-object paste; read() unavailable/denied → same.
    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "v") return;
      if (isEditable(e.target)) return; // inputs / editing text: native paste
      if (!navigator.clipboard?.read) return; // paste-event fallback below
      e.preventDefault();
      e.stopPropagation();
      insertClipboardImage()
        .then((inserted) => { if (!inserted) canvas.pasteClipboard(); })
        .catch(() => canvas.pasteClipboard());
    };

    // native paste events (browser Edit menu, etc.) — images only
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((i) => i.type.startsWith("image/"));
      if (!imageItem) return; // not an image → existing fabric paste flow
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      blobToDataUrl(file)
        .then((dataUrl) => canvas.addImage(dataUrl))
        .catch(() => toast.error("Couldn't load image"));
    };

    window.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDownCapture, true);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.isReady, canvas.addImage]);

  // ── context menu ───────────────────────────────────────────────
  const onCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const filteredTemplates = useMemo(
    () => allTemplates.filter((t: any) => !tplSearch || t.name.toLowerCase().includes(tplSearch.toLowerCase())),
    [allTemplates, tplSearch],
  );

  // ── data fill (tokens → textboxes + image placeholders) ──────────
  const applyDataFields = useCallback((fields: Record<string, string>) => {
    const fc = (window as any).__activeCanvas;
    if (!fc || !fields || Object.keys(fields).length === 0) {
      toast.error("No data available to apply");
      return;
    }

    const replaceTokens = (value: string) => {
      let out = value;
      Object.entries(fields).forEach(([key, raw]) => {
        const v = raw == null ? "" : String(raw);
        out = out.replaceAll(`{{${key}}}`, v);
        out = out.replaceAll(`{${key}}`, v);
      });
      return out;
    };

    // Templates may reference the same image under legacy token names.
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v1\/?$/, "");
    const imageField = (key: string) => {
      let v = "";
      if (key === "photo") v = fields.photo || fields.photo_url || fields.student_photo || "";
      else if (key === "photo_url") v = fields.photo_url || fields.photo || "";
      else v = fields[key] || "";
      if (!v) return v;
      // relative upload paths must hit the API origin, not the frontend one
      if (v.startsWith("/")) v = `${apiBase || window.location.origin}${v}`;
      return v;
    };

    let changed = 0;
    const pendingImages: Promise<void>[] = [];
    fc.getObjects().forEach((obj: any) => {
      const type = String(obj.type || "").toLowerCase();
      if (["textbox", "text", "i-text"].includes(type) && typeof obj.text === "string") {
        const next = replaceTokens(obj.text);
        if (next !== obj.text) {
          obj.set({ text: next });
          changed += 1;
        }
        return;
      }
      if (type === "image") {
        // placeholders survive as data.token when src was sanitized to ""
        const tokenSrc: string = obj.data?.token
          || (typeof obj.src === "string" && obj.src.includes("{") ? obj.src : "");
        const tokenMatch = tokenSrc.match(/\{\{?(\w+)\}?\}/);
        if (tokenMatch) {
          const next = imageField(tokenMatch[1]);
          if (next && next !== obj.src) {
            const target = obj;
            const frame = { width: target.width, height: target.height, scaleX: target.scaleX ?? 1, scaleY: target.scaleY ?? 1 };
            pendingImages.push(
              target.setSrc(next, { crossOrigin: "anonymous" })
                .then(() => {
                  // setSrc adopts the image's natural size — restore the template frame
                  target.set({ ...frame, dirty: true });
                  target.setCoords();
                  fc.renderAll();
                })
                .then(() => { target.data = { ...(target.data ?? {}), token: undefined }; })
                .catch(() => { /* image unavailable — leave placeholder slot */ })
            );
            changed += 1;
          }
        }
      }
    });

    if (pendingImages.length > 0) {
      Promise.allSettled(pendingImages).then(() => {
        fc.requestRenderAll();
        canvas.snapshot();
      });
    }

    if (changed > 0) {
      fc.renderAll();
      if (pendingImages.length === 0) canvas.snapshot();
      toast.success(`Applied data to ${changed} layer${changed > 1 ? "s" : ""}`);
    } else {
      toast.info("No placeholders found. Use {field_name} tokens in text or image layers.");
    }
  }, [canvas]);

  const currentSizeName = Object.entries(PAGE_SIZES).find(
    ([, v]) => v.width === canvas.currentPageSettings?.width && v.height === canvas.currentPageSettings?.height
  )?.[0] ?? "Custom";

  const hasSelection = !!canvas.selectedObject;

  return (
    <TooltipProvider>
      <div
        className={`flex flex-col h-screen overflow-hidden ${win11.className}`}
        data-theme={win11.theme}
        style={{ background: "var(--w11-window-bg)" }}
      >
        <FilePicker
          open={showImagePicker}
          onOpenChange={setShowImagePicker}
          fileType="image"
          title="Select Image"
          onSelect={(files) => {
            const selected = files[0];
            if (selected?.url) {
              // relative /uploads paths must resolve against the API origin;
              // addImage then fetches it into a data URI (CORS-proof insert)
              canvas.addImage(absolutizeImageUrl(selected.url));
            }
          }}
        />
        <FilePicker
          open={showDesignPicker}
          onOpenChange={setShowDesignPicker}
          onSelect={handleDesignSelect}
          title="Select Design File"
        />

        {/* CONTEXT MENU — Fluent flyout (token-driven surface + elevation) */}
        {ctxMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
            <div
              className="fixed z-50 min-w-44 rounded-[var(--w11-radius-lg)] border border-[var(--w11-border-default)] shadow-[var(--w11-elevation-flyout)] py-1 text-[13px]"
              style={{
                left: Math.min(ctxMenu.x, window.innerWidth - 200),
                top: Math.min(ctxMenu.y, window.innerHeight - 300),
                background: "var(--w11-surface-flyout)",
                color: "var(--w11-text-primary)",
              }}
            >
              {[
                { label: "Duplicate", action: canvas.duplicateSelected, hint: "Ctrl+D" },
                { label: "Copy", action: canvas.copySelected, hint: "Ctrl+C" },
                { label: "Paste here", action: canvas.pasteClipboard, hint: "Ctrl+V" },
              ].map((i) => (
                <button
                  key={i.label}
                  className="w-full text-left px-3 py-1.5 flex justify-between rounded-[var(--w11-radius-sm)] mx-1 transition-colors duration-100 hover:bg-[var(--w11-control-hover)]"
                  style={{ transitionTimingFunction: "cubic-bezier(0.1, 0.9, 0.2, 1)" }}
                  onClick={() => { i.action(); setCtxMenu(null); }}
                >
                  {i.label}<span className="text-[var(--w11-text-tertiary)] text-xs">{i.hint}</span>
                </button>
              ))}
              <DropdownMenuSeparator />
              <button className="w-full text-left px-3 py-1.5 flex justify-between rounded-[var(--w11-radius-sm)] mx-1 hover:bg-[var(--w11-control-hover)]" onClick={() => { canvas.bringToFront(); setCtxMenu(null); }}>
                Bring to front<span className="text-[var(--w11-text-tertiary)] text-xs">Ctrl+]</span>
              </button>
              <button className="w-full text-left px-3 py-1.5 flex justify-between rounded-[var(--w11-radius-sm)] mx-1 hover:bg-[var(--w11-control-hover)]" onClick={() => { canvas.sendToBack(); setCtxMenu(null); }}>
                Send to back<span className="text-[var(--w11-text-tertiary)] text-xs">Ctrl+[</span>
              </button>
              <DropdownMenuSeparator />
              <button className="w-full text-left px-3 py-1.5 rounded-[var(--w11-radius-sm)] mx-1 text-red-600 hover:bg-[var(--w11-control-hover)] dark:text-red-400" onClick={() => { canvas.deleteSelected(); setCtxMenu(null); }}>
                Delete
              </button>
            </div>
          </>
        )}

        {/* TOP BAR — Fluent command surface */}
        <div
          className="flex items-center gap-1.5 px-3 h-12 border-b border-[var(--w11-border-default)] shrink-0 z-10"
          style={{ background: "var(--w11-surface-solid)" }}
        >
          <Link href="/dashboard/designer">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          {/* Doc name — Fluent underline focus (borderless until focused) */}
          <Input value={docName} onChange={(e) => setDocName(e.target.value)}
            className="w-44 h-7 text-sm font-semibold shrink-0 border-transparent focus:border-[var(--w11-accent)] bg-transparent hover:bg-[var(--w11-control-hover)] transition-colors px-2" />
          <Select value={currentSizeName} onValueChange={(v) => canvas.changePageSize(v)}>
            <SelectTrigger className="w-24 h-7 text-xs shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.keys(PAGE_SIZES).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2 shrink-0"
            onClick={() => canvas.updatePageSettings({ orientation: canvas.currentPageSettings?.orientation === "portrait" ? "landscape" : "portrait" })}>
            {canvas.currentPageSettings?.orientation === "portrait" ? "Portrait" : "Landscape"}
          </Button>
          <Separator orientation="vertical" className="h-6 shrink-0 bg-[var(--w11-border-subtle)]" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.redo} disabled={!canRedo} title="Redo (Ctrl+⇧+Z)"><Redo2 className="h-3.5 w-3.5" /></Button>
          <Separator orientation="vertical" className="h-6 shrink-0 bg-[var(--w11-border-subtle)]" />
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => canvas.zoomAt(zoom - 0.1)} title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></Button>
            <button
              className="commandbar-button text-xs w-12 !min-h-0 h-7 !px-1 font-medium"
              onClick={() => canvas.zoomAt(1)}
            >{Math.round(zoom * 100)}%</button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => canvas.zoomAt(zoom + 0.1)} title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.zoomToFit} title="Zoom to fit (Ctrl+0)"><Maximize className="h-3.5 w-3.5" /></Button>
          </div>
          <Separator orientation="vertical" className="h-6 shrink-0 bg-[var(--w11-border-subtle)]" />
          {/* toggle buttons — accent-light + accent text when active (commandbar pattern) */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSnapping} title="Smart snapping (magnet)"
            style={snapping ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)" } : undefined}>
            <Magnet className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => useDesignerStore.getState().toggleGrid()} title="Grid overlay"
            style={showGrid ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)" } : undefined}>
            <Grid3x3 className="h-3.5 w-3.5" />
          </Button>
          {hasSelection && (
            <>
              <Separator orientation="vertical" className="h-6 shrink-0 bg-[var(--w11-border-subtle)]" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.duplicateSelected} title="Duplicate (Ctrl+D)"><Copy className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400" onClick={canvas.deleteSelected} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setShowAI(!showAI); setActivePanel(null); }}>
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--w11-accent)" }} /> AI
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-3.5 w-3.5" />{saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3 opacity-60" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[280px]">
                {/* ── Quality selector — visible segmented pill row ── */}
                <div className="px-3 py-2.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Export Quality</span>
                    <span className="text-[10px] text-[var(--w11-text-tertiary)] font-mono">{Math.round(dpiScale * 96)} DPI</span>
                  </div>
                  <div className="flex gap-1">
                    {([
                      { v: 2,     label: "Screen" },
                      { v: 3.125, label: "Print ★" },
                      { v: 4,     label: "High"    },
                      { v: 5,     label: "Ultra"   },
                    ] as { v: number; label: string }[]).map(({ v, label }) => (
                      <button key={v}
                        onClick={() => setDpiScale(v)}
                        className={`flex-1 text-[10px] py-1.5 rounded-[var(--w11-radius-md)] border font-medium leading-none transition-all
                          ${dpiScale === v
                            ? "border-transparent"
                            : "border-[var(--w11-border-default)] text-[var(--w11-text-secondary)] hover:bg-[var(--w11-control-hover)]"}`}
                        style={dpiScale === v ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)" } : undefined}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {(["jpeg", "png"] as const).map((fmt) => (
                      <button key={fmt}
                        onClick={() => setExportJpeg(fmt === "jpeg")}
                        className={`flex-1 text-[10px] py-1 rounded-[var(--w11-radius-md)] border font-medium transition-all
                          ${(exportJpeg ? "jpeg" : "png") === fmt
                            ? "border-transparent"
                            : "border-[var(--w11-border-default)] text-[var(--w11-text-secondary)] hover:bg-[var(--w11-control-hover)]"}`}
                        style={(exportJpeg ? "jpeg" : "png") === fmt ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)" } : undefined}
                      >
                        {fmt === "jpeg" ? "JPEG · smaller" : "PNG · lossless"}
                      </button>
                    ))}
                  </div>
                </div>
                <DropdownMenuSeparator />
                {/* ── Export options ── */}
                <DropdownMenuItem disabled={exporting} onClick={() => serverPdfMutation.mutate()}>
                  <FileOutput className="h-4 w-4 mr-2.5 text-red-500 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">PDF — Print-ready</div>
                    <div className="text-[10px] text-[var(--w11-text-tertiary)]">Server-rendered · Nepali fonts · vector text</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exporting} onClick={() => handleExport("pdf")}>
                  <FileDown className="h-4 w-4 mr-2.5 text-orange-500 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">PDF — Quick export</div>
                    <div className="text-[10px] text-[var(--w11-text-tertiary)]">Browser-rendered · instant</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exporting} onClick={() => handleExport("png")}>
                  <FileImage className="h-4 w-4 mr-2.5 text-blue-500 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">PNG / JPEG Image</div>
                    <div className="text-[10px] text-[var(--w11-text-tertiary)]">
                      {exporting ? "Exporting…" : `${(canvas.toFullJSON() as any)?.pages?.length > 1 ? "ZIP of all pages" : "Current page"} · ${Math.round(dpiScale * 96)} DPI`}
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exporting} onClick={() => {
                  const fc = (window as any).__activeCanvas;
                  if (!fc) { toast.error("Canvas not ready"); return; }
                  setExporting(true);
                  exportPPTX(fc, `${docName.replace(/\s+/g, "_").toLowerCase()}.pptx`, canvas.toFullJSON())
                    .then(() => toast.success("PowerPoint exported — one slide per page"))
                    .catch((e: any) => toast.error(e?.message ?? "PPTX export failed"))
                    .finally(() => setExporting(false));
                }}>
                  <PanelTop className="h-4 w-4 mr-2.5 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">PPTX — PowerPoint</div>
                    <div className="text-[10px] text-[var(--w11-text-tertiary)]">One slide per page</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exporting} onClick={() => {
                  const fc = (window as any).__activeCanvas;
                  if (!fc) { toast.error("Canvas not ready"); return; }
                  setExporting(true);
                  exportSVG(fc, `${docName.replace(/\s+/g, "_").toLowerCase()}.svg`, canvas.toFullJSON())
                    .then(() => toast.success("SVG exported (vector)"))
                    .catch((e: any) => toast.error(e?.message ?? "SVG export failed"))
                    .finally(() => setExporting(false));
                }}>
                  <Code2 className="h-4 w-4 mr-2.5 text-purple-500 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">SVG — Vector</div>
                    <div className="text-[10px] text-[var(--w11-text-tertiary)]">Editable in Figma / Inkscape</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => saveAsTemplateMutation.mutate()}>
                  <Save className="h-4 w-4 mr-2.5 text-green-500 shrink-0" /> Save as School Template
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); }}>
                  <VersionHistoryButton docId={docId} onRestored={() => window.location.reload()} />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  <FileJson className="h-4 w-4 mr-2.5 shrink-0" /> Save as .aschool-design
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDesignPicker(true)}>
                  <Upload className="h-4 w-4 mr-2.5 shrink-0" /> Open .aschool-design File
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* BODY */}
        <div className="flex flex-1 min-h-0">
          {/* Icon bar — Fluent nav rail */}
          <div
            className="flex flex-col items-center gap-1.5 py-3 w-[72px] border-r border-[var(--w11-border-default)] shrink-0 overflow-y-auto custom-scrollbar"
            style={{ background: "var(--w11-surface-solid)" }}
          >
            {SIDEBAR_ICONS.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setActivePanel(item.id); setShowAI(false); }}
                    // commandbar-button (11.css): borderless, control-hover on hover
                    className="commandbar-button !min-h-0 flex flex-col items-center justify-center gap-1.5 w-[60px] h-[56px] !px-0 text-[10px] font-semibold shrink-0 select-none"
                    style={{
                      borderRadius: "var(--w11-radius-lg)",
                      transition: "background var(--w11-transition-fast), color var(--w11-transition-fast)",
                      ...(activePanel === item.id
                        ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)" }
                        : { color: "var(--w11-text-secondary)" }),
                    }}
                  >
                    <item.Icon className="h-5 w-5" />
                    <span className="leading-tight text-center truncate max-w-[56px]">{item.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Sliding panel — Fluent side panel */}
          {activePanel && (
            <div
              className="w-80 border-r border-[var(--w11-border-default)] shrink-0 flex flex-col overflow-hidden animate-in slide-in-from-left-2 duration-200 z-10"
              style={{ background: "var(--w11-surface-solid)" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--w11-border-subtle)] shrink-0">
                <span className="font-semibold text-[13px] capitalize text-[var(--w11-text-primary)]">
                  {activePanel === "shapes" ? "Shapes & Vectors" : activePanel === "data" ? "Data Fill" : activePanel === "background" ? "Canvas Background" : activePanel}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActivePanel(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                {activePanel === "explore" && (
                  <ExplorePanel
                    onLoadTemplate={(tpl) => loadTemplate(tpl)}
                    onAddIcon={(svg, color) => canvas.addSVG(svg, {}, color)}
                    onAddPhoto={(url) => canvas.addImage(url, { width: 260 })}
                  />
                )}

                {activePanel === "templates" && (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--w11-text-tertiary)] pointer-events-none" />
                      <Input placeholder="Search templates…" value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} className="pl-8 h-8 text-xs rounded-[var(--w11-radius-md)]" />
                    </div>
                    {filteredTemplates.length === 0 ? (
                      <div className="text-center py-8 px-4 rounded-[var(--w11-radius-lg)] border border-dashed border-[var(--w11-border-default)]">
                        <div className="text-xs text-[var(--w11-text-secondary)] font-medium">No templates found</div>
                        <div className="text-[10px] text-[var(--w11-text-tertiary)] mt-1">Try another search keyword</div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        {filteredTemplates.map((tpl: any) => (
                          <button key={tpl.id}
                            onClick={() => loadTemplate(tpl)}
                            className="group relative rounded-[var(--w11-radius-lg)] overflow-hidden border border-[var(--w11-border-default)] hover:border-[var(--w11-accent)] text-left transition-colors"
                            style={{ background: "var(--w11-control-bg)", transitionDuration: "var(--w11-transition-fast)" }}
                          >
                            {/* Thumbnail image area — real thumbnail or
                                deterministic gradient tile (never blank) */}
                            <div className="relative overflow-hidden" style={{ paddingTop: "130%" }}>
                              <TemplateThumb
                                url={tpl.thumbnail_url}
                                name={tpl.name}
                                icon={<LayoutTemplate className="h-5 w-5" />}
                                className="group-hover:scale-105 transition-transform duration-300"
                              />
                              {/* Hover overlay */}
                              <div className="absolute inset-0 bg-[var(--w11-accent-light)] opacity-0 group-hover:opacity-40 transition-opacity duration-200 pointer-events-none" />
                              {/* Editor type badge */}
                              <div className="absolute top-1.5 right-1.5">
                                <span className="text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded-[var(--w11-radius-sm)] font-semibold backdrop-blur-md">
                                  {tpl.editor_type === "writer" ? "W" : "D"}
                                </span>
                              </div>
                            </div>
                            {/* Name */}
                            <div className="p-2 border-t border-[var(--w11-border-subtle)]">
                              <span className="text-[10px] font-semibold text-[var(--w11-text-primary)] leading-tight line-clamp-2 block group-hover:text-[var(--w11-accent)] transition-colors">{tpl.name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activePanel === "shapes" && (
                  <div className="space-y-4">
                    {SHAPE_GROUPS.map((group) => (
                      <div key={group.label} className="space-y-2">
                        <div className="text-[11px] font-semibold text-[var(--w11-text-tertiary)] uppercase tracking-wider">{group.label}</div>
                        <div className="grid grid-cols-3 gap-2">
                          {group.shapes.map((s) => (
                            <button key={s.id} onClick={() => handleShape(s.id)}
                              className="group flex flex-col items-center justify-center gap-1.5 p-3 rounded-[var(--w11-radius-lg)] border border-[var(--w11-border-subtle)] hover:border-[var(--w11-accent)] hover:bg-[var(--w11-accent-light)] transition-colors"
                              style={{ background: "var(--w11-control-bg)", transitionDuration: "var(--w11-transition-fast)" }}>
                              <div className="h-7 w-7 flex items-center justify-center text-[var(--w11-text-secondary)] group-hover:text-[var(--w11-accent)] transition-colors">
                                {SHAPE_SVGS[s.id] ?? <Shapes className="h-5 w-5" />}
                              </div>
                              <span className="text-[10px] font-medium text-[var(--w11-text-secondary)] group-hover:text-[var(--w11-text-primary)] truncate max-w-full">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activePanel === "text" && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-[var(--w11-text-primary)] mb-1">Typography</p>
                      <div className="text-[10px] text-[var(--w11-text-tertiary)] mb-3">Click any style to add to your canvas</div>
                      <div className="space-y-2">
                        {[
                          { label: "Add a heading", desc: "Large title", action: () => canvas.addHeading(1), style: { fontSize: "19px", fontWeight: 700 } },
                          { label: "Add a subheading", desc: "Section header", action: () => canvas.addHeading(2), style: { fontSize: "15px", fontWeight: 600 } },
                          { label: "Add a little bit of body text", desc: "Standard text", action: () => canvas.addText("Body text"), style: { fontSize: "13px", fontWeight: 400 } },
                          { label: "Add a caption / note", desc: "Small details", action: () => canvas.addText("Caption", { fontSize: 11 }), style: { fontSize: "11px", color: "var(--w11-text-tertiary)" } },
                        ].map((t) => (
                          <button
                            key={t.label}
                            onClick={t.action}
                            className="w-full text-left p-3.5 rounded-[var(--w11-radius-lg)] border border-[var(--w11-border-subtle)] hover:border-[var(--w11-accent)] hover:bg-[var(--w11-accent-light)] transition-colors group"
                            style={{ background: "var(--w11-control-bg)", transitionDuration: "var(--w11-transition-fast)" }}
                          >
                            <span className="block text-[var(--w11-text-primary)] group-hover:text-[var(--w11-accent)] transition-colors leading-tight" style={t.style}>{t.label}</span>
                            <span className="text-[10px] text-[var(--w11-text-tertiary)] mt-1 block">{t.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <Separator className="bg-[var(--w11-border-subtle)]" />
                    <div>
                      <div className="text-[11px] font-semibold text-[var(--w11-text-tertiary)] uppercase tracking-wider mb-2">School Dynamic Tokens</div>
                      <div className="flex flex-wrap gap-1.5">
                        {["School Name", "Student Name", "Roll No", "Class / Section", "Date of Birth", "Symbol No", "GPA / Grade", "Exam Name", "Academic Year"].map((label) => (
                          <button
                            key={label}
                            onClick={() => canvas.addText(`{${label.toLowerCase().replace(/[\s/]+/g, "_")}}`, { fontSize: 13, fontWeight: 600 })}
                            className="text-[10px] font-medium px-2.5 py-1 rounded-[var(--w11-radius-full)] border border-[var(--w11-border-default)] hover:bg-[var(--w11-accent-light)] hover:border-[var(--w11-accent)] hover:text-[var(--w11-accent)] transition-colors"
                            style={{ background: "var(--w11-control-bg)", transitionDuration: "var(--w11-transition-fast)" }}
                          >
                            +{label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === "media" && (
                  <>
                    <Button className="w-full h-10 gap-2" variant="outline" onClick={() => setShowImagePicker(true)}>
                      <Upload className="h-4 w-4" /> Upload Image
                    </Button>
                    <div>
                      <p className="text-xs font-medium text-[var(--w11-text-primary)] mb-1.5">Image from URL</p>
                      <div className="flex gap-1.5">
                        <Input placeholder="https://..." value={imgUrlInput} onChange={(e) => setImgUrlInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && imgUrlInput.trim()) { canvas.addImage(imgUrlInput.trim()); setImgUrlInput(""); }}}
                          className="h-8 text-xs" />
                        <Button size="sm" className="h-8 px-2 text-xs shrink-0"
                          onClick={() => { if (imgUrlInput.trim()) { canvas.addImage(imgUrlInput.trim()); setImgUrlInput(""); }}}>Add</Button>
                      </div>
                    </div>
                    <Separator className="bg-[var(--w11-border-subtle)]" />
                    <div className="text-[10px] text-[var(--w11-text-tertiary)]">
                      Tip: uploaded school assets appear here from the Brand panel (Media library coming together).
                    </div>
                  </>
                )}

                {activePanel === "graphics" && (
                  <GraphicsPanel
                    onAddQr={(v) => canvas.addQR(v)}
                    onAddWatermark={(t) => canvas.addWatermark(t)}
                    onAddIcon={(svg, color) => canvas.addSVG(svg, {}, color)}
                  />
                )}

                {activePanel === "background" && (
                  <>
                    <p className="text-xs font-medium text-[var(--w11-text-primary)]">Solid Colors</p>
                    <div className="grid grid-cols-5 gap-2">
                      {BG_PRESETS.map((c) => (
                        <button key={c} onClick={() => { setBgColor(c); canvas.updatePageSettings({ background: c }); }}
                          className="w-10 h-10 rounded-[var(--w11-radius-md)] border-2 transition-transform hover:scale-110"
                          style={{
                            background: c,
                            borderColor: bgColor === c ? "var(--w11-accent)" : "transparent",
                            boxShadow: bgColor === c ? "0 0 0 2px var(--w11-accent-light)" : undefined,
                            transitionDuration: "var(--w11-transition-fast)",
                          }} title={c} />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[var(--w11-text-primary)]">Custom:</label>
                      <input type="color" value={bgColor}
                        onChange={(e) => { setBgColor(e.target.value); canvas.updatePageSettings({ background: e.target.value }); }}
                        className="w-8 h-8 rounded-[var(--w11-radius-sm)] border border-[var(--w11-border-default)] cursor-pointer bg-transparent" />
                      <span className="text-xs font-mono text-[var(--w11-text-secondary)]">{bgColor}</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs"
                      onClick={() => canvas.updatePageSettings({ background: bgColor }, true)}>
                      Apply to all pages
                    </Button>
                  </>
                )}

                {activePanel === "data" && (
                  <DataFillPanel
                    onApply={applyDataFields}
                    onInsertToken={(token) => {
                      const fc = (window as any).__activeCanvas;
                      const obj = fc?.getActiveObject();
                      if (!fc || !obj || !["textbox", "text", "i-text"].includes(String(obj.type).toLowerCase())) {
                        // no text selected → add a new token text layer
                        canvas.addText(token, { fontSize: 14 });
                        toast.info(`Added ${token} as a new text layer`);
                        return;
                      }
                      if (obj.isEditing) {
                        // insert at the textarea cursor
                        const ta = obj.hiddenTextarea;
                        if (ta) {
                          const start = ta.selectionStart ?? obj.text.length;
                          const end = ta.selectionEnd ?? obj.text.length;
                          obj.set({ text: obj.text.slice(0, start) + token + obj.text.slice(end) });
                          obj.fire("changed");
                        } else {
                          obj.set({ text: obj.text + token });
                        }
                      } else {
                        obj.set({ text: obj.text + token });
                        obj.fire("changed");
                      }
                      fc.requestRenderAll();
                      canvas.snapshot();
                      toast.success(`Inserted ${token}`);
                    }}
                  />
                )}

                {activePanel === "layers" && <LayersPanel canvas={canvas} />}

              </div>
            </div>
          )}

          {/* Canvas + pages strip */}
          <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden">
            {/* Page strip — compact Canva-style toolbar */}
            <div
              className="flex items-center gap-2 px-4 py-2 border-b border-[var(--w11-border-subtle)] shrink-0 overflow-x-auto custom-scrollbar"
              style={{ background: "var(--w11-surface-solid)" }}
            >
              <span className="text-[11px] font-semibold text-[var(--w11-text-tertiary)] uppercase tracking-wider mr-1 shrink-0">Pages</span>
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                {canvas.pages.map((pg, idx) => (
                  <div key={pg.id} className="relative group shrink-0">
                    <button
                      onClick={() => canvas.goToPage(idx)}
                      onDoubleClick={() => canvas.duplicatePage(idx)}
                      title={canvas.currentPageIdx === idx ? "Current page · double-click to duplicate" : "Click to view page"}
                      className={`h-7 px-3 rounded-[var(--w11-radius-md)] border text-xs font-semibold flex items-center gap-1.5 select-none
                        ${canvas.currentPageIdx === idx ? "border-transparent" : "border-[var(--w11-border-default)] hover:bg-[var(--w11-control-hover)] text-[var(--w11-text-secondary)] hover:text-[var(--w11-text-primary)]"}`}
                      style={{
                        transition: "background var(--w11-transition-fast), color var(--w11-transition-fast)",
                        ...(canvas.currentPageIdx === idx ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)" } : { background: "var(--w11-control-bg)" }),
                      }}
                    >
                      <span>Page {idx + 1}</span>
                    </button>
                    {canvas.pages.length > 1 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full border border-[var(--w11-border-default)] text-[var(--w11-text-secondary)] hover:text-[var(--w11-text-primary)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: "var(--w11-surface-solid)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-2.5 w-2.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => canvas.duplicatePage(idx)}>Duplicate Page</DropdownMenuItem>
                          {idx !== canvas.currentPageIdx && (
                            <DropdownMenuItem onClick={() => canvas.movePage(idx, canvas.currentPageIdx)}>Move here</DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={() => canvas.removePage(idx)}>Delete Page</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs rounded-[var(--w11-radius-md)] gap-1 border-dashed shrink-0 hover:border-[var(--w11-accent)] hover:text-[var(--w11-accent)] transition-colors"
                onClick={canvas.addPage}
                title="Add new blank page"
              >
                <Plus className="h-3.5 w-3.5" /> Add Page
              </Button>
              <div className="ml-auto text-xs text-[var(--w11-text-secondary)] shrink-0 font-medium px-2 py-0.5 rounded-[var(--w11-radius-md)]"
                style={{ background: "var(--w11-control-hover)" }}>
                {canvas.currentPageIdx + 1} of {canvas.pages.length}
              </div>
            </div>
            <div
              ref={scrollAreaRef}
              data-canvas-scroll
              className="flex-1 min-h-0 overflow-auto flex p-8 custom-scrollbar"
              style={{ background: "var(--w11-window-bg)" }}
              onContextMenu={onCanvasContextMenu}
            >
              {/* wrapper scales with zoom (m-auto keeps it centered AND fully
                  scrollable when larger than the viewport — flex justify-center
                  would clip the top/left overflow) */}
              <div
                className="relative m-auto"
                style={{
                  boxShadow: "var(--w11-elevation-card)",
                  width: (canvas.canvasSize?.width ?? 794) * zoom,
                  height: (canvas.canvasSize?.height ?? 1123) * zoom,
                }}
              >
                {/* fabric element is logical×zoom; the viewport transform matches */}
                <canvas ref={canvasRef} id="fabric-canvas" className="block" />
                {showGrid && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{
                      // grid = editor chrome, token-driven so it flips with the theme
                      backgroundImage: "linear-gradient(to right, var(--w11-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--w11-border-strong) 1px, transparent 1px)",
                      backgroundSize: `${50 * zoom}px ${50 * zoom}px`,
                      opacity: 0.18,
                    }} />
                )}
                <canvas ref={overlayRef} className="absolute left-0 top-0 pointer-events-none"
                  width={canvas.canvasSize?.width ?? 794}
                  height={canvas.canvasSize?.height ?? 1123}
                  style={{ width: (canvas.canvasSize?.width ?? 794) * zoom, height: (canvas.canvasSize?.height ?? 1123) * zoom }} />
              </div>
            </div>
          </div>

          {/* Right: Properties / AI — Fluent side panel */}
          <div
            className="w-64 border-l border-[var(--w11-border-default)] flex flex-col shrink-0"
            style={{ background: "var(--w11-surface-solid)" }}
          >
            {showAI ? (
              <>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--w11-border-subtle)] shrink-0">
                  <span className="text-[13px] font-semibold flex items-center gap-1.5 text-[var(--w11-text-primary)]">
                    <Sparkles className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /> AI Assist
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAI(false)}><X className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex-1 overflow-y-auto"><AIAssistPanel canvas={canvas} /></div>
                <div className="h-80 border-t border-[var(--w11-border-subtle)] shrink-0">
                  <AIChatPanel
                    mode="designer"
                    executeAction={executeAgentAction}
                    getContext={getAgentContext}
                    onClose={() => setShowAI(false)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="px-3 py-2 border-b border-[var(--w11-border-subtle)] shrink-0 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--w11-text-secondary)]">
                    {canvas.selectedObject ? "Properties" : "Page Settings"}
                  </span>
                  <span className="text-[10px] text-[var(--w11-text-tertiary)] flex items-center gap-1"><Layers className="h-3 w-3" />{activePanel === "layers" ? "Layers panel left" : ""}</span>
                </div>
                <div className="flex-1 overflow-y-auto"><PropertiesPanel canvas={canvas} /></div>
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
