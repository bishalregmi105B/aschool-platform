"use client";

/**
 * useCanvas — fabric.js multi-page canvas state manager.
 * Manages pages, elements, undo/redo, shapes, and load/save.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type FabricCanvas = any;
export type FabricObject = any;

export interface PageMargins {
  top: number; right: number; bottom: number; left: number;
}

export interface PageState {
  id: string;
  json: Record<string, any>;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  margins: PageMargins;
  background: string;
}

export const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4:        { width: 794,  height: 1123 },
  A5:        { width: 559,  height: 794  },
  A3:        { width: 1123, height: 1587 },
  "ID Card": { width: 300,  height: 189  },
  Letter:    { width: 816,  height: 1056 },
  Legal:     { width: 816,  height: 1344 },
  Custom:    { width: 794,  height: 1123 },
};

const DEFAULT_MARGINS: PageMargins = { top: 72, right: 72, bottom: 72, left: 72 };

/**
 * fabric v6 `loadFromJSON` rejects as a whole when any embedded Image object
 * has an unresolvable src — templates ship image placeholders like
 * "{photo_url}"/"{qr_code}" as src, which would otherwise blank the canvas.
 * Strip those to empty src (renders as empty slot) before handing to fabric.
 */
function sanitizeTemplateImages(json: Record<string, any>): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(json ?? {}));
  const walk = (obj: Record<string, any>) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    const isImage = obj.type?.toLowerCase() === "image";
    if (isImage && (typeof obj.src !== "string" || obj.src.includes("{") || obj.src === "")) {
      // keep the placeholder token in `data` so data-fill can resolve it later
      const token = typeof obj.src === "string" ? obj.src : "";
      obj.src = "";
      obj.srcOrigin = null;
      obj.crossOrigin = null;
      if (token.includes("{")) obj.data = { ...(obj.data ?? {}), token };
    }
    if (isImage && typeof obj.src === "string" && obj.src.startsWith("/")) {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v1\/?$/, "");
      obj.src = `${apiBase || window.location.origin}${obj.src}`;
    }
    Object.values(obj).forEach(walk);
  };
  walk(clone);
  return clone;
}

function mkPage(w = 794, h = 1123): PageState {
  return {
    id: Math.random().toString(36).slice(2, 10),
    json: {},
    width: w, height: h,
    orientation: w <= h ? "portrait" : "landscape",
    margins: { ...DEFAULT_MARGINS },
    background: "#ffffff",
  };
}

