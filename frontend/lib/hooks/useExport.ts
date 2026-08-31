"use client";

/**
 * useExport v2 — the designer export engine (client side).
 *
 *  - exportPNG / exportPDF accept a `dpiScale` (2×–5×). At 3× an A4 page is
 *    exactly 300 DPI; 5× ≈ 4960px wide (beyond 4K) for ID cards etc.
 *  - exportPagesZip: one high-res PNG per page, zipped (bulk / multi-page).
 *  - Cross-origin images are loaded with crossOrigin so toDataURL never
 *    taints; failures fall back to a drawn placeholder instead of blanking.
 */
import { useCallback } from "react";
import JSZip from "jszip";
import { preloadCanvasImages } from "../designer/canvasImages";

type ExportPage = {
  json?: Record<string, any>;
  width?: number;
  height?: number;
  background?: string;
};

/** Same guard as useCanvas.sanitizeTemplateImages — a token/relative image src
 *  would make fabric v6 loadFromJSON reject and hang the export. */
function sanitizePageJson(json: Record<string, any>): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(json ?? {}));
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v1\/?$/, "");
  const walk = (obj: Record<string, any>) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    if (obj.type?.toLowerCase() === "image") {
      if (typeof obj.src !== "string" || obj.src.includes("{") || obj.src === "") {
        obj.src = "";
        obj.srcOrigin = null;
      } else if (obj.src.startsWith("/")) {
        obj.src = `${apiBase || window.location.origin}${obj.src}`;
      }
    }
    Object.values(obj).forEach(walk);
  };
  walk(clone);
  return clone;
}

/** Canonical DPI presets (multiplier over the 96dpi logical px canvas). */
export const EXPORT_SCALES = [
  { scale: 2, label: "2× — screen (192 DPI)" },
  { scale: 3, label: "3× — print 300 DPI" },
  { scale: 4, label: "4× — 400 DPI" },
  { scale: 5, label: "5× — ultra (~4K+)" },
] as const;

