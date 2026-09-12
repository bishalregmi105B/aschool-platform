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
    <div className="relative h-6 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 select-none overflow-hidden" style={{ width }}>
      <div
        className="absolute top-0 bottom-0 bg-white/90 dark:bg-slate-800/90 border-x border-slate-300 dark:border-slate-700"
        style={{ left: offsetPx, width: contentWidth }}
      />
      {ticks.map((t, i) => (
        <div key={i} className="absolute top-0 h-full pointer-events-none" style={{ left: t.x }}>
          <div className={t.label ? "w-px h-3 bg-slate-400 dark:bg-slate-500" : "w-px h-2 bg-slate-300 dark:bg-slate-600"} style={{ marginTop: t.label ? 0 : 4 }} />
          {t.label && (
            <span className="absolute top-2 -translate-x-1/2 text-[8px] font-medium text-slate-500 dark:text-slate-400">{t.label}</span>
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
    <div className="h-7 shrink-0 flex items-center gap-3 px-3 border-t border-slate-200 dark:border-slate-800 bg-[#0078d4] text-white text-[11px] select-none font-medium">
      <div className="flex items-center gap-1.5">
        <span>Page</span>
        <span className="font-bold">{counts.page}</span>
        <span>of</span>
        <span className="font-bold">{counts.pages}</span>
      </div>
      <span className="opacity-40">|</span>
      <span>{counts.words} words</span>
      <span className="opacity-40">|</span>
      <span>{counts.chars} characters</span>
      {dirty ? (
        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-400/30 text-amber-200 text-[10px] flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" /> Unsaved changes
        </span>
      ) : (
        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/10 text-white/90 text-[10px]">
          Saved to cloud
        </span>
      )}
      <div className="ml-auto flex items-center gap-2 w-52">
        <ZoomIn className="h-3.5 w-3.5 opacity-80" />
        <Slider value={[zoom]} min={50} max={200} step={5} onValueChange={(v) => setZoom(v[0] ?? 100)} className="flex-1 [&_[role=slider]]:bg-white [&_[role=slider]]:border-[#0078d4]" />
        <span className="w-9 text-right font-mono font-semibold text-[10px]">{Math.round(zoom)}%</span>
      </div>
    </div>
  );
}
