"use client";

/**
 * Layout tab — page setup: size, orientation, margins (presets + custom),
 * columns (1/2/3 with divider + spacing) and line numbers.
 */
import React, { useState } from "react";
import {
  FileText, Square, Columns2, Columns3, Ruler as RulerIcon, ListOrdered,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RibbonGroup, RBtn, BtnCol } from "@/components/writer/ribbon";
import type { WriterCtx } from "@/components/writer/context";
import {
  PAGE_SIZES, MARGIN_PRESETS, marginsToPreset, MM_TO_PX,
} from "@/lib/writer/settings";
import type { PageId } from "@/lib/writer/settings";

function MarginsCustomDialog({
  ctx, open, onClose,
}: {
  ctx: WriterCtx;
  open: boolean;
  onClose: () => void;
}) {
  const mm = (px: number) => Math.round((px / MM_TO_PX) * 10) / 10;
  const [vals, setVals] = useState({
    top: mm(ctx.settings.marginTop),
    right: mm(ctx.settings.marginRight),
    bottom: mm(ctx.settings.marginBottom),
    left: mm(ctx.settings.marginLeft),
  });
  const apply = () => {
    ctx.update({
      marginTop: Math.round(vals.top * MM_TO_PX),
      marginRight: Math.round(vals.right * MM_TO_PX),
      marginBottom: Math.round(vals.bottom * MM_TO_PX),
      marginLeft: Math.round(vals.left * MM_TO_PX),
    });
    onClose();
  };
  const fields = ["top", "right", "bottom", "left"] as const;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>Custom margins (mm)</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-1">
          {fields.map((f) => (
            <div key={f}>
              <Label className="text-[10px] capitalize">{f}</Label>
              <Input
                type="number" min={5} max={120} step={0.5}
                value={vals[f]}
                onChange={(e) => setVals({ ...vals, [f]: Number(e.target.value) })}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={apply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LayoutTab({ ctx }: { ctx: WriterCtx }) {
  const { settings, update } = ctx;
  const [marginsOpen, setMarginsOpen] = useState(false);
  const preset = marginsToPreset(settings);

  const columnsBtn = (n: number, icon: React.ReactNode, label: string) => (
    <RBtn icon={icon} label={label} title={`${n} column${n > 1 ? "s" : ""}`} wide active={settings.columns === n} onClick={() => update({ columns: n })} />
  );

  return (
    <>
      {/* Page Setup */}
      <RibbonGroup label="Page Setup">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-slate-500" />
            <Select value={settings.pageSize} onValueChange={(v) => update({ pageSize: v as PageId })}>
              <SelectTrigger className="w-[92px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(PAGE_SIZES).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Square className="h-3.5 w-3.5 text-slate-500" />
            <Select value={settings.orientation} onValueChange={(v) => update({ orientation: v as "portrait" | "landscape" })}>
              <SelectTrigger className="w-[92px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </RibbonGroup>

      {/* Margins */}
      <RibbonGroup label="Margins">
        <div className="flex flex-col gap-0.5">
          <Select value={preset} onValueChange={(v) => {
            if (v === "Custom") { setMarginsOpen(true); return; }
            const [t, r, b, l] = MARGIN_PRESETS[v];
            update({
              marginTop: Math.round(t * MM_TO_PX),
              marginRight: Math.round(r * MM_TO_PX),
              marginBottom: Math.round(b * MM_TO_PX),
              marginLeft: Math.round(l * MM_TO_PX),
            });
          }}>
            <SelectTrigger className="w-[104px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(MARGIN_PRESETS).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              <SelectItem value="Custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1 text-[9px] text-slate-500 px-1">
            <span>T {mm(settings.marginTop)}</span>
            <span>B {mm(settings.marginBottom)}</span>
            <span>L {mm(settings.marginLeft)}</span>
            <span>R {mm(settings.marginRight)}</span>
            <span className="text-slate-400">mm</span>
          </div>
        </div>
        <MarginsCustomDialog ctx={ctx} open={marginsOpen} onClose={() => setMarginsOpen(false)} />
      </RibbonGroup>

      {/* Columns */}
      <RibbonGroup label="Columns">
        <BtnCol>
          <div className="flex">
            {columnsBtn(1, <Columns2 className="h-4 w-4 rotate-90" />, "One")}
            {columnsBtn(2, <Columns2 className="h-4 w-4" />, "Two")}
            {columnsBtn(3, <Columns3 className="h-4 w-4" />, "Three")}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Divider line between columns"
              onClick={() => update({ columnDivider: !settings.columnDivider })}
              className={`h-6 px-1.5 rounded text-[10px] border ${settings.columnDivider ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            >
              Divider
            </button>
            <Select value={String(settings.columnSpacing)} onValueChange={(v) => update({ columnSpacing: Number(v) })}>
              <SelectTrigger className="w-[72px] h-6 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[24, 32, 48, 64, 80].map((s) => <SelectItem key={s} value={String(s)}>{s} px</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </BtnCol>
      </RibbonGroup>

      {/* Page background / line numbers */}
      <RibbonGroup label="Lines & Borders">
        <BtnCol>
          <RBtn
            icon={<ListOrdered className="h-4 w-4" />}
            label="Line Numbers"
            title="Show line numbers alongside text"
            wide
            active={settings.lineNumbers}
            onClick={() => update({ lineNumbers: !settings.lineNumbers })}
          />
          <RBtn
            icon={<RulerIcon className="h-4 w-4" />}
            label="Dark Border"
            title="Toggle a dark border around pages"
            wide
            active={settings.darkPageBorder}
            onClick={() => update({ darkPageBorder: !settings.darkPageBorder })}
          />
        </BtnCol>
      </RibbonGroup>
    </>
  );
}

function mm(px: number) {
  return Math.round((px / MM_TO_PX) * 10) / 10;
}