export function useExport() {
  const renderPageDataUrl = useCallback(async (page: ExportPage, multiplier = 3) => {
    const { Canvas } = await import("fabric");
    const offscreen = document.createElement("canvas");
    const width = Math.max(1, Number(page.width || 794));
    const height = Math.max(1, Number(page.height || 1123));
    const canvas = new Canvas(offscreen, {
      backgroundColor: page.background || "#ffffff",
      width,
      height,
      preserveObjectStacking: true,
      selection: false,
    });

    await new Promise<void>((resolve) => {
      if (page.json && Object.keys(page.json).length > 0) {
        // sanitize strips token srcs; preload converts every image to a
        // data-URI so a single 404 photo can't blank the whole export
        preloadCanvasImages(sanitizePageJson(page.json))
          .then((safe) => canvas.loadFromJSON(safe, () => { canvas.renderAll(); resolve(); }))
          .catch(() => { canvas.renderAll(); resolve(); });
      } else {
        canvas.renderAll();
        resolve();
      }
    });

    // give async images one extra beat to decode before rasterizing
    await new Promise((r) => setTimeout(r, 60));

    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL({ format: "png", multiplier });
    } catch {
      // tainted canvas (a cross-origin image without CORS) — report, don't hang
      dataUrl = "";
    }
    canvas.dispose();
    return { dataUrl, width, height };
  }, []);

  const exportPNG = useCallback(async (
    fabricCanvas: any,
    filename = "design.png",
    doc?: { pages?: ExportPage[] },
    dpiScale = 3,
  ) => {
    if (!fabricCanvas) return;
    const pages = Array.isArray(doc?.pages) ? doc.pages : [];
    if (pages.length > 1) {
      const renderedPages = await Promise.all(pages.map((page) => renderPageDataUrl(page, dpiScale)));
      if (renderedPages.some((p) => !p.dataUrl)) {
        throw new Error("A page could not be rasterized (cross-origin image). Use the server PDF export.");
      }
      const images = await Promise.all(renderedPages.map(({ dataUrl }) => new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      })));

      const gap = 24;
      const width = Math.max(...renderedPages.map((page) => page.width * dpiScale));
      const height = renderedPages.reduce((sum, page) => sum + page.height * dpiScale, 0) + gap * (renderedPages.length - 1);
      const combined = document.createElement("canvas");
      combined.width = width;
      combined.height = height;

      const ctx = combined.getContext("2d");
      if (!ctx) return;

      let offsetY = 0;
      images.forEach((image, index) => {
        const pageWidth = renderedPages[index].width * dpiScale;
        const pageHeight = renderedPages[index].height * dpiScale;
        const offsetX = Math.max(0, Math.round((width - pageWidth) / 2));
        ctx.drawImage(image, offsetX, offsetY, pageWidth, pageHeight);
        offsetY += pageHeight + gap;
      });

      const link = document.createElement("a");
      link.download = filename;
      link.href = combined.toDataURL("image/png");
      link.click();
      return;
    }

    let dataURL: string;
    try {
      dataURL = fabricCanvas.toDataURL({ format: "png", multiplier: dpiScale });
    } catch {
      throw new Error("Canvas has cross-origin images — use the server PDF export instead.");
    }
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataURL;
    link.click();
  }, [renderPageDataUrl]);

  /** One high-res PNG per page, zipped. */
  const exportPagesZip = useCallback(async (
    doc: { pages?: ExportPage[] },
    filename = "pages.zip",
    dpiScale = 3,
    nameFor?: (index: number, page: ExportPage) => string,
  ) => {
    const pages = Array.isArray(doc?.pages) ? doc.pages : [];
    if (!pages.length) throw new Error("No pages to export");
    const zip = new JSZip();
    for (let i = 0; i < pages.length; i++) {
      const { dataUrl } = await renderPageDataUrl(pages[i], dpiScale);
      if (!dataUrl) {
        throw new Error(`Page ${i + 1} could not be rasterized (cross-origin image). Use the server PDF export.`);
      }
      const base = nameFor?.(i, pages[i]) ?? `page_${String(i + 1).padStart(3, "0")}`;
      zip.file(`${String(i + 1).padStart(3, "0")}_${base}.png`, dataUrl.split(",")[1], { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [renderPageDataUrl]);

  const exportPDF = useCallback(async (
    fabricCanvas: any,
    filename = "design.pdf",
    doc?: { pages?: ExportPage[] },
    dpiScale = 3,
  ) => {
    if (!fabricCanvas) return;
    const { jsPDF } = await import("jspdf");
    const pages = Array.isArray(doc?.pages) ? doc.pages : [];
    const pageList = pages.length > 0 ? pages : [{ width: fabricCanvas.getWidth(), height: fabricCanvas.getHeight(), background: fabricCanvas.backgroundColor || "#ffffff", json: fabricCanvas.toJSON(["data"]) }];

    const firstPage = pageList[0];
    const firstWidth = firstPage.width || fabricCanvas.getWidth();
    const firstHeight = firstPage.height || fabricCanvas.getHeight();
    const firstMmW = (firstWidth / 96) * 25.4;
    const firstMmH = (firstHeight / 96) * 25.4;
    const firstOrientation = firstMmW > firstMmH ? "l" : "p";
    const pdf = new jsPDF({ orientation: firstOrientation, unit: "mm", format: [firstMmW, firstMmH] });

    for (let index = 0; index < pageList.length; index += 1) {
      const page = pageList[index];
      const rendered = index === 0 && pageList.length === 1 && fabricCanvas.toDataURL
        ? { dataUrl: fabricCanvas.toDataURL({ format: "png", multiplier: dpiScale }), width: page.width || fabricCanvas.getWidth(), height: page.height || fabricCanvas.getHeight() }
        : await renderPageDataUrl(page, dpiScale);
      if (!rendered.dataUrl) {
        throw new Error("A page could not be rasterized (cross-origin image). Use the server PDF export.");
      }
      const mmW = (rendered.width / 96) * 25.4;
      const mmH = (rendered.height / 96) * 25.4;
      const orientation = mmW > mmH ? "l" : "p";
      if (index > 0) {
        pdf.addPage([mmW, mmH], orientation);
      }
      pdf.addImage(rendered.dataUrl, "PNG", 0, 0, mmW, mmH);
    }

    pdf.save(filename);
  }, [renderPageDataUrl]);

  return { exportPNG, exportPDF, exportPagesZip };
}
