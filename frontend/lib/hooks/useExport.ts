"use client";

/**
 * useExport v2 — the designer export engine (client side).
 *
 *  - exportPNG / exportPDF / exportPagesZip accept a `dpiScale` (2×–5×) and an
 *    image `format` ("png" lossless | "jpeg" compact). 96dpi logical canvas ×
 *    3.125 = exactly 300 DPI on any paper size.
 *  - exportPagesZip: one high-res image per page, zipped (bulk / multi-page).
 *  - Cross-origin images are loaded with crossOrigin so toDataURL never
 *    taints; failures fall back to a drawn placeholder instead of blanking.
 *  - Browser canvas limits (max side / max area) are enforced by capping the
 *    effective multiplier, so huge A2/A0 exports can't silently render blank.
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

export type ExportFormat = "png" | "jpeg";

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

/** Canonical DPI presets (multiplier over the 96dpi logical px canvas).
 *  3.125× = exactly 300 DPI at any page size; 5× ≈ 480 DPI. */
export const EXPORT_SCALES = [
  { scale: 2, label: "2× — screen (192 DPI)" },
  { scale: 3.125, label: "3.125× — print 300 DPI" },
  { scale: 4, label: "4× — 384 DPI" },
  { scale: 5, label: "5× — ultra 480 DPI" },
] as const;

/** Conservative browser raster limits (Chrome: 268M px / 65535 px side). */
const MAX_CANVAS_SIDE = 32767;
const MAX_CANVAS_AREA = 240_000_000;

function capMultiplier(width: number, height: number, multiplier: number): number {
  const maxBySide = Math.min(MAX_CANVAS_SIDE / Math.max(1, width), MAX_CANVAS_SIDE / Math.max(1, height));
  const maxByArea = Math.sqrt(MAX_CANVAS_AREA / Math.max(1, width * height));
  return Math.max(0.5, Math.min(multiplier, maxBySide, maxByArea));
}

