"use client";

/**
 * GraphicsPanel — QR generator, watermark stamps, and a curated icon library
 * (Tabler icons, MIT) that insert as colorable canvas objects.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { QrCode, Stamp, Sparkles } from "lucide-react";

const ICON_COLOR = "#1e293b";

/** Curated Tabler icons (MIT) — school-relevant set, inline SVG paths (24x24, stroke-based). */
const ICONS: Array<{ name: string; body: string }> = [
  { name: "Book", body: `<path d="M6 4h10a4 4 0 0 1 4 4v11a1 1 0 0 1 -1 1h-10a4 4 0 0 1 -4 -4v-11a1 1 0 0 1 1 -1" /><path d="M6 4a2 2 0 0 0 -2 2v3h3" /><path d="M20 19h-9" /><path d="M6 20a2 2 0 0 1 -2 -2" />` },
  { name: "School", body: `<path d="M17 18a2 2 0 0 0 -2 -2h-9a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2h9a2 2 0 0 1 2 2v9a2 2 0 0 0 2 2h1a2 2 0 0 0 2 -2v-1" /><path d="M9 21h6" /><path d="M9 13l3 -3l3 3" />` },
  { name: "Backpack", body: `<path d="M5 18v-8a5 5 0 0 1 10 0v8a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2" /><path d="M10 6v-2a2 2 0 0 1 4 0v2" /><path d="M5 14h10" />` },
  { name: "Certificate", body: `<circle cx="15" cy="15" r="3" /><path d="M13 17.5v4.5l2 -1.5l2 1.5v-4.5" /><path d="M10 19h-5a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v4" /><path d="M9 8h6" />` },
  { name: "Trophy", body: `<path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1 -10 0z" /><path d="M17 5h3v2a3 3 0 0 1 -3 3" /><path d="M7 5h-3v2a3 3 0 0 0 3 3" />` },
  { name: "Star", body: `<path d="M12 3l2.6 5.3 5.9.9 -4.2 4.1 1 5.8 -5.3 -2.8 -5.3 2.8 1 -5.8 -4.2 -4.1 5.9 -.9z" />` },
  { name: "Clock", body: `<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />` },
  { name: "Calendar", body: `<rect x="4" y="5" width="16" height="16" rx="2" /><path d="M16 3v4M8 3v4M4 11h16" />` },
  { name: "Phone", body: `<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" />` },
  { name: "Mail", body: `<rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6l9 -6" />` },
  { name: "MapPin", body: `<path d="M12 21s-7 -5.5 -7 -11a7 7 0 0 1 14 0c0 5.5 -7 11 -7 11z" /><circle cx="12" cy="10" r="2.5" />` },
  { name: "Bus", body: `<rect x="4" y="4" width="16" height="12" rx="2" /><path d="M4 10h16M10 4v6" /><circle cx="7.5" cy="18.5" r="1.5" /><circle cx="16.5" cy="18.5" r="1.5" />` },
  { name: "Flask", body: `<path d="M9 3v7l-5 8a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7 -3l-5 -8v-7" /><path d="M8 3h8" />` },
  { name: "Palette", body: `<path d="M12 21a9 9 0 1 1 9 -9c0 2 -1.5 3 -3 3h-2a2 2 0 0 0 -2 2c0 1 -.5 4 -2 4z" /><circle cx="7.5" cy="10.5" r="1" /><circle cx="12" cy="7.5" r="1" /><circle cx="16.5" cy="10.5" r="1" />` },
  { name: "Check", body: `<path d="M5 12l5 5l9 -10" />` },
  { name: "Heart", body: `<path d="M12 20s-8 -5.5 -8 -11a4.5 4.5 0 0 1 8 -2.8a4.5 4.5 0 0 1 8 2.8c0 5.5 -8 11 -8 11z" />` },
];

function toSvg(body: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

interface Props {
  onAddQr: (value: string) => void;
  onAddWatermark: (text: string) => void;
  onAddIcon: (svg: string, color: string) => void;
}

export default function GraphicsPanel({ onAddQr, onAddWatermark, onAddIcon }: Props) {
  const [qrValue, setQrValue] = useState("");
  const [wmText, setWmText] = useState("DRAFT");
  const [iconColor, setIconColor] = useState(ICON_COLOR);

  return (
    <div className="space-y-4">
      {/* QR */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
          <QrCode className="h-3 w-3" /> QR Code
        </p>
        <div className="flex gap-1.5">
          <Input
            placeholder="URL or text…"
            value={qrValue}
            onChange={(e) => setQrValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && qrValue.trim()) { onAddQr(qrValue.trim()); setQrValue(""); }}}
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-2 text-xs shrink-0"
            onClick={() => { if (qrValue.trim()) { onAddQr(qrValue.trim()); setQrValue(""); }}}>
            Insert
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          The QR re-generates automatically for each student during bulk fill.
        </p>
      </div>

      <Separator />

      {/* Watermark */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
          <Stamp className="h-3 w-3" /> Watermark Stamp
        </p>
        <div className="flex gap-1.5">
          <Input value={wmText} onChange={(e) => setWmText(e.target.value)} className="h-8 text-xs" />
          <Button size="sm" variant="outline" className="h-8 px-2 text-xs shrink-0"
            onClick={() => wmText.trim() && onAddWatermark(wmText.trim())}>
            Stamp
          </Button>
        </div>
        <div className="flex gap-1 mt-2">
          {["DRAFT", "COPY", "CONFIDENTIAL", "VERIFIED"].map((t) => (
            <button key={t} onClick={() => onAddWatermark(t)}
              className="text-[9px] px-1.5 py-1 border rounded hover:bg-muted transition-colors">{t}</button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Icons */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Icons
        </p>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs">Color:</label>
          <input type="color" value={iconColor} onChange={(e) => setIconColor(e.target.value)}
            className="w-7 h-7 rounded border cursor-pointer" />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {ICONS.map((icon) => (
            <button key={icon.name} title={icon.name}
              onClick={() => onAddIcon(toSvg(icon.body, iconColor), iconColor)}
              className="aspect-square flex items-center justify-center border rounded-lg hover:bg-primary/5 hover:border-primary transition-all"
              dangerouslySetInnerHTML={{ __html: toSvg(icon.body, "currentColor").replace("<svg ", '<svg width="20" height="20" ') }} />
          ))}
        </div>
      </div>
    </div>
  );
}
