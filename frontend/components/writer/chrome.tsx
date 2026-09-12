"use client";

/**
 * Writer v2 — horizontal ruler (cm/inch ticks) and bottom status bar
 * (page x of y, word count, zoom slider).
 *
 * Skinned entirely with 11.css (Win11 Fluent) tokens so both the AOS light
 * and dark themes render correctly — no hardcoded surfaces or text colors.
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
    <div
      className="relative h-6 select-none overflow-hidden border-b"
      style={{
        width,
        background: "var(--w11-control-bg)",
        borderBottomColor: "var(--w11-border-default)",
      }}
    >
      {/* content span — the writable page width between the margins */}
      <div
        className="absolute top-0 bottom-0 border-x"
        style={{
          left: offsetPx,
          width: contentWidth,
          background: "var(--w11-surface-solid)",
          borderColor: "var(--w11-border-default)",
        }}
      />
      {ticks.map((t, i) => (
        <div key={i} className="absolute top-0 h-full pointer-events-none" style={{ left: t.x }}>
          <div
            className="w-px h-3"
            style={{ background: t.label ? "var(--w11-border-strong)" : "var(--w11-border-default)", marginTop: t.label ? 0 : 4 }}
          />
          {t.label && (
            <span className="absolute top-2 -translate-x-1/2 text-[8px] font-medium" style={{ color: "var(--w11-text-tertiary)" }}>
              {t.label}
            </span>
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
    <div
      className="h-7 shrink-0 flex items-center gap-3 px-3 border-t text-[11px] select-none font-medium"
      style={{
        background: "var(--w11-surface-solid)",
        borderColor: "var(--w11-border-default)",
        color: "var(--w11-text-secondary)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <span>Page</span>
        <span className="font-bold" style={{ color: "var(--w11-text-primary)" }}>{counts.page}</span>
        <span>of</span>
        <span className="font-bold" style={{ color: "var(--w11-text-primary)" }}>{counts.pages}</span>
      </div>
      <span style={{ color: "var(--w11-text-tertiary)" }}>|</span>
      <span>{counts.words} words</span>
      <span style={{ color: "var(--w11-text-tertiary)" }}>|</span>
      <span>{counts.chars} characters</span>
      {dirty ? (
        <span
          className="ml-2 px-1.5 py-0.5 rounded-[var(--w11-radius-full)] text-[10px] flex items-center gap-1 font-semibold"
          style={{ background: "rgba(217,119,6,0.16)", color: "#d97706" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Unsaved changes
        </span>
      ) : (
        <span
          className="ml-2 px-1.5 py-0.5 rounded-[var(--w11-radius-full)] text-[10px]"
          style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}
        >
          Saved to cloud
        </span>
      )}
      <div className="ml-auto flex items-center gap-2 w-52">
        <ZoomIn className="h-3.5 w-3.5" style={{ color: "var(--w11-text-tertiary)" }} />
        {/* base Slider is already token-driven (accent thumb, token track) */}
        <Slider value={[zoom]} min={50} max={200} step={5} onValueChange={(v) => setZoom(v[0] ?? 100)} className="flex-1" />
        <span className="w-9 text-right font-mono font-semibold text-[10px]" style={{ color: "var(--w11-text-primary)" }}>
          {Math.round(zoom)}%
        </span>
      </div>
    </div>
  );
}
