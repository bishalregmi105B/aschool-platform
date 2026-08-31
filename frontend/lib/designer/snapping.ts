"use client";

/**
 * snapping — Canva-style alignment guides + smart snapping for fabric v6.
 *
 * Pattern (grounded in lagardess/fabric-js-guides + vue-fabric-editor):
 * during `object:moving`, compare the moving object's edge/center points with
 * every other object's + the page's; when within threshold, snap and draw
 * guide lines on an overlay canvas (NOT fabric objects — zero interference
 * with serialization/undo). Guides are cleared on release.
 */

export interface SnapTarget {
  /** x positions to match (object edges + centers), with the y-range they span */
  xs: Array<{ pos: number; from: number; to: number }>;
  ys: Array<{ pos: number; from: number; to: number }>;
  /** page dimensions */
  width: number;
  height: number;
}

export interface SnapResult {
  left?: number;
  top?: number;
  /** vertical guide lines to draw: {x, from, to} in canvas coords */
  guidesV: Array<{ x: number; from: number; to: number }>;
  /** horizontal guide lines: {y, from, to} */
  guidesH: Array<{ y: number; from: number; to: number }>;
}

const THRESHOLD = 6;

/** Collect snap points for all objects except the moving one + guides. */
export function collectTargets(
  canvas: any,
  moving: any,
  zoom: number,
): SnapTarget {
  const xs: SnapTarget["xs"] = [];
  const ys: SnapTarget["ys"] = [];
  const width = canvas.getWidth() / zoom;
  const height = canvas.getHeight() / zoom;

  // page center + edges
  xs.push({ pos: 0, from: 0, to: height }, { pos: width / 2, from: 0, to: height }, { pos: width, from: 0, to: height });
  ys.push({ pos: 0, from: 0, to: width }, { pos: height / 2, from: 0, to: width }, { pos: height, from: 0, to: width });

  const excluded = new Set<any>([moving]);
  const active = canvas.getActiveObject?.();
  if (active?.type === "activeselection") {
    (active.getObjects?.() ?? []).forEach((o: any) => excluded.add(o));
  }
  canvas.getObjects().forEach((obj: any) => {
    if (excluded.has(obj) || obj.guideline || !obj.visible) return;
    const b = obj.getBoundingRect(true, true); // absolute, pre-zoom
    xs.push({ pos: b.left, from: b.top, to: b.top + b.height });
    xs.push({ pos: b.left + b.width / 2, from: b.top, to: b.top + b.height });
    xs.push({ pos: b.left + b.width, from: b.top, to: b.top + b.height });
    ys.push({ pos: b.top, from: b.left, to: b.left + b.width });
    ys.push({ pos: b.top + b.height / 2, from: b.left, to: b.left + b.width });
    ys.push({ pos: b.top + b.height, from: b.left, to: b.left + b.width });
  });
  return { xs, ys, width, height };
}

/**
 * Compute snapped left/top for the moving object.
 * `obj` must already be positioned at its candidate (dragged) position.
 */
export function computeSnap(obj: any, targets: SnapTarget, threshold = THRESHOLD): SnapResult {
  const b = obj.getBoundingRect(true, true);
  const objXs = [b.left, b.left + b.width / 2, b.left + b.width];
  const objYs = [b.top, b.top + b.height / 2, b.top + b.height];

  const guidesV: SnapResult["guidesV"] = [];
  const guidesH: SnapResult["guidesH"] = [];

  let bestX: { delta: number; snapTo: number; guide: { x: number; from: number; to: number } } | null = null;
  for (const ox of objXs) {
    for (const t of targets.xs) {
      const delta = t.pos - ox;
      if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
        bestX = { delta, snapTo: t.pos, guide: { x: t.pos, from: t.from, to: t.to } };
      }
    }
  }
  let bestY: { delta: number; snapTo: number; guide: { y: number; from: number; to: number } } | null = null;
  for (const oy of objYs) {
    for (const t of targets.ys) {
      const delta = t.pos - oy;
      if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
        bestY = { delta, snapTo: t.pos, guide: { y: t.pos, from: t.from, to: t.to } };
      }
    }
  }

  // resolve relative to the object's current frame (fabric moves via left/top
  // of the origin corner; bounding rect handles rotation/origin for us)
  if (bestX) {
    obj.set({ left: obj.left + bestX.delta });
    guidesV.push(bestX.guide);
  }
  if (bestY) {
    obj.set({ top: obj.top + bestY.delta });
    guidesH.push(bestY.guide);
  }
  return { left: obj.left, top: obj.top, guidesV, guidesH };
}

/** Overlay-canvas guide renderer. `overlay` is a plain <canvas> positioned over the fabric canvas at natural (unzoomed) page size; it is CSS-scaled with the page. */
export class GuideRenderer {
  private ctx: CanvasRenderingContext2D | null;

  constructor(private overlay: HTMLCanvasElement) {
    this.ctx = overlay.getContext("2d");
  }

  draw(guidesV: SnapResult["guidesV"], guidesH: SnapResult["guidesH"]) {
    const { overlay, ctx } = this;
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.strokeStyle = "#ec4899"; // canva pink
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const g of guidesV) {
      ctx.beginPath();
      ctx.moveTo(g.x + 0.5, Math.max(0, g.from));
      ctx.lineTo(g.x + 0.5, g.to);
      ctx.stroke();
    }
    for (const g of guidesH) {
      ctx.beginPath();
      ctx.moveTo(Math.max(0, g.from), g.y + 0.5);
      ctx.lineTo(g.to, g.y + 0.5);
      ctx.stroke();
    }
  }

  clear() {
    const { overlay, ctx } = this;
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }
}
