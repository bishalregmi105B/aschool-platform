"use client";
/**
 * CanvasEditor v2 — Canva-like canvas designer.
 * Layout: [Icon Bar 64px] | [Sliding Panel 280px] | [Canvas + pages] | [Properties 256px]
 * v2: store-driven panels, real viewport zoom + wheel, pink snap guides,
 * layers panel, graphics (QR/watermark/icons), keyboard shortcuts, context
 * menu, page duplicate/reorder, save-as-template.
 */
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useCanvas, PAGE_SIZES } from "@/lib/hooks/useCanvas";
import { useExport } from "@/lib/hooks/useExport";
import { useDesignerStore, type DesignerPanel } from "@/lib/designer/store";
import { attachShortcuts } from "@/lib/designer/shortcuts";
import { absolutizeImageUrl } from "@/lib/designer/canvasImages";

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
} from "lucide-react";

import PropertiesPanel from "./PropertiesPanel";
import AIAssistPanel   from "./AIAssistPanel";
import DataFillPanel   from "./DataFillPanel";
import LayersPanel     from "./LayersPanel";
import GraphicsPanel   from "./GraphicsPanel";

const SHAPE_GROUPS = [
  { label: "Basic",    shapes: [{ id:"rect",label:"Rectangle",emoji:"⬜"},{ id:"circle",label:"Circle",emoji:"⭕"},{ id:"triangle",label:"Triangle",emoji:"🔺"},{ id:"line",label:"Line",emoji:"➖"},{ id:"arrow",label:"Arrow",emoji:"➡"}] },
  { label: "Polygons", shapes: [{ id:"poly5",label:"Pentagon",emoji:"⬠"},{ id:"poly6",label:"Hexagon",emoji:"⬡"},{ id:"poly8",label:"Octagon",emoji:"🔷"}] },
  { label: "Stars",    shapes: [{ id:"star4",label:"Star 4pt",emoji:"✦"},{ id:"star5",label:"Star 5pt",emoji:"⭐"},{ id:"star6",label:"Star 6pt",emoji:"✶"}] },
];

const BG_PRESETS = [
  "#ffffff","#f8fafc","#f1f5f9","#e2e8f0","#fef3c7","#fce7f3","#ede9fe","#d1fae5",
  "#dbeafe","#fee2e2","#fdf4ff","#f0fdf4","#1e293b","#0f172a","#18181b","#7c2d12",
];