export function useCanvas(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const fabricRef    = useRef<FabricCanvas>(null);
  const historyRef   = useRef<string[]>([]);
  const histIdxRef   = useRef<number>(-1);
  const mountedRef   = useRef(false);

  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [zoom, setZoom]       = useState(1);
  const [pages, setPages]     = useState<PageState[]>([mkPage()]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [currentPageSettings, setCurrentPageSettings] = useState<PageState>(mkPage());

  // ── snapshot ────────────────────────────────────────────────────
  const snapshot = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const json = JSON.stringify(fc.toJSON(["data"]));
    const idx  = histIdxRef.current;
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push(json);
    histIdxRef.current = historyRef.current.length - 1;
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(false);
  }, []);

  // ── init canvas ─────────────────────────────────────────────────
  useEffect(() => {
    if (mountedRef.current || !canvasRef.current) return;
    mountedRef.current = true;
    let fc: FabricCanvas;

    import("fabric").then(({ Canvas }) => {
      fc = new Canvas(canvasRef.current!, {
        backgroundColor: "#ffffff",
        width: 794, height: 1123,
        preserveObjectStacking: true,
        selection: true,
      });
      fabricRef.current = fc;
      (window as any).__activeCanvas = fc;
      setIsReady(true);

      fc.on("object:moving", (e: any) => {
        const snap = 5;
        e.target.set({
          left: Math.round(e.target.left / snap) * snap,
          top:  Math.round(e.target.top  / snap) * snap,
        });
      });
      fc.on("selection:created", (e: any) => setSelectedObject(e.selected?.[0] ?? null));
      fc.on("selection:updated", (e: any) => setSelectedObject(e.selected?.[0] ?? null));
      fc.on("selection:cleared", ()       => setSelectedObject(null));
      fc.on("object:modified",   ()       => snapshot());
      fc.on("object:added",      ()       => snapshot());
      fc.on("object:removed",    ()       => snapshot());
      snapshot();
    });

    return () => { if (fc) fc.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── page helpers ────────────────────────────────────────────────
  const saveCurrentPageJSON = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const json = fc.toJSON();
    setPages(prev => {
      const u = [...prev];
      if (u[currentPageIdx]) u[currentPageIdx] = { ...u[currentPageIdx], json };
      return u;
    });
  }, [currentPageIdx]);

  const loadPageToCanvas = useCallback((page: PageState) => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.setDimensions({ width: page.width, height: page.height });
    fc.backgroundColor = page.background ?? "#ffffff";
    if (page.json && Object.keys(page.json).length > 0) {
      fc.loadFromJSON(sanitizeTemplateImages(page.json), () => fc.renderAll())
        .catch(() => fc.renderAll());
    } else {
      fc.clear();
      fc.backgroundColor = page.background ?? "#ffffff";
      fc.renderAll();
    }
    setCurrentPageSettings({ ...page });
    historyRef.current = []; histIdxRef.current = -1;
    setCanUndo(false); setCanRedo(false);
    setTimeout(() => snapshot(), 120);
  }, [snapshot]);

  const goToPage = useCallback((idx: number) => {
    if (idx === currentPageIdx) return;
    saveCurrentPageJSON();
    setTimeout(() => {
      setCurrentPageIdx(idx);
      setPages(prev => { if (prev[idx]) loadPageToCanvas(prev[idx]); return prev; });
    }, 60);
  }, [currentPageIdx, saveCurrentPageJSON, loadPageToCanvas]);

  const addPage = useCallback(() => {
    saveCurrentPageJSON();
    const cur = pages[currentPageIdx];
    const p = { ...mkPage(cur?.width, cur?.height) };
    if (cur) { p.margins = { ...cur.margins }; }
    const newIdx = pages.length;
    setPages(prev => [...prev, p]);
    setTimeout(() => { setCurrentPageIdx(newIdx); loadPageToCanvas(p); }, 60);
  }, [pages, currentPageIdx, saveCurrentPageJSON, loadPageToCanvas]);

  const removePage = useCallback((idx: number) => {
    if (pages.length <= 1) return;
    const np = pages.filter((_, i) => i !== idx);
    const ni = Math.min(currentPageIdx, np.length - 1);
    setPages(np); setCurrentPageIdx(ni);
    setTimeout(() => loadPageToCanvas(np[ni]), 60);
  }, [pages, currentPageIdx, loadPageToCanvas]);

  const updatePageSettings = useCallback((settings: Partial<PageState>) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const cur = pages[currentPageIdx];
    const merged = { ...cur, ...settings };

    if ("orientation" in settings || "width" in settings || "height" in settings) {
      let w = settings.width  ?? cur.width;
      let h = settings.height ?? cur.height;
      if (settings.orientation === "landscape" && w < h) [w, h] = [h, w];
      if (settings.orientation === "portrait"  && w > h) [w, h] = [h, w];
      merged.width = w; merged.height = h;
      fc.setDimensions({ width: w, height: h });
    }
    if ("background" in settings) {
      fc.backgroundColor = settings.background!;
      fc.renderAll();
    }
    fc.renderAll();
    setCurrentPageSettings(merged);
    setPages(prev => { const u = [...prev]; u[currentPageIdx] = merged; return u; });
  }, [pages, currentPageIdx]);

  const changePageSize = useCallback((sizeName: string, orientation?: "portrait" | "landscape") => {
    const size = PAGE_SIZES[sizeName] ?? PAGE_SIZES["A4"];
    const or = orientation ?? currentPageSettings.orientation;
    updatePageSettings({ width: size.width, height: size.height, orientation: or });
  }, [currentPageSettings.orientation, updatePageSettings]);

  // ── element operations ──────────────────────────────────────────
  const addText = useCallback((text = "Double-click to edit", opts: Record<string, any> = {}) => {
    import("fabric").then(({ Textbox }) => {
      const obj = new Textbox(text, {
        left: 100, top: 100, width: 300,
        fontSize: 18, fontFamily: "Arial", fill: "#1e293b",
        editable: true, lineHeight: 1.4, ...opts,
      });
      fabricRef.current?.add(obj);
      fabricRef.current?.setActiveObject(obj);
      fabricRef.current?.renderAll();
    });
  }, []);

  const addHeading = useCallback((level: 1 | 2 | 3 = 1) => {
    const sizes: Record<number, number> = { 1: 36, 2: 28, 3: 22 };
    addText("Heading", { fontSize: sizes[level], fontWeight: "bold" });
  }, [addText]);

  const addRect = useCallback((opts: Record<string, any> = {}) => {
    import("fabric").then(({ Rect }) => {
      const obj = new Rect({ left: 100, top: 100, width: 200, height: 120, fill: "#3b82f6", rx: 6, ry: 6, ...opts });
      fabricRef.current?.add(obj);
      fabricRef.current?.setActiveObject(obj);
      fabricRef.current?.renderAll();
    });
  }, []);

  const addCircle = useCallback((opts: Record<string, any> = {}) => {
    import("fabric").then(({ Circle }) => {
      const obj = new Circle({ left: 150, top: 150, radius: 60, fill: "#f59e0b", ...opts });
      fabricRef.current?.add(obj);
      fabricRef.current?.setActiveObject(obj);
      fabricRef.current?.renderAll();
    });
  }, []);

  const addTriangle = useCallback((opts: Record<string, any> = {}) => {
    import("fabric").then(({ Triangle }) => {
      const obj = new Triangle({ left: 150, top: 150, width: 120, height: 100, fill: "#10b981", ...opts });
      fabricRef.current?.add(obj);
      fabricRef.current?.setActiveObject(obj);
      fabricRef.current?.renderAll();
    });
  }, []);

  const addPolygon = useCallback((sides: number, opts: Record<string, any> = {}) => {
    import("fabric").then(({ Polygon }) => {
      const r = 70;
      const pts = Array.from({ length: sides }, (_, i) => {
        const a = (2 * Math.PI * i) / sides - Math.PI / 2;
        return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) };
      });
      const obj = new Polygon(pts, { left: 150, top: 150, fill: "#8b5cf6", ...opts });
      fabricRef.current?.add(obj);
      fabricRef.current?.setActiveObject(obj);
      fabricRef.current?.renderAll();
    });
  }, []);

  const addStar = useCallback((points = 5, opts: Record<string, any> = {}) => {
    import("fabric").then(({ Polygon }) => {
      const outer = 70, inner = 30;
      const pts = Array.from({ length: points * 2 }, (_, i) => {
        const a = (Math.PI * i) / points - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        return { x: outer + r * Math.cos(a), y: outer + r * Math.sin(a) };
      });
      const obj = new Polygon(pts, { left: 150, top: 150, fill: "#f59e0b", ...opts });
      fabricRef.current?.add(obj);
      fabricRef.current?.setActiveObject(obj);
      fabricRef.current?.renderAll();
    });
  }, []);

  const addArrow = useCallback((opts: Record<string, any> = {}) => {
    import("fabric").then(({ Path }) => {
      const obj = new Path("M 0 25 L 110 25 L 110 10 L 140 40 L 110 70 L 110 55 L 0 55 Z", {
        left: 150, top: 150, fill: "#ef4444", ...opts,
      });
      fabricRef.current?.add(obj);
      fabricRef.current?.setActiveObject(obj);
      fabricRef.current?.renderAll();
    });
  }, []);

  const addLine = useCallback((opts: Record<string, any> = {}) => {
    import("fabric").then(({ Line }) => {
      const obj = new Line([0, 0, 220, 0], { stroke: "#334155", strokeWidth: 2, left: 100, top: 200, ...opts });
      fabricRef.current?.add(obj);
      fabricRef.current?.setActiveObject(obj);
      fabricRef.current?.renderAll();
    });
  }, []);

  const addImage = useCallback((url: string) => {
    import("fabric").then(({ FabricImage }) => {
      FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then((img: any) => {
        img.scaleToWidth(200);
        img.set({ left: 100, top: 100 });
        fabricRef.current?.add(img);
        fabricRef.current?.setActiveObject(img);
        fabricRef.current?.renderAll();
      });
    });
  }, []);

  const deleteSelected = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.getActiveObjects().forEach((o: any) => fc.remove(o));
    fc.discardActiveObject(); fc.renderAll();
  }, []);

  const bringForward  = useCallback(() => { fabricRef.current?.bringObjectForward(fabricRef.current.getActiveObject()); fabricRef.current?.renderAll(); }, []);
  const sendBackward  = useCallback(() => { fabricRef.current?.sendObjectBackwards(fabricRef.current.getActiveObject()); fabricRef.current?.renderAll(); }, []);
  const bringToFront  = useCallback(() => { fabricRef.current?.bringObjectToFront(fabricRef.current.getActiveObject()); fabricRef.current?.renderAll(); }, []);
  const sendToBack    = useCallback(() => { fabricRef.current?.sendObjectToBack(fabricRef.current.getActiveObject()); fabricRef.current?.renderAll(); }, []);

  const duplicateSelected = useCallback(() => {
    const fc = fabricRef.current;
    const obj = fc?.getActiveObject();
    if (!obj) return;
    obj.clone().then((clone: any) => {
      clone.set({ left: obj.left + 20, top: obj.top + 20 });
      fc!.add(clone); fc!.setActiveObject(clone); fc!.renderAll();
    });
  }, []);

  const groupSelected = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const objs = fc.getActiveObjects();
    if (objs.length < 2) return;
    import("fabric").then(({ Group }) => {
      const g = new Group(objs);
      objs.forEach((o: any) => fc.remove(o));
      fc.add(g); fc.setActiveObject(g); fc.renderAll();
    });
  }, []);

  const ungroupSelected = useCallback(() => {
    const fc = fabricRef.current;
    const obj = fc?.getActiveObject() as any;
    if (!fc || !obj || obj.type !== "group") return;
    const items = obj.getObjects();
    obj._restoreObjectsState();
    fc.remove(obj);
    items.forEach((item: any) => fc.add(item));
    fc.discardActiveObject(); fc.renderAll();
  }, []);

  const flipHorizontal = useCallback(() => {
    const obj = fabricRef.current?.getActiveObject() as any;
    if (!obj) return;
    obj.set({ flipX: !obj.flipX }); fabricRef.current?.renderAll();
  }, []);

  const flipVertical = useCallback(() => {
    const obj = fabricRef.current?.getActiveObject() as any;
    if (!obj) return;
    obj.set({ flipY: !obj.flipY }); fabricRef.current?.renderAll();
  }, []);

  const alignCenter = useCallback(() => {
    const fc = fabricRef.current;
    const obj = fc?.getActiveObject() as any;
    if (!fc || !obj) return;
    obj.set({ left: (fc.width - obj.getScaledWidth()) / 2 }); fc.renderAll();
  }, []);

  const alignMiddle = useCallback(() => {
    const fc = fabricRef.current;
    const obj = fc?.getActiveObject() as any;
    if (!fc || !obj) return;
    obj.set({ top: (fc.height - obj.getScaledHeight()) / 2 }); fc.renderAll();
  }, []);

  const undo = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc || histIdxRef.current <= 0) return;
    histIdxRef.current--;
    fc.loadFromJSON(JSON.parse(historyRef.current[histIdxRef.current]), () => {
      fc.renderAll();
      setCanUndo(histIdxRef.current > 0);
      setCanRedo(true);
    });
  }, []);

  const redo = useCallback(() => {
    const fc = fabricRef.current;
    const max = historyRef.current.length - 1;
    if (!fc || histIdxRef.current >= max) return;
    histIdxRef.current++;
    fc.loadFromJSON(JSON.parse(historyRef.current[histIdxRef.current]), () => {
      fc.renderAll();
      setCanUndo(true);
      setCanRedo(histIdxRef.current < max);
    });
  }, []);

  const setZoomLevel = useCallback((z: number) => {
    setZoom(z);
  }, []);

  const toJSON = useCallback(() => fabricRef.current?.toJSON(["data"]) ?? {}, []);

  /** Full multi-page JSON for saving */
  const toFullJSON = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return { version: "multi-page", pages: [] };
    const updatedPages = [...pages];
    if (updatedPages[currentPageIdx]) {
      updatedPages[currentPageIdx] = { ...updatedPages[currentPageIdx], json: fc.toJSON(["data"]) };
    }
    return { version: "multi-page", pages: updatedPages };
  }, [pages, currentPageIdx]);

  /** Load multi-page or legacy single-canvas JSON */
  const loadJSON = useCallback((json: Record<string, any>) => {
    if (json?.version === "multi-page" && Array.isArray(json.pages) && json.pages.length) {
      const loadedPages = json.pages as PageState[];
      setPages(loadedPages);
      setCurrentPageIdx(0);
      loadPageToCanvas(loadedPages[0]);
    } else {
      const fc = fabricRef.current;
      if (!fc) return;
      fc.loadFromJSON(sanitizeTemplateImages(json), () => fc.renderAll())
        .catch(() => fc.renderAll());
    }
  }, [loadPageToCanvas]);

  /** Load a template's canvas_json + reset pages to single page */
  const loadFromTemplateJson = useCallback((
    canvasJson: Record<string, any>,
    width: number,
    height: number,
    background = "#ffffff",
  ) => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.setDimensions({ width, height });
    fc.backgroundColor = background;
    if (canvasJson && Object.keys(canvasJson).length > 0) {
      fc.loadFromJSON(sanitizeTemplateImages(canvasJson), () => { fc.renderAll(); snapshot(); })
        .catch(() => { fc.renderAll(); snapshot(); });
    } else {
      fc.clear();
      fc.backgroundColor = background;
      fc.renderAll();
      snapshot();
    }
    const p: PageState = {
      id: Math.random().toString(36).slice(2, 10),
      json: canvasJson, width, height,
      orientation: width > height ? "landscape" : "portrait",
      margins: { ...DEFAULT_MARGINS }, background,
    };
    setCurrentPageSettings(p);
    setPages([p]);
    setCurrentPageIdx(0);
  }, [snapshot]);

  /** Kept for backward compat — just sets page size without hardcoded objects */
  const loadPreset = useCallback((templateId: string, category: string, pageSizeName = "A4") => {
    const size = PAGE_SIZES[pageSizeName] ?? PAGE_SIZES["A4"];
    const fc = fabricRef.current;
    if (!fc) return;
    fc.setDimensions({ width: size.width, height: size.height });
    fc.clear();
    fc.backgroundColor = "#ffffff";
    fc.renderAll();
    snapshot();
  }, [snapshot]);

  return {
    fabricCanvas: fabricRef.current,
    isReady,
    selectedObject,
    canUndo, canRedo,
    zoom,
    pages, currentPageIdx, currentPageSettings,
    pageSize: { width: currentPageSettings.width, height: currentPageSettings.height },
    // elements
    addText, addHeading, addRect, addCircle, addTriangle,
    addPolygon, addStar, addArrow, addLine, addImage,
    deleteSelected,
    bringForward, sendBackward, bringToFront, sendToBack,
    duplicateSelected, groupSelected, ungroupSelected,
    flipHorizontal, flipVertical, alignCenter, alignMiddle,
    // history
    undo, redo, snapshot,
    // zoom
    setZoomLevel,
    // serialization
    toJSON, toFullJSON, loadJSON, loadPreset, loadFromTemplateJson,
    // page management
    changePageSize, updatePageSettings, goToPage, addPage, removePage,
  };
}
