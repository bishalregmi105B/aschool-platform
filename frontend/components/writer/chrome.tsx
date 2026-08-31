"use client";

/**
 * Writer v2 — horizontal ruler (cm/inch ticks) and bottom status bar
 * (page x of y, word count, zoom slider).
 */
import React from "react";
import { ZoomIn } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { WordCounts } from "@/components/writer/context";
import type { WriterSettings } from "@/lib/writer/settings";

/** Horizontal ruler: cm ticks (major per cm) or inch ticks (major per inch). */
export function WriterRuler({
  settings, contentWidth, offsetPx, trailingPx,
}: {
  settings: WriterSettings;
  contentWidth: number;
  offsetPx: number;
  trailingPx: number;
}) {
  const tickStepPx = settings.rulerUnit === "cm" ? 96 / 2.54 / 2 : 48; // half-cm / half-inch
  const unitLenPx = settings.rulerUnit === "cm" ? 96 / 2.54 : 96; // 1cm / 1in in px
  const majorEvery = 2;
  const width = contentWidth + offsetPx + trailingPx;
  const ticks: { x: number; label: string | null }[] = [];
  let unitIndex = 0;
  for (let x = 0; x <= width; x += tickStepPx) {
    const inUnit = x >= offsetPx && x <= offsetPx + contentWidth;
    const isMajor = unitIndex % majorEvery === 0;
    let label: string | null = null;
    if (inUnit && isMajor) {
      const units = (x - offsetPx) / unitLenPx;
      const n = Math.round(units * 2) / 2;
      label = Number.isInteger(n) ? String(Math.round(n)) : null;
    }
    ticks.push({ x, label });
    unitIndex += 1;
  }
  return (
    <div className="relative h-6 bg-[#f7f9fc] select-none overflow-hidden" style={{ width }}>
      <div
        className="absolute top-0 bottom-0 bg-white/70 border-x border-slate-300"
        style={{ left: offsetPx, width: contentWidth }}
      />
      {ticks.map((t, i) => (
        <div key={i} className="absolute top-0 h-full pointer-events-none" style={{ left: t.x }}>
          <div className={t.label ? "w-px h-3 bg-slate-500" : "w-px h-2 bg-slate-400/70"} style={{ marginTop: t.label ? 0 : 4 }} />
          {t.label && (
            <span className="absolute top-2 -translate-x-1/2 text-[8px] text-slate-500">{t.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function StatusBar({
  counts, zoom, setZoom, dirty,
}: {
  counts: WordCounts;
  zoom: number;
  setZoom: (z: number) => void;
  dirty: boolean;
}) {
  return (
    <div className="h-7 shrink-0 flex items-center gap-4 px-3 border-t border-slate-300 bg-[#f0f3f8] text-[11px] text-slate-600">
      <span>Page <b>{counts.page}</b> of <b>{counts.pages}</b></span>
      <span className="text-slate-300">|</span>
      <span>{counts.words} words</span>
      <span className="text-slate-300">|</span>
      <span>{counts.chars} characters</span>
      {dirty && <span className="text-amber-600">● unsaved</span>}
      <div className="ml-auto flex items-center gap-2 w-56">
        <ZoomIn className="h-3.5 w-3.5 text-slate-500" />
        <Slider value={[zoom]} min={50} max={200} step={5} onValueChange={(v) => setZoom(v[0] ?? 100)} className="flex-1" />
        <span className="w-10 text-right">{Math.round(zoom)}%</span>
      </div>
    </div>
  );
}
