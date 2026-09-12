"use client";

/**
 * TemplateThumb — one thumbnail renderer for every designer template card.
 *
 * The templates API returns `thumbnail_url` as a backend-relative path
 * (`/api/v1/design-studio/templates/<key>/thumbnail`) for folder templates
 * that ship a generated thumbnail.png — 11 of the 33 catalog templates have
 * no generated image yet and only carry the legacy `thumbnail_emoji`.
 *
 * This component guarantees a premium card in every case:
 *  - real thumbnails render as <img>, absolutized against the API origin
 *    (same pattern as lib/designer/canvasImages.ts — raw relative paths break
 *    whenever the API is served off-origin),
 *  - missing/failed thumbnails fall back to a deterministic gradient tile
 *    (gradient picked by name hash, on-brand with SECTION_GRADIENTS) with a
 *    44px glass icon tile, so a card never looks blank or broken.
 */
import React, { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { absolutizeImageUrl } from "@/lib/designer/canvasImages";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";

/** Deterministic 32-bit string hash (FNV-1a). */
function hashName(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** On-brand gradient palette (SECTION_GRADIENTS values, order-stable). */
const GRADIENT_POOL: string[] = Object.values(SECTION_GRADIENTS);

/** Deterministic gradient for a template name — same name, same tile. */
export function templateGradient(name: string): string {
  return GRADIENT_POOL[hashName(name || "template") % GRADIENT_POOL.length];
}

/** Glass 44px icon tile layered over the gradient wash. */
function IconTile({ icon }: { icon?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center text-white shrink-0"
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: "rgba(255,255,255,0.22)",
        border: "1px solid rgba(255,255,255,0.38)",
        boxShadow: "0 8px 16px -6px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.45)",
        backdropFilter: "blur(4px)",
      }}
    >
      {icon ?? <ImageIcon className="h-5 w-5" />}
    </div>
  );
}

/**
 * Renders inside any positioned (relative) card container, filling it.
 * Pass the category icon so the fallback reads as a real design tile.
 */
export function TemplateThumb({
  url, name, icon, className, eager,
}: {
  url?: string | null;
  name: string;
  icon?: React.ReactNode;
  /** extra classes for the <img> (e.g. zoom-on-hover transitions). */
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = url ? absolutizeImageUrl(url) : "";

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        className={`absolute inset-0 w-full h-full object-cover ${className ?? ""}`}
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: templateGradient(name) }}
      aria-label={`${name} preview`}
    >
      {/* soft radial sheen keeps the wash from reading flat */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(120% 90% at 20% 0%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%)" }}
      />
      <IconTile icon={icon} />
    </div>
  );
}