export function useExport() {
  const renderPageDataUrl = useCallback(async (
    page: ExportPage,
    multiplier = 3.125,
    format: ExportFormat = "png",
  ) => {
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
      const capped = capMultiplier(width, height, multiplier);
      dataUrl = canvas.toDataURL({
        format,
        multiplier: capped,
        ...(format === "jpeg" ? { quality: 0.92 } : {}),
      });
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
    dpiScale = 3.125,
    format: ExportFormat = "png",
  ) => {
    if (!fabricCanvas) return;
    const pages = Array.isArray(doc?.pages) ? doc.pages : [];
    if (pages.length > 1) {
      const renderedPages = await Promise.all(pages.map((page) => renderPageDataUrl(page, dpiScale, format)));
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
      const width = Math.max(...renderedPages.map((page) => Math.round(page.width * dpiScale)));
      const height = renderedPages.reduce((sum, page) => sum + Math.round(page.height * dpiScale), 0) + gap * (renderedPages.length - 1);
      const combined = document.createElement("canvas");
      combined.width = width;
      combined.height = height;

      const ctx = combined.getContext("2d");
      if (!ctx) return;

      let offsetY = 0;
      images.forEach((image, index) => {
        const pageWidth = Math.round(renderedPages[index].width * dpiScale);
        const pageHeight = Math.round(renderedPages[index].height * dpiScale);
        const offsetX = Math.max(0, Math.round((width - pageWidth) / 2));
        ctx.drawImage(image, offsetX, offsetY, pageWidth, pageHeight);
        offsetY += pageHeight + gap;
      });

      const link = document.createElement("a");
      link.download = filename;
      link.href = format === "jpeg"
        ? combined.toDataURL("image/jpeg", 0.92)
        : combined.toDataURL("image/png");
      link.click();
      return;
    }

    let dataURL: string;
    try {
      const liveW = Number(doc?.pages?.[0]?.width) || fabricCanvas.getWidth();
      const liveH = Number(doc?.pages?.[0]?.height) || fabricCanvas.getHeight();
      dataURL = fabricCanvas.toDataURL({
        format,
        multiplier: capMultiplier(liveW, liveH, dpiScale),
        ...(format === "jpeg" ? { quality: 0.92 } : {}),
      });
    } catch {
      throw new Error("Canvas has cross-origin images — use the server PDF export instead.");
    }
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataURL;
    link.click();
  }, [renderPageDataUrl]);

  /** One high-res image per page, zipped. */
  const exportPagesZip = useCallback(async (
    doc: { pages?: ExportPage[] },
    filename = "pages.zip",
    dpiScale = 3.125,
    nameFor?: (index: number, page: ExportPage) => string,
    format: ExportFormat = "png",
  ) => {
    const pages = Array.isArray(doc?.pages) ? doc.pages : [];
    if (!pages.length) throw new Error("No pages to export");
    const zip = new JSZip();
    for (let i = 0; i < pages.length; i++) {
      const { dataUrl } = await renderPageDataUrl(pages[i], dpiScale, format);
      if (!dataUrl) {
        throw new Error(`Page ${i + 1} could not be rasterized (cross-origin image). Use the server PDF export.`);
      }
      const base = nameFor?.(i, pages[i]) ?? `page_${String(i + 1).padStart(3, "0")}`;
      const ext = format === "jpeg" ? "jpg" : "png";
      zip.file(`${String(i + 1).padStart(3, "0")}_${base}.${ext}`, dataUrl.split(",")[1], { base64: true });
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
    dpiScale = 3.125,
    format: ExportFormat = "png",
  ) => {
    if (!fabricCanvas) return;
    const { jsPDF } = await import("jspdf");
    const pages = Array.isArray(doc?.pages) ? doc.pages : [];
    const pageList = pages.length > 0 ? pages : [{
      width: Number(doc?.pages?.[0]?.width) || fabricCanvas.getWidth(),
      height: Number(doc?.pages?.[0]?.height) || fabricCanvas.getHeight(),
      background: fabricCanvas.backgroundColor || "#ffffff",
      json: fabricCanvas.toJSON(["data"]),
    }];

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
        ? {
            dataUrl: fabricCanvas.toDataURL({
              format,
              multiplier: capMultiplier(Number(page.width) || fabricCanvas.getWidth(), Number(page.height) || fabricCanvas.getHeight(), dpiScale),
              ...(format === "jpeg" ? { quality: 0.92 } : {}),
            }),
            width: page.width || fabricCanvas.getWidth(),
            height: page.height || fabricCanvas.getHeight(),
          }
        : await renderPageDataUrl(page, dpiScale, format);
      if (!rendered.dataUrl) {
        throw new Error("A page could not be rasterized (cross-origin image). Use the server PDF export.");
      }
      const mmW = (rendered.width / 96) * 25.4;
      const mmH = (rendered.height / 96) * 25.4;
      const orientation = mmW > mmH ? "l" : "p";
      if (index > 0) {
        pdf.addPage([mmW, mmH], orientation);
      }
      pdf.addImage(rendered.dataUrl, format === "jpeg" ? "JPEG" : "PNG", 0, 0, mmW, mmH, undefined, "FAST");
    }

    pdf.save(filename);
  }, [renderPageDataUrl]);

  const exportPPTX = useCallback(
    (fabricCanvas: any, filename = "design.pptx", doc?: { pages?: PptxExportPage[] }, dpiScale = 2) =>
      exportPPTXImpl(fabricCanvas, filename, doc, dpiScale),
    [],
  );

  const exportSVG = useCallback(
    (fabricCanvas: any, filename = "design.svg", doc?: { pages?: PptxExportPage[] }) =>
      exportSVGImpl(fabricCanvas, filename, doc),
    [],
  );

  return { exportPNG, exportPDF, exportPagesZip, exportPPTX, exportSVG };
}