const SIDEBAR_ICONS: Array<{ id: DesignerPanel; icon: string; label: string }> = [
  { id:"templates",  icon:"📄", label:"Templates"  },
  { id:"shapes",     icon:"⬜", label:"Shapes"     },
  { id:"text",       icon:"T",  label:"Text"       },
  { id:"media",      icon:"🖼", label:"Media"      },
  { id:"graphics",   icon:"✨", label:"Graphics"   },
  { id:"background", icon:"🎨", label:"Background" },
  { id:"data",       icon:"📋", label:"Data Fill"  },
  { id:"layers",     icon:"🧱", label:"Layers"     },
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
  const searchParams = useSearchParams();
  const queryClient  = useQueryClient();
  const docId        = searchParams.get("doc");
  const templateId   = searchParams.get("template");
  const bulkSessionId = searchParams.get("bulk_session");

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLCanvasElement>(null);
  const canvas       = useCanvas(canvasRef, overlayRef);
  const { exportPDF, exportPNG, exportPagesZip } = useExport();

  // export quality — multiplier over the 96dpi logical canvas
  const [dpiScale, setDpiScale] = useState(3);
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

  const templateLoadedRef = useRef(false);
  const docLoadedRef      = useRef(false);
  const importFileRef     = useRef<HTMLInputElement>(null);
  const initialFitRef     = useRef(false);

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
   *  multi-page canvas JSON loads as pages, single-page into the canvas. */
  const loadTemplate = useCallback((tpl: any) => {
    setDocName(tpl.name);
    setTemplateIdState(tpl.id);
    if (tpl.editor_type === "writer" && (!tpl.canvas_json || Object.keys(tpl.canvas_json).length === 0)) {
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
    setExporting(true);
    try {
      if (format === "pdf") await exportPDF(fc, `${name}.pdf`, multiPageDoc, dpiScale);
      else if (format === "zip") await exportPagesZip(multiPageDoc, `${name}_pages.zip`, dpiScale);
      else if (format === "png" && (multiPageDoc.pages?.length ?? 0) > 1) {
        // multi-page designs export as a ZIP of per-page PNGs (a stitched
        // strip is useless for print) — auto-detect, no extra click
        await exportPagesZip(multiPageDoc, `${name}_pages.zip`, dpiScale);
        toast.success(`Multi-page detected — exported ${multiPageDoc.pages.length} PNGs as ZIP at ${dpiScale}×`);
      }
      else await exportPNG(fc, `${name}.png`, multiPageDoc, dpiScale);
      toast.success(`Exported at ${dpiScale}× (${Math.round(dpiScale * 96)} DPI)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  }, [docName, canvas, exportPDF, exportPNG, exportPagesZip, dpiScale]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { canvas.loadJSON(JSON.parse(ev.target?.result as string)); setDocName(file.name.replace(/\.(aschool-design|json)$/, "")); toast.success("Design loaded"); } catch { toast.error("Invalid file"); } };
    reader.readAsText(file); e.target.value = "";
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
      el.style.outline = "2px dashed rgb(99 102 241 / 0.7)";
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
      <div className="flex flex-col h-screen overflow-hidden bg-muted/20">
        <input ref={importFileRef} type="file" accept=".json,.aschool-design" className="hidden" onChange={handleImport} />
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

        {/* CONTEXT MENU */}
        {ctxMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
            <div className="fixed z-50 min-w-44 bg-background border rounded-lg shadow-lg py-1 text-sm"
              style={{ left: Math.min(ctxMenu.x, window.innerWidth - 200), top: Math.min(ctxMenu.y, window.innerHeight - 300) }}>
              {[
                { label: "Duplicate", action: canvas.duplicateSelected, hint: "Ctrl+D" },
                { label: "Copy", action: canvas.copySelected, hint: "Ctrl+C" },
                { label: "Paste here", action: canvas.pasteClipboard, hint: "Ctrl+V" },
              ].map((i) => (
                <button key={i.label} className="w-full text-left px-3 py-1.5 hover:bg-muted flex justify-between"
                  onClick={() => { i.action(); setCtxMenu(null); }}>
                  {i.label}<span className="text-muted-foreground text-xs">{i.hint}</span>
                </button>
              ))}
              <DropdownMenuSeparator />
              <button className="w-full text-left px-3 py-1.5 hover:bg-muted flex justify-between" onClick={() => { canvas.bringToFront(); setCtxMenu(null); }}>
                Bring to front<span className="text-muted-foreground text-xs">Ctrl+]</span>
              </button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-muted flex justify-between" onClick={() => { canvas.sendToBack(); setCtxMenu(null); }}>
                Send to back<span className="text-muted-foreground text-xs">Ctrl+[</span>
              </button>
              <DropdownMenuSeparator />
              <button className="w-full text-left px-3 py-1.5 hover:bg-muted text-destructive" onClick={() => { canvas.deleteSelected(); setCtxMenu(null); }}>
                Delete
              </button>
            </div>
          </>
        )}

        {/* TOP BAR */}
        <div className="flex items-center gap-1.5 px-3 h-12 border-b bg-background shrink-0 z-10">
          <Link href="/dashboard/designer">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <Input value={docName} onChange={(e) => setDocName(e.target.value)} className="w-44 h-7 text-sm font-medium shrink-0" />
          <Select value={currentSizeName} onValueChange={(v) => canvas.changePageSize(v)}>
            <SelectTrigger className="w-24 h-7 text-xs shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.keys(PAGE_SIZES).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2 shrink-0"
            onClick={() => canvas.updatePageSettings({ orientation: canvas.currentPageSettings?.orientation === "portrait" ? "landscape" : "portrait" })}>
            {canvas.currentPageSettings?.orientation === "portrait" ? "Portrait" : "Landscape"}
          </Button>
          <Separator orientation="vertical" className="h-6 shrink-0" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.redo} disabled={!canRedo} title="Redo (Ctrl+⇧+Z)"><Redo2 className="h-3.5 w-3.5" /></Button>
          <Separator orientation="vertical" className="h-6 shrink-0" />
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => canvas.zoomAt(zoom - 0.1)} title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></Button>
            <button className="text-xs w-12 text-center hover:bg-muted rounded px-1 py-0.5" onClick={() => canvas.zoomAt(1)}>{Math.round(zoom * 100)}%</button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => canvas.zoomAt(zoom + 0.1)} title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.zoomToFit} title="Zoom to fit (Ctrl+0)"><Maximize className="h-3.5 w-3.5" /></Button>
          </div>
          <Separator orientation="vertical" className="h-6 shrink-0" />
          <Button variant={snapping ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={toggleSnapping} title="Smart snapping (magnet)">
            <Magnet className="h-3.5 w-3.5" />
          </Button>
          <Button variant={showGrid ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => useDesignerStore.getState().toggleGrid()} title="Grid overlay">
            <Grid3x3 className="h-3.5 w-3.5" />
          </Button>
          {hasSelection && (
            <>
              <Separator orientation="vertical" className="h-6 shrink-0" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.duplicateSelected} title="Duplicate (Ctrl+D)"><Copy className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={canvas.deleteSelected} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-violet-600" onClick={() => { setShowAI(!showAI); setActivePanel(null); }}>
              <Sparkles className="h-3.5 w-3.5" /> AI
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-3.5 w-3.5" />{saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-64">
                <div className="px-2 py-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Quality</span>
                  <Select value={String(dpiScale)} onValueChange={(v) => setDpiScale(Number(v))}>
                    <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6].map((s) => {
                        const label = s >= 5 ? "ultra 4K+" : s >= 4 ? "4K-class" : s === 3 ? "print 300 DPI" : "screen";
                        return (
                          <SelectItem key={s} value={String(s)}>
                            {s}× — {Math.round(s * 96)} DPI ({label}){s === 3 ? " ★" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={exporting} onClick={() => serverPdfMutation.mutate()}>
                  <FileOutput className="h-4 w-4 mr-2" /> PDF — Print-ready (server, vector text)
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exporting} onClick={() => handleExport("pdf")}>PDF — quick (browser)</DropdownMenuItem>
                <DropdownMenuItem disabled={exporting} onClick={() => handleExport("png")}>PNG — current view</DropdownMenuItem>
                <DropdownMenuItem disabled={exporting} onClick={() => handleExport("zip")}>PNG ZIP — one file per page</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => saveAsTemplateMutation.mutate()}>Save as school template</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("json")}><FileJson className="h-4 w-4 mr-2" />Save as .aschool-design</DropdownMenuItem>
                <DropdownMenuItem onClick={() => importFileRef.current?.click()}>Open .aschool-design File</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* BODY */}
        <div className="flex flex-1 min-h-0">
          {/* Icon bar */}
          <div className="flex flex-col items-center gap-1 py-3 w-16 border-r bg-background shrink-0 overflow-y-auto">
            {SIDEBAR_ICONS.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setActivePanel(item.id); setShowAI(false); }}
                    className={`flex flex-col items-center justify-center gap-0.5 w-12 h-14 rounded-xl text-[9px] font-medium transition-all shrink-0
                      ${activePanel === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    <span className="text-lg leading-none">{item.icon}</span>
                    <span className="leading-none">{item.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Sliding panel */}
          {activePanel && (
            <div className="w-72 border-r bg-background shrink-0 flex flex-col overflow-hidden animate-in slide-in-from-left-2 duration-150">
              <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0">
                <span className="font-semibold text-sm capitalize">{activePanel === "shapes" ? "Shapes" : activePanel === "data" ? "Data Fill" : activePanel}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActivePanel(activePanel)}><X className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4">

                {activePanel === "templates" && (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Search…" value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} className="pl-7 h-8 text-xs" />
                    </div>
                    {filteredTemplates.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No templates found</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredTemplates.map((tpl: any) => (
                          <button key={tpl.id}
                            onClick={() => loadTemplate(tpl)}
                            className="group relative border rounded-lg overflow-hidden hover:border-primary hover:shadow-sm transition-all bg-muted/30"
                            style={{ paddingTop:"75%" }}
                          >
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-1.5">
                              <span className="text-3xl">{tpl.thumbnail_emoji ?? "📄"}</span>
                              <span className="text-[9px] text-center text-muted-foreground mt-1 leading-tight">{tpl.name}</span>
                            </div>
                            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activePanel === "shapes" && (
                  <>
                    {SHAPE_GROUPS.map((group) => (
                      <div key={group.label}>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {group.shapes.map((s) => (
                            <button key={s.id} onClick={() => handleShape(s.id)}
                              className="flex flex-col items-center justify-center gap-1 border rounded-lg p-2.5 hover:bg-primary/5 hover:border-primary transition-all">
                              <span className="text-xl">{s.emoji}</span>
                              <span className="text-[9px] text-muted-foreground">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {activePanel === "text" && (
                  <>
                    <p className="text-[10px] text-muted-foreground">Click to add text to canvas</p>
                    <div className="space-y-2">
                      {[
                        { label:"Add a Heading",    action:() => canvas.addHeading(1), style:{fontSize:"22px", fontWeight:700} },
                        { label:"Add a Subheading", action:() => canvas.addHeading(2), style:{fontSize:"18px", fontWeight:600} },
                        { label:"Add body text",     action:() => canvas.addText("Body text"), style:{fontSize:"14px"} },
                        { label:"Add a caption",     action:() => canvas.addText("Caption", {fontSize:11}), style:{fontSize:"11px",color:"#64748b"} },
                      ].map((t) => (
                        <button key={t.label} onClick={t.action}
                          className="w-full text-left border rounded-lg px-3 py-2.5 hover:bg-primary/5 hover:border-primary transition-all"
                          style={t.style}>{t.label}</button>
                      ))}
                    </div>
                    <Separator />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">School Labels</p>
                    {["School Name","Student Name","Roll No","Class / Section","Date of Birth","Address","Phone","Academic Year"].map((label) => (
                      <button key={label} onClick={() => canvas.addText(label, {fontSize:13})}
                        className="w-full text-left text-xs px-2 py-1.5 border rounded hover:bg-muted transition-colors">{label}</button>
                    ))}
                  </>
                )}

                {activePanel === "media" && (
                  <>
                    <Button className="w-full h-10 gap-2" variant="outline" onClick={() => setShowImagePicker(true)}>
                      <Upload className="h-4 w-4" /> Upload Image
                    </Button>
                    <div>
                      <p className="text-xs font-medium mb-1.5">Image from URL</p>
                      <div className="flex gap-1.5">
                        <Input placeholder="https://..." value={imgUrlInput} onChange={(e) => setImgUrlInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && imgUrlInput.trim()) { canvas.addImage(imgUrlInput.trim()); setImgUrlInput(""); }}}
                          className="h-8 text-xs" />
                        <Button size="sm" className="h-8 px-2 text-xs shrink-0"
                          onClick={() => { if (imgUrlInput.trim()) { canvas.addImage(imgUrlInput.trim()); setImgUrlInput(""); }}}>Add</Button>
                      </div>
                    </div>
                    <Separator />
                    <p className="text-[10px] text-muted-foreground">
                      Tip: uploaded school assets appear here from the Brand panel (Media library coming together).
                    </p>
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
                    <p className="text-xs font-medium">Solid Colors</p>
                    <div className="grid grid-cols-5 gap-2">
                      {BG_PRESETS.map((c) => (
                        <button key={c} onClick={() => { setBgColor(c); canvas.updatePageSettings({ background: c }); }}
                          className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${bgColor === c ? "border-primary ring-2 ring-primary/30" : "border-transparent"}`}
                          style={{ background: c }} title={c} />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs">Custom:</label>
                      <input type="color" value={bgColor}
                        onChange={(e) => { setBgColor(e.target.value); canvas.updatePageSettings({ background: e.target.value }); }}
                        className="w-8 h-8 rounded border cursor-pointer" />
                      <span className="text-xs font-mono text-muted-foreground">{bgColor}</span>
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
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background overflow-x-auto shrink-0">
              {canvas.pages.map((pg, idx) => (
                <span key={pg.id} className="relative shrink-0">
                  <button onClick={() => canvas.goToPage(idx)}
                    onDoubleClick={() => canvas.duplicatePage(idx)}
                    title={canvas.currentPageIdx === idx ? "Current page" : "Click to open · double-click to duplicate"}
                    className={`relative flex-shrink-0 flex items-center justify-center rounded border text-xs font-medium transition-all
                      ${canvas.currentPageIdx === idx ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "border-border bg-background hover:bg-muted"}`}
                    style={{ width:38, height:50 }}>
                    {idx+1}
                  </button>
                  {canvas.pages.length > 1 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-background border text-muted-foreground hover:text-foreground flex items-center justify-center"
                          onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-2.5 w-2.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => canvas.duplicatePage(idx)}>Duplicate</DropdownMenuItem>
                        {idx !== canvas.currentPageIdx && (
                          <DropdownMenuItem onClick={() => canvas.movePage(idx, canvas.currentPageIdx)}>Move here</DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => canvas.removePage(idx)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </span>
              ))}
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 border border-dashed" onClick={canvas.addPage} title="Add page"><Plus className="h-3.5 w-3.5" /></Button>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">{canvas.currentPageIdx+1} / {canvas.pages.length}</span>
            </div>
            <div
              ref={scrollAreaRef}
              data-canvas-scroll
              className="flex-1 min-h-0 overflow-auto flex bg-[#f0f0f0] p-8"
              onContextMenu={onCanvasContextMenu}
            >
              {/* wrapper scales with zoom (m-auto keeps it centered AND fully
                  scrollable when larger than the viewport — flex justify-center
                  would clip the top/left overflow) */}
              <div
                className="relative shadow-2xl m-auto"
                style={{
                  width: (canvas.canvasSize?.width ?? 794) * zoom,
                  height: (canvas.canvasSize?.height ?? 1123) * zoom,
                }}
              >
                {/* fabric element is logical×zoom; the viewport transform matches */}
                <canvas ref={canvasRef} id="fabric-canvas" className="block" />
                {showGrid && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
                      backgroundSize: `${50 * zoom}px ${50 * zoom}px`,
                    }} />
                )}
                <canvas ref={overlayRef} className="absolute left-0 top-0 pointer-events-none"
                  width={canvas.canvasSize?.width ?? 794}
                  height={canvas.canvasSize?.height ?? 1123}
                  style={{ width: (canvas.canvasSize?.width ?? 794) * zoom, height: (canvas.canvasSize?.height ?? 1123) * zoom }} />
              </div>
            </div>
          </div>

          {/* Right: Properties / AI */}
          <div className="w-64 border-l bg-background flex flex-col shrink-0">
            {showAI ? (
              <>
                <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-violet-500" /> AI Assist
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAI(false)}><X className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex-1 overflow-y-auto"><AIAssistPanel canvas={canvas} /></div>
              </>
            ) : (
              <>
                <div className="px-3 py-2 border-b shrink-0 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {canvas.selectedObject ? "Properties" : "Page Settings"}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3" />{activePanel === "layers" ? "Layers panel left" : ""}</span>
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
