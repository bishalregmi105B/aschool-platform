"use client";

/**
 * useCanvas v2 — fabric.js multi-page canvas state manager (Canva-style).
 *
 * v2 upgrades over v1:
 *  - Real fabric viewport zoom (zoomToPoint + wheel) — replaces the CSS
 *    transform hack and fixes pointer coordinates at any zoom
 *  - Smart snapping to other objects + page edges/centers with pink guides
 *  - History via the zustand designer store: debounced snapshots that
 *    SURVIVE page switches and restore selection on undo/redo
 *  - Cross-page clipboard (copy/paste/duplicate via async clone)
 *  - Keyboard nudge, distribute, align, lock/hide, reorder APIs
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useDesignerStore, type HistoryEntry } from "../designer/store";
import { collectTargets, computeSnap, GuideRenderer } from "../designer/snapping";

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
  "ID Card Portrait": { width: 300, height: 480 },
  Letter:    { width: 816,  height: 1056 },
  Legal:     { width: 816,  height: 1344 },
  Custom:    { width: 794,  height: 1123 },
};

const DEFAULT_MARGINS: PageMargins = { top: 72, right: 72, bottom: 72, left: 72 };

/** fabric props carried through clone/paste/history — data keeps merge tokens */
const CUSTOM_PROPS = ["data", "name", "locked", "visibleToggle"];

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

