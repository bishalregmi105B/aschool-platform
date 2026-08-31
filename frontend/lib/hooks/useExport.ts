"use client";

/**
 * useExport — export the fabric.js canvas as PDF or PNG.
 * Uses jsPDF + html2canvas (PNG fallback) – fully client-side.
 */
import { useCallback } from "react";

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
        canvas.loadFromJSON(sanitizePageJson(page.json), () => {
          canvas.renderAll();
          resolve();
        }).catch(() => {
          canvas.renderAll();
          resolve();
        });
      } else {
        canvas.renderAll();
        resolve();
      }
    });

    const dataUrl = canvas.toDataURL({ format: "png", multiplier });
    canvas.dispose();
    return { dataUrl, width, height };
  }, []);

  const exportPNG = useCallback(async (fabricCanvas: any, filename = "design.png", doc?: { pages?: ExportPage[] }) => {
    if (!fabricCanvas) return;
    const pages = Array.isArray(doc?.pages) ? doc.pages : [];
    if (pages.length > 1) {
      const renderedPages = await Promise.all(pages.map((page) => renderPageDataUrl(page, 3)));
      const images = await Promise.all(renderedPages.map(({ dataUrl }) => new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      })));

      const gap = 24;
      const width = Math.max(...renderedPages.map((page) => page.width * 3));
      const height = renderedPages.reduce((sum, page) => sum + page.height * 3, 0) + gap * (renderedPages.length - 1);
      const combined = document.createElement("canvas");
      combined.width = width;
      combined.height = height;

      const ctx = combined.getContext("2d");
      if (!ctx) return;

      let offsetY = 0;
      images.forEach((image, index) => {
        const pageWidth = renderedPages[index].width * 3;
        const pageHeight = renderedPages[index].height * 3;
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

    const dataURL = fabricCanvas.toDataURL({ format: "png", multiplier: 3 });
    const link    = document.createElement("a");
    link.download = filename;
    link.href     = dataURL;
    link.click();
  }, [renderPageDataUrl]);

  const exportPDF = useCallback(async (fabricCanvas: any, filename = "design.pdf", doc?: { pages?: ExportPage[] }) => {
    if (!fabricCanvas) return;
    const { jsPDF }  = await import("jspdf");
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
        ? { dataUrl: fabricCanvas.toDataURL({ format: "png", multiplier: 3 }), width: page.width || fabricCanvas.getWidth(), height: page.height || fabricCanvas.getHeight() }
        : await renderPageDataUrl(page, 3);
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

  return { exportPNG, exportPDF };
}