// ── PPTX (PowerPoint) export ─────────────────────────────────────────────────
// Each design page becomes one slide whose layout matches the page aspect
// exactly (96px = 1in); the page is rendered offscreen and embedded
// full-bleed so fonts, shadows, QRs and gradients appear exactly as
// designed regardless of the viewer's installed fonts.
type PptxExportPage = { width?: number; height?: number; background?: string; json?: Record<string, any> };

async function exportPPTXImpl(
  fabricCanvas: any,
  filename: string,
  doc?: { pages?: PptxExportPage[] },
  dpiScale = 2,
) {
  if (!fabricCanvas) return;
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pages = Array.isArray(doc?.pages) && doc.pages.length ? doc.pages : [{
    width: fabricCanvas.getWidth(),
    height: fabricCanvas.getHeight(),
    background: fabricCanvas.backgroundColor || "#ffffff",
    json: fabricCanvas.toJSON(["data"]),
  }];

  const pptx = new PptxGenJS();
  pptx.author = "ASchool Design Studio";
  pptx.company = "ASchool";

  for (const page of pages) {
    const w = Math.max(1, Number(page.width) || 794);
    const h = Math.max(1, Number(page.height) || 1123);
    const slide = pptx.addSlide();
    // slide dims in inches follow the page aspect (96px = 1in)
    pptx.defineLayout({ name: "PAGE", width: w / 96, height: h / 96 });
    slide.background = { color: (page.background || "#ffffff").replace("#", "") };
    const { Canvas } = await import("fabric");
    const offscreen = document.createElement("canvas");
    const canvas = new Canvas(offscreen, {
      backgroundColor: page.background || "#ffffff",
      width: w,
      height: h,
      preserveObjectStacking: true,
      selection: false,
    });
    await new Promise<void>((resolve) => {
      if (page.json && Object.keys(page.json).length > 0) {
        preloadCanvasImages(sanitizePageJson(page.json))
          .then((safe) => canvas.loadFromJSON(safe, () => { canvas.renderAll(); resolve(); }))
          .catch(() => { canvas.renderAll(); resolve(); });
      } else {
        canvas.renderAll();
        resolve();
      }
    });
    await new Promise((r) => setTimeout(r, 60));
    const multiplier = capMultiplier(w, h, dpiScale);
    const dataUrl = canvas.toDataURL({ format: "png", multiplier });
    canvas.dispose();
    if (dataUrl) {
      slide.addImage({ data: dataUrl, x: 0, y: 0, w: w / 96, h: h / 96 });
    }
  }
  await pptx.writeFile({ fileName: filename });
}

// ── SVG export (true vector) ─────────────────────────────────────────────────
// fabric v6 keeps a per-page virtual canvas; toSVG() yields editable vectors
// for shapes/text while embedded images stay as linked hrefs.
async function exportSVGImpl(
  fabricCanvas: any,
  filename: string,
  doc?: { pages?: PptxExportPage[] },
) {
  if (!fabricCanvas) return;
  const pages = Array.isArray(doc?.pages) && doc.pages.length ? doc.pages : null;
  if (pages && pages.length > 1) {
    const zip = new JSZip();
    for (let i = 0; i < pages.length; i++) {
      const svg = await renderPageSVG(pages[i]);
      zip.file(`${String(i + 1).padStart(3, "0")}_page.svg`, svg);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.svg$/i, ".zip");
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const svg = pages
    ? await renderPageSVG(pages[0])
    : fabricCanvas.toSVG();
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function renderPageSVG(page: PptxExportPage): Promise<string> {
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
      preloadCanvasImages(sanitizePageJson(page.json))
        .then((safe) => canvas.loadFromJSON(safe, () => { canvas.renderAll(); resolve(); }))
        .catch(() => { canvas.renderAll(); resolve(); });
    } else {
      canvas.renderAll();
      resolve();
    }
  });
  await new Promise((r) => setTimeout(r, 60));
  const svg = canvas.toSVG({
    width: `${width}`,
    height: `${height}`,
    viewBox: { x: 0, y: 0, width, height },
  });
  canvas.dispose();
  return svg;
}
