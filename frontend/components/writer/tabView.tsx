"use client";

/**
 * View tab — zoom (slider 50–200%), ruler toggle (cm/inch), focus mode,
 * spell-check quick toggle and ribbon collapse.
 */
import React from "react";
import {
  ZoomIn, Ruler as RulerIcon, Focus, Moon, PanelTopClose, Percent,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { RibbonGroup, RBtn, BtnCol } from "@/components/writer/ribbon";
import type { WriterCtx } from "@/components/writer/context";
import { Button } from "@/components/ui/button";

export function ViewTab({ ctx }: { ctx: WriterCtx }) {
  const { settings, update, zoom, setZoom } = ctx;

  return (
    <>
      {/* Zoom */}
      <RibbonGroup label="Zoom" className="min-w-[200px]">
        <div className="flex flex-col justify-center gap-1 h-[52px] w-[200px]">
          <div className="flex items-center gap-2">
            <ZoomIn className="h-3.5 w-3.5 text-slate-500" />
            <Slider
              value={[zoom]}
              min={50}
              max={200}
              step={5}
              onValueChange={(v) => setZoom(v[0] ?? 100)}
              className="flex-1"
            />
            <span className="text-[11px] w-10 text-right text-slate-600">{Math.round(zoom)}%</span>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => setZoom(100)}>100%</Button>
            <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => setZoom(Math.min(200, zoom + 10))}>+10</Button>
            <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => setZoom(Math.max(50, zoom - 10))}>−10</Button>
            <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => setZoom(130)}>Fit width</Button>
          </div>
        </div>
      </RibbonGroup>

      {/* Show */}
      <RibbonGroup label="Show">
        <BtnCol>
          <RBtn
            icon={<RulerIcon className="h-4 w-4" />}
            label={settings.ruler ? "Ruler On" : "Ruler Off"}
            title="Toggle the horizontal ruler"
            wide
            active={settings.ruler}
            onClick={() => update({ ruler: !settings.ruler })}
          />
          <div className="flex gap-0.5">
            <RBtn icon={<Percent className="h-3.5 w-3.5" />} title="Ruler in centimeters" active={settings.rulerUnit === "cm"} onClick={() => update({ rulerUnit: "cm" })} />
            <RBtn icon={<span className="text-[10px] font-semibold">in</span>} title="Ruler in inches" active={settings.rulerUnit === "in"} onClick={() => update({ rulerUnit: "in" })} />
          </div>
        </BtnCol>
        <BtnCol>
          <RBtn
            icon={<Moon className="h-4 w-4" />}
            label={settings.darkPageBorder ? "Border On" : "Border Off"}
            title="Dark page border"
            wide
            active={settings.darkPageBorder}
            onClick={() => update({ darkPageBorder: !settings.darkPageBorder })}
          />
          <RBtn
            icon={<Focus className="h-4 w-4" />}
            label="Focus"
            title="Focus mode — hide the ribbon and chrome (Esc to exit)"
            wide
            active={ctx.focusMode}
            onClick={() => ctx.setFocusMode(!ctx.focusMode)}
          />
        </BtnCol>
      </RibbonGroup>

      {/* Window */}
      <RibbonGroup label="Window">
        <RBtn
          icon={<PanelTopClose className="h-4 w-4" />}
          label="Collapse Ribbon"
          title="Collapse the ribbon (double-click a tab to restore)"
          wide
          onClick={() => ctx.toggleRibbon()}
        />
      </RibbonGroup>
    </>
  );
}