export function useCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  overlayRef?: React.RefObject<HTMLCanvasElement>,
) {
  const fabricRef    = useRef<FabricCanvas>(null);
  const mountedRef   = useRef(false);
  const guideRef     = useRef<GuideRenderer | null>(null);
  const pagesRef     = useRef<PageState[]>([]);
  const pageIdxRef   = useRef(0);
  /** suppress history capture while undo/redo/template load is applying */
  const restoreRef   = useRef(false);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [pages, setPages]     = useState<PageState[]>([mkPage()]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [currentPageSettings, setCurrentPageSettings] = useState<PageState>(mkPage());

  const store = useDesignerStore;
  const zoom = store((s) => s.zoom);
  const setZoom = store((s) => s.setZoom);
  const setStoreDirty = store((s) => s.setDirty);

  pagesRef.current = pages;
  pageIdxRef.current = currentPageIdx;

  // ── history capture (debounced, store-based) ────────────────────
  const captureHistory = useCallback(() => {
    if (restoreRef.current) return;
    const fc = fabricRef.current;
    if (!fc) return;
    const entry: HistoryEntry = {
      doc: JSON.stringify({
        version: "multi-page",
        pages: pagesRef.current.map((p, i) =>
          i === pageIdxRef.current ? { ...p, json: fc.toJSON(CUSTOM_PROPS) } : p,
        ),
      }),
      pageIdx: pageIdxRef.current,
      selection: fc.getActiveObjects().map((o: any) => o.name ?? ""),
    };
    store.getState().pushHistory(entry);
    setStoreDirty(true);
  }, [store, setStoreDirty]);

  /** debounced snapshot — coalesces rapid changes (typing, sliders) */
  const snapshot = useCallback(() => {
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(captureHistory, 250);
  }, [captureHistory]);

  /** immediate snapshot for discrete actions (add/delete/page ops) */
  const snapshotNow = useCallback(() => {
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    captureHistory();
  }, [captureHistory]);

  // ── init canvas ─────────────────────────────────────────────────
  useEffect(() => {
    if (mountedRef.current || !canvasRef.current) return;
    mountedRef.current = true;
    let fc: FabricCanvas;

    if (overlayRef?.current) {
      guideRef.current = new GuideRenderer(overlayRef.current);
    }

    import("fabric").then(({ Canvas }) => {
      fc = new Canvas(canvasRef.current!, {
        backgroundColor: "#ffffff",
        width: 794, height: 1123,
        preserveObjectStacking: true,
        selection: true,
        stopContextMenu: true,
        fireRightClick: true,
      });
      fabricRef.current = fc;
      (window as any).__activeCanvas = fc;
      setIsReady(true);

      // ── smart snapping on drag (replaces the 5px grid) ──────────
      fc.on("object:moving", (e: any) => {
        if (!e.target || !store.getState().snapping) return;
        const targets = collectTargets(fc, e.target, fc.getZoom());
        const result = computeSnap(e.target, targets);
        guideRef.current?.draw(result.guidesV, result.guidesH);
      });
      const clearGuides = () => guideRef.current?.clear();
      fc.on("object:modified", clearGuides);
      fc.on("mouse:up", clearGuides);
      fc.on("selection:created", (e: any) => setSelectedObject(e.selected?.[0] ?? null));
      fc.on("selection:updated", (e: any) => setSelectedObject(e.selected?.[0] ?? null));
      fc.on("selection:cleared", ()       => setSelectedObject(null));
      fc.on("object:modified",   ()       => snapshot());
      fc.on("object:added",      ()       => snapshot());
      fc.on("object:removed",    ()       => snapshot());
      fc.on("text:changed",      ()       => snapshot());
      captureHistory();
    });

    return () => { if (fc) fc.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── viewport zoom (real fabric zoom — pointer-safe) ─────────────
  const zoomAt = useCallback((next: number, point?: { x: number; y: number }) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const z = Math.min(4, Math.max(0.2, next));
    import("fabric").then(({ Point }) => {
      const p = new Point(point?.x ?? fc.getWidth() / 2, point?.y ?? fc.getHeight() / 2);
      fc.zoomToPoint(p, z);
      fc.requestRenderAll();
      setZoom(z);
    });
  }, [setZoom]);

  const zoomToFit = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const wrap = fc.getElement()?.parentElement;
    if (!wrap) return;
    const availableW = wrap.clientWidth - 48;
    const availableH = wrap.clientHeight - 48;
    const z = Math.min(availableW / fc.getWidth(), availableH / fc.getHeight(), 1);
    // reset pan then fit
    fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
    zoomAt(z);
  }, [zoomAt]);

  // ── page helpers ────────────────────────────────────────────────
  const saveCurrentPageJSON = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const json = fc.toJSON(CUSTOM_PROPS);
    setPages(prev => {
      const u = [...prev];
      if (u[currentPageIdx]) u[currentPageIdx] = { ...u[currentPageIdx], json };
      return u;
    });
    return json;
  }, [currentPageIdx]);

  const loadPageToCanvas = useCallback((page: PageState, pageIdx = 0, allPages?: PageState[]) => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.setDimensions({ width: page.width, height: page.height });
    fc.backgroundColor = page.background ?? "#ffffff";
    if (page.json && Object.keys(page.json).length > 0) {
      fc.loadFromJSON(sanitizeTemplateImages(page.json), () => fc.requestRenderAll())
        .catch(() => fc.requestRenderAll());
    } else {
      fc.clear();
      fc.backgroundColor = page.background ?? "#ffffff";
      fc.requestRenderAll();
    }
    setCurrentPageSettings({ ...page });
    // pages state outside the current one come from allPages (undo/redo path)
    if (allPages) setPages(allPages);
    setCurrentPageIdx(pageIdx);
    // history baseline for the restored doc is pushed by the caller
  }, []);

  const goToPage = useCallback((idx: number) => {
    if (idx === pageIdxRef.current) return;
    saveCurrentPageJSON();
    setTimeout(() => {
      const target = pagesRef.current[idx];
      if (!target) return;
      setCurrentPageIdx(idx);
      loadPageToCanvas(target, idx);
    }, 40);
  }, [saveCurrentPageJSON, loadPageToCanvas]);

  const addPage = useCallback(() => {
    const json = saveCurrentPageJSON();
    const cur = pagesRef.current[pageIdxRef.current];
    const p: PageState = { ...mkPage(cur?.width, cur?.height) };
    if (cur) { p.margins = { ...cur.margins }; }
    const newPages = [...pagesRef.current];
    newPages[pageIdxRef.current] = { ...cur, json };
    newPages.splice(pageIdxRef.current + 1, 0, p);
    setPages(newPages);
    pagesRef.current = newPages;
    setCurrentPageIdx(pageIdxRef.current + 1);
    setTimeout(() => { loadPageToCanvas(p, pageIdxRef.current + 1); snapshotNow(); }, 40);
  }, [saveCurrentPageJSON, loadPageToCanvas, snapshotNow]);

  const duplicatePage = useCallback((idx = pageIdxRef.current) => {
    const src = idx === pageIdxRef.current
      ? { ...pagesRef.current[idx], json: saveCurrentPageJSON() }
      : pagesRef.current[idx];
    const p: PageState = {
      ...src,
      id: Math.random().toString(36).slice(2, 10),
      json: JSON.parse(JSON.stringify(src.json ?? {})),
      margins: { ...src.margins },
    };
    const newPages = [...pagesRef.current];
    newPages.splice(idx + 1, 0, p);
    setPages(newPages);
    pagesRef.current = newPages;
    setTimeout(() => { loadPageToCanvas(p, idx + 1); snapshotNow(); }, 40);
  }, [saveCurrentPageJSON, loadPageToCanvas, snapshotNow]);

  const removePage = useCallback((idx = pageIdxRef.current) => {
    if (pagesRef.current.length <= 1) return;
    const np = pagesRef.current.filter((_, i) => i !== idx);
    const ni = Math.min(pageIdxRef.current, np.length - 1);
    setPages(np);
    pagesRef.current = np;
    setTimeout(() => { loadPageToCanvas(np[ni], ni); snapshotNow(); }, 40);
  }, [loadPageToCanvas, snapshotNow]);

  const movePage = useCallback((from: number, to: number) => {
    const arr = [...pagesRef.current];
    const [p] = arr.splice(from, 1);
    arr.splice(to, 0, p);
    setPages(arr);
    pagesRef.current = arr;
    setCurrentPageIdx(to);
    setTimeout(() => { loadPageToCanvas(arr[to], to); snapshotNow(); }, 40);
  }, [loadPageToCanvas, snapshotNow]);

  const updatePageSettings = useCallback((settings: Partial<PageState>, applyToAll = false) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const cur = pagesRef.current[pageIdxRef.current];
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
    }
    fc.requestRenderAll();
    setCurrentPageSettings(merged);
    setPages(prev => {
      const u = [...prev];
      if (applyToAll) {
        return u.map(p => ({ ...p, background: merged.background, width: merged.width, height: merged.height, orientation: merged.orientation }));
      }
      u[pageIdxRef.current] = merged;
      return u;
    });
    snapshot();
  }, [snapshot]);

  const changePageSize = useCallback((sizeName: string, orientation?: "portrait" | "landscape") => {
    const size = PAGE_SIZES[sizeName] ?? PAGE_SIZES["A4"];
    const or = orientation ?? currentPageSettings.orientation;
    updatePageSettings({ width: size.width, height: size.height, orientation: or });
  }, [currentPageSettings.orientation, updatePageSettings]);

  // ── element operations ──────────────────────────────────────────
  const addObject = useCallback((obj: FabricObject) => {
    const fc = fabricRef.current;
    if (!fc) return;
    // name for layers panel + selection restore
    if (!obj.name) obj.name = `${obj.type ?? "object"}-${Math.random().toString(36).slice(2, 6)}`;
    fc.add(obj);
    fc.setActiveObject(obj);
    fc.requestRenderAll();
    snapshotNow();
  }, [snapshotNow]);

  const addText = useCallback((text = "Double-click to edit", opts: Record<string, any> = {}) => {
    import("fabric").then(({ Textbox }) => {
      addObject(new Textbox(text, {
        left: 100, top: 100, width: 300,
        fontSize: 18, fontFamily: "Arial", fill: "#1e293b",
        editable: true, lineHeight: 1.4, ...opts,
      }));
    });
  }, [addObject]);

  const addHeading = useCallback((level: 1 | 2 | 3 = 1) => {
    const sizes: Record<number, number> = { 1: 36, 2: 28, 3: 22 };
    addText("Heading", { fontSize: sizes[level], fontWeight: "bold" });
  }, [addText]);

  const addRect = useCallback((opts: Record<string, any> = {}) => {
    import("fabric").then(({ Rect }) => {
      addObject(new Rect({ left: 100, top: 100, width: 200, height: 120, fill: "#3b82f6", rx: 6, ry: 6, ...opts }));
    });
  }, [addObject]);

  const addCircle = useCallback((opts: Record<string, any> = {}) => {
    import("fabric").then(({ Circle }) => {
      addObject(new Circle({ left: 150, top: 150, radius: 60, fill: "#f59e0b", ...opts }));
    });
  }, [addObject]);

  const addTriangle = useCallback((opts: Record<string, any> = {}) => {
    import("fabric").then(({ Triangle }) => {
      addObject(new Triangle({ left: 150, top: 150, width: 120, height: 100, fill: "#10b981", ...opts }));
    });
  }, [addObject]);

  const addPolygon = useCallback((sides: number, opts: Record<string, any> = {}) => {
    import("fabric").then(({ Polygon }) => {
      const r = 70;
      const pts = Array.from({ length: sides }, (_, i) => {
        const a = (2 * Math.PI * i) / sides - Math.PI / 2;
        return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) };
      });
      addObject(new Polygon(pts, { left: 150, top: 150, fill: "#8b5cf6", ...opts }));
    });
  }, [addObject]);

  const addStar = useCallback((points = 5, opts: Record<string, any> = {}) => {
    import("fabric").then(({ Polygon }) => {
      const outer = 70, inner = 30;
      const pts = Array.from({ length: points * 2 }, (_, i) => {
        const a = (Math.PI * i) / points - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        return { x: outer + r * Math.cos(a), y: outer + r * Math.sin(a) };
      });
      addObject(new Polygon(pts, { left: 150, top: 150, fill: "#f59e0b", ...opts }));
    });
  }, [addObject]);

  const addArrow = useCallback((opts: Record<string, any> = {}) => {
    import("fabric").then(({ Path }) => {
      addObject(new Path("M 0 25 L 110 25 L 110 10 L 140 40 L 110 70 L 110 55 L 0 55 Z", {
        left: 150, top: 150, fill: "#ef4444", ...opts,
      }));
    });
  }, [addObject]);

  const addLine = useCallback((opts: Record<string, any> = {}) => {
    import("fabric").then(({ Line }) => {
      addObject(new Line([0, 0, 220, 0], { stroke: "#334155", strokeWidth: 2, left: 100, top: 200, ...opts }));
    });
  }, [addObject]);

  const addImage = useCallback((url: string) => {
    import("fabric").then(({ FabricImage }) => {
      FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then((img: any) => {
        img.scaleToWidth(200);
        img.set({ left: 100, top: 100 });
        addObject(img);
      }).catch(() => {});
    });
  }, [addObject]);

  /** Insert an SVG string (icon library) as a colorable group. */
  const addSVG = useCallback((svgString: string, opts: Record<string, any> = {}, color?: string) => {
    import("fabric").then(({ loadSVGFromString, Group }) => {
      // v6: loadSVGFromString returns a Promise<{objects, options}>
      Promise.resolve(loadSVGFromString(svgString)).then((res: any) => {
        const objects = res?.objects ?? res;
        if (!objects || !objects.length) return;
        const group = new Group(objects, { left: 150, top: 150, ...opts });
        if (color) {
          group.getObjects().forEach((o: any) => { if (o.fill !== "none") o.set({ fill: color }); });
        }
        (group as any).data = { ...(group as any).data, svg: svgString.slice(0, 10000) };
        addObject(group);
      }).catch(() => {});
    });
  }, [addObject]);

  /** Insert a QR code as an Image carrying data:{type:'qr', value} so bulk
   *  regeneration can re-encode per record (mirrors the server QR slot). */
  const addQR = useCallback((value: string, size = 120) => {
    import("qrcode").then((QR) => {
      QR.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
        .then((url: string) => {
          import("fabric").then(({ FabricImage }) => {
            FabricImage.fromURL(url).then((img: any) => {
              img.set({ left: 150, top: 150 });
              (img as any).data = { type: "qr", value };
              addObject(img);
            }).catch(() => {});
          });
        });
    });
  }, [addObject]);

  /** Diagonal watermark stamp across the page (tiled text at low opacity). */
  const addWatermark = useCallback((text = "DRAFT") => {
    import("fabric").then(({ Textbox }) => {
      const fc = fabricRef.current;
      if (!fc) return;
      const W = fc.getWidth() / fc.getZoom();
      const H = fc.getHeight() / fc.getZoom();
      const wm = new Textbox(text, {
        left: 0,
        top: H / 2 - 40,
        width: Math.max(W, H) * 1.2,
        fontSize: 64,
        fontFamily: "Arial",
        fontWeight: "bold",
        fill: "rgba(100,116,139,0.14)",
        textAlign: "center",
        angle: -28,
        selectable: true,
        evented: true,
        name: `watermark-${text.toLowerCase()}`,
      });
      (wm as any).data = { type: "watermark", text };
      fc.add(wm);
      fc.requestRenderAll();
      snapshotNow();
    });
  }, [addObject, snapshotNow]);

  const deleteSelected = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.getActiveObjects().forEach((o: any) => fc.remove(o));
    fc.discardActiveObject(); fc.requestRenderAll();
    snapshotNow();
  }, [snapshotNow]);

  // ── z-order ─────────────────────────────────────────────────────
  const withActive = (fn: (fc: FabricCanvas, obj: FabricObject) => void) => {
    const fc = fabricRef.current;
    const obj = fc?.getActiveObject();
    if (!fc || !obj) return;
    fn(fc, obj);
    fc.requestRenderAll();
    snapshotNow();
  };

  const bringForward  = useCallback(() => withActive((fc, obj) => fc.bringObjectForward(obj)), [snapshotNow]);
  const sendBackward  = useCallback(() => withActive((fc, obj) => fc.sendObjectBackwards(obj)), [snapshotNow]);
  const bringToFront  = useCallback(() => withActive((fc, obj) => fc.bringObjectToFront(obj)), [snapshotNow]);
  const sendToBack    = useCallback(() => withActive((fc, obj) => fc.sendObjectToBack(obj)), [snapshotNow]);
  /** move object to an exact z index (layers drag) */
  const setObjectZ = useCallback((objName: string, index: number) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const obj = fc.getObjects().find((o: any) => (o.name ?? "") === objName);
    if (!obj) return;
    fc.moveObjectTo(obj, index);
    fc.requestRenderAll();
    snapshotNow();
  }, [snapshotNow]);

  // ── clipboard ───────────────────────────────────────────────────
  const copySelected = useCallback(() => {
    const fc = fabricRef.current;
    const obj = fc?.getActiveObject();
    if (!fc || !obj) return;
    const objs = obj.type === "activeselection" ? obj.getObjects() : [obj];
    Promise.all(objs.map((o: any) => o.clone()))
      .then((clones: any[]) => store.getState().setClipboard(clones.map((c: any) => c.toObject(CUSTOM_PROPS))))
      .catch(() => {});
  }, [store]);

  const pasteClipboard = useCallback(() => {
    const fc = fabricRef.current;
    const clip = store.getState().clipboard;
    if (!fc || !clip?.length) return;
    import("fabric").then((fabric) => {
      fabric.util.enlivenObjects(clip as any[]).then((enlivened: any[]) => {
        enlivened.forEach((o: any) => {
          o.set({ left: (o.left ?? 0) + 20, top: (o.top ?? 0) + 20 });
          if (!o.name) o.name = `${o.type ?? "object"}-${Math.random().toString(36).slice(2, 6)}`;
          fc.add(o);
        });
        const sel = new fabric.ActiveSelection(enlivened, { canvas: fc });
        fc.setActiveObject(sel);
        fc.requestRenderAll();
        snapshotNow();
      }).catch(() => {});
    });
  }, [store, snapshotNow]);

  const duplicateSelected = useCallback(() => {
    copySelected();
    setTimeout(() => pasteClipboard(), 80);
  }, [copySelected, pasteClipboard]);

  // ── nudge (arrow keys) ──────────────────────────────────────────
  const nudgeSelected = useCallback((dx: number, dy: number) => {
    withActive((fc, obj) => {
      (obj.type === "activeselection" ? obj.getObjects() : [obj]).forEach((o: any) => {
        o.set({ left: o.left + dx, top: o.top + dy });
        o.setCoords();
      });
    });
  }, [snapshotNow]);

  // ── group / ungroup ─────────────────────────────────────────────
  const groupSelected = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const objs = fc.getActiveObjects();
    if (objs.length < 2) return;
    import("fabric").then(({ Group, ActiveSelection }) => {
      const g = new Group(objs);
      objs.forEach((o: any) => fc.remove(o));
      fc.add(g);
      const sel = new ActiveSelection([g], { canvas: fc });
      fc.setActiveObject(sel);
      fc.requestRenderAll();
      snapshotNow();
    });
  }, [snapshotNow]);

  const ungroupSelected = useCallback(() => {
    const fc = fabricRef.current;
    const obj = fc?.getActiveObject() as any;
    if (!fc || !obj || obj.type !== "group") return;
    const items = obj.removeAll();
    fc.remove(obj);
    items.forEach((item: any) => fc.add(item));
    fc.discardActiveObject();
    fc.requestRenderAll();
    snapshotNow();
  }, [snapshotNow]);

  // ── transforms ──────────────────────────────────────────────────
  const flipHorizontal = useCallback(() => withActive((_fc, obj) => obj.set({ flipX: !obj.flipX })), [snapshotNow]);
  const flipVertical   = useCallback(() => withActive((_fc, obj) => obj.set({ flipY: !obj.flipY })), [snapshotNow]);

  const align = useCallback((mode: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => {
    const fc = fabricRef.current;
    if (!fc) return;
    const active = fc.getActiveObject() as any;
    if (!active) return;
    const W = fc.getWidth() / fc.getZoom();
    const H = fc.getHeight() / fc.getZoom();
    const items = active.type === "activeselection" ? active.getObjects() : [active];
    const isMulti = items.length > 1;
    // For multi-select, align within the selection bounds; else to page
    const b0 = active.getBoundingRect(true, true);
    items.forEach((obj: any) => {
      const b = obj.getBoundingRect(true, true);
      const anchorSel = mode === "left" || mode === "right" ? b0.left : b0.top;
      const sizeSel = mode === "left" || mode === "right" ? b0.width : b0.height;
      if (mode === "left")        obj.set({ left: obj.left + ((isMulti ? anchorSel : 0) - b.left) });
      if (mode === "center-h")    obj.set({ left: obj.left + ((isMulti ? anchorSel + sizeSel / 2 : W / 2) - (b.left + b.width / 2)) });
      if (mode === "right")       obj.set({ left: obj.left + ((isMulti ? anchorSel + sizeSel : W) - (b.left + b.width)) });
      if (mode === "top")         obj.set({ top: obj.top + ((isMulti ? anchorSel : 0) - b.top) });
      if (mode === "center-v")    obj.set({ top: obj.top + ((isMulti ? anchorSel + sizeSel / 2 : H / 2) - (b.top + b.height / 2)) });
      if (mode === "bottom")      obj.set({ top: obj.top + ((isMulti ? anchorSel + sizeSel : H) - (b.top + b.height)) });
      obj.setCoords();
    });
    fc.requestRenderAll();
    snapshotNow();
  }, [snapshotNow]);

  const distribute = useCallback((axis: "h" | "v") => {
    const fc = fabricRef.current;
    const active = fc?.getActiveObject() as any;
    if (!fc || !active || active.type !== "activeselection") return;
    const items = [...active.getObjects()].sort((a: any, b: any) =>
      axis === "h" ? a.left - b.left : a.top - b.top);
    if (items.length < 3) return;
    const first = items[0], last = items[items.length - 1];
    const span = axis === "h" ? last.left - first.left : last.top - first.top;
    const step = span / (items.length - 1);
    items.forEach((obj: any, i: number) => {
      if (axis === "h") obj.set({ left: first.left + step * i });
      else obj.set({ top: first.top + step * i });
      obj.setCoords();
    });
    fc.requestRenderAll();
    snapshotNow();
  }, [snapshotNow]);

  // ── lock / hide ─────────────────────────────────────────────────
  const setLocked = useCallback((objName: string, locked: boolean) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const obj = fc.getObjects().find((o: any) => (o.name ?? "") === objName);
    if (!obj) return;
    obj.set({
      locked,
      lockMovementX: locked, lockMovementY: locked,
      lockScalingX: locked, lockScalingY: locked, lockRotation: locked,
      hasControls: !locked, selectable: true, evented: true,
    });
    fc.requestRenderAll();
    snapshot();
  }, [snapshot]);

  const toggleVisible = useCallback((objName: string) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const obj = fc.getObjects().find((o: any) => (o.name ?? "") === objName);
    if (!obj) return;
    obj.set({ visible: !obj.visible });
    fc.requestRenderAll();
    snapshot();
  }, [snapshot]);

  // ── history apply (undo/redo) ───────────────────────────────────
  const applyHistory = useCallback((direction: "undo" | "redo") => {
    const entry = store.getState()[direction]?.();
    if (!entry) return;
    restoreRef.current = true;
    try {
      const parsed = JSON.parse(entry.doc);
      const loadedPages: PageState[] = parsed.pages ?? [];
      const target = loadedPages[entry.pageIdx] ?? loadedPages[0];
      if (target) loadPageToCanvas(target, entry.pageIdx, loadedPages);
      // restore selection after load settles
      setTimeout(() => {
        const fc = fabricRef.current;
        if (fc && entry.selection?.length) {
          const objs = fc.getObjects().filter((o: any) => entry.selection.includes(o.name ?? ""));
          if (objs.length === 1) fc.setActiveObject(objs[0]);
          else if (objs.length > 1) {
            import("fabric").then(({ ActiveSelection }) => {
              fc.setActiveObject(new ActiveSelection(objs, { canvas: fc }));
              fc.requestRenderAll();
            });
          }
        }
        restoreRef.current = false;
      }, 120);
    } catch {
      restoreRef.current = false;
    }
  }, [store, loadPageToCanvas]);

  const undo = useCallback(() => applyHistory("undo"), [applyHistory]);
  const redo = useCallback(() => applyHistory("redo"), [applyHistory]);

  /** re-baseline history after template/doc loads */
  const resetHistory = useCallback(() => {
    store.getState().clearHistory();
    setTimeout(captureHistory, 120);
  }, [store, captureHistory]);

  // ── serialization ───────────────────────────────────────────────
  const toJSON = useCallback(() => fabricRef.current?.toJSON(CUSTOM_PROPS) ?? {}, []);

  const toFullJSON = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return { version: "multi-page", pages: [] };
    const updatedPages = [...pagesRef.current];
    if (updatedPages[pageIdxRef.current]) {
      updatedPages[pageIdxRef.current] = { ...updatedPages[pageIdxRef.current], json: fc.toJSON(CUSTOM_PROPS) };
    }
    return { version: "multi-page", pages: updatedPages };
  }, []);

  const loadJSON = useCallback((json: Record<string, any>) => {
    if (json?.version === "multi-page" && Array.isArray(json.pages) && json.pages.length) {
      const loadedPages = json.pages as PageState[];
      setPages(loadedPages);
      pagesRef.current = loadedPages;
      setCurrentPageIdx(0);
      loadPageToCanvas(loadedPages[0], 0);
      resetHistory();
    } else {
      const fc = fabricRef.current;
      if (!fc) return;
      fc.loadFromJSON(sanitizeTemplateImages(json), () => fc.requestRenderAll())
        .catch(() => fc.requestRenderAll());
    }
  }, [loadPageToCanvas, resetHistory]);

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
    const finish = () => { fc.requestRenderAll(); resetHistory(); };
    if (canvasJson && Object.keys(canvasJson).length > 0) {
      fc.loadFromJSON(sanitizeTemplateImages(canvasJson), finish)
        .catch(finish);
    } else {
      fc.clear();
      fc.backgroundColor = background;
      fc.requestRenderAll();
      resetHistory();
    }
    const p: PageState = {
      id: Math.random().toString(36).slice(2, 10),
      json: canvasJson, width, height,
      orientation: width > height ? "landscape" : "portrait",
      margins: { ...DEFAULT_MARGINS }, background,
    };
    setCurrentPageSettings(p);
    setPages([p]);
    pagesRef.current = [p];
    setCurrentPageIdx(0);
  }, [resetHistory]);

  /** Kept for backward compat — just sets page size without hardcoded objects */
  const loadPreset = useCallback((templateId: string, category: string, pageSizeName = "A4") => {
    const size = PAGE_SIZES[pageSizeName] ?? PAGE_SIZES["A4"];
    const fc = fabricRef.current;
    if (!fc) return;
    fc.setDimensions({ width: size.width, height: size.height });
    fc.clear();
    fc.backgroundColor = "#ffffff";
    fc.requestRenderAll();
    resetHistory();
  }, [resetHistory]);

  return {
    fabricCanvas: fabricRef.current,
    isReady,
    selectedObject,
    zoom,
    pages, currentPageIdx, currentPageSettings,
    pageSize: { width: currentPageSettings.width, height: currentPageSettings.height },
    // elements
    addText, addHeading, addRect, addCircle, addTriangle,
    addPolygon, addStar, addArrow, addLine, addImage, addSVG, addQR, addWatermark,
    deleteSelected,
    bringForward, sendBackward, bringToFront, sendToBack, setObjectZ,
    duplicateSelected, copySelected, pasteClipboard,
    groupSelected, ungroupSelected,
    flipHorizontal, flipVertical, align, distribute,
    nudgeSelected,
    setLocked, toggleVisible,
    // history
    undo, redo, snapshot: snapshotNow, resetHistory,
    // zoom
    zoomAt, zoomToFit, setZoomLevel: setZoom,
    // serialization
    toJSON, toFullJSON, loadJSON, loadPreset, loadFromTemplateJson,
    // page management
    changePageSize, updatePageSettings, goToPage, addPage, duplicatePage, removePage, movePage,
  };
}
