"use client";

/**
 * ExplorePanel — Canva-style deep search across everything insertable:
 * templates (server catalog), the 155-item vector element library, and
 * school stock photos (Unsplash/Pexels via the files service). One query
 * surfaces all three result kinds; clicking inserts directly.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Search, Shapes, Sparkles } from "lucide-react";

import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ELEMENT_PRESET_COLORS, searchElements,
} from "@/lib/designer/elements";
import { stockSearch } from "@/lib/services/files.service";

interface Props {
  onLoadTemplate: (tpl: unknown) => void;
  onAddIcon: (svg: string, color: string) => void;
  onAddPhoto: (url: string) => void;
}

type TemplateRow = {
  id: string;
  name: string;
  category: string;
  editor_type: string;
  thumbnail_emoji?: string;
  thumbnail_url?: string;
  width: number;
  height: number;
};

const ACCENT = "#64748b";

export default function ExplorePanel({ onLoadTemplate, onAddIcon, onAddPhoto }: Props) {
  const [query, setQuery] = useState("");
  const [accent, setAccent] = useState(ACCENT);
  const [submitted, setSubmitted] = useState("");
  const [photoSource, setPhotoSource] = useState<"unsplash" | "pexels">("unsplash");

  const q = submitted.trim().toLowerCase();

  const templates = useQuery({
    queryKey: ["design-templates"],
    queryFn: async () => {
      const r = await api.get("/design-studio/templates");
      const data = r.data?.data;
      return (Array.isArray(data) ? data : data?.templates ?? []) as TemplateRow[];
    },
  });

  const elementHits = useMemo(
    () => (q ? searchElements(submitted) : []),
    [q, submitted],
  );

  const templateHits = useMemo(() => {
    const rows = templates.data ?? [];
    if (!q) return rows.slice(0, 12);
    return rows.filter((t) =>
      t.name?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      t.editor_type?.toLowerCase().includes(q),
    );
  }, [templates.data, q]);

  const photos = useQuery({
    queryKey: ["explore-stock", submitted, photoSource],
    queryFn: () => stockSearch(submitted || "school", photoSource, 1, 12),
    enabled: !!submitted,
    staleTime: 5 * 60 * 1000,
  });

  const photoHits = photos.data?.results ?? [];

  const runSearch = () => setSubmitted(query);

  return (
    <div className="space-y-4 flex flex-col min-h-0">
      {/* search bar */}
      <form className="relative" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Explore templates, graphics, photos…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={runSearch}
          className="pl-7 h-9 text-xs"
        />
      </form>

      {!q && (
        <div className="flex flex-wrap gap-1.5">
          {["certificate", "id card", "calendar", "children", "school", "book", "star", "globe"].map((s) => (
            <button
              key={s}
              onClick={() => { setQuery(s); setSubmitted(s); }}
              className="text-[10px] px-2 py-1 rounded-full border hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── templates ─────────────────────────────────────────────── */}
      {templateHits.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Templates <span className="opacity-60">({templateHits.length})</span>
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {templateHits.slice(0, 12).map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => onLoadTemplate(tpl)}
                className="border rounded-lg overflow-hidden hover:border-primary transition-colors bg-muted/30 p-1.5 text-center"
                title={`${tpl.name} (${tpl.category})`}
              >
                <span className="text-lg leading-none block">{tpl.thumbnail_emoji || "📄"}</span>
                <span className="text-[9px] leading-tight line-clamp-2 block mt-0.5">{tpl.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── elements ──────────────────────────────────────────────── */}
      {elementHits.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Shapes className="h-3 w-3" /> Graphics <span className="opacity-60">({elementHits.length})</span>
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-0.5">Color:</span>
            {ELEMENT_PRESET_COLORS.slice(0, 6).map((c) => (
              <button key={c} onClick={() => setAccent(c)} style={{ background: c }}
                className={`w-4 h-4 rounded-full border ${accent === c ? "ring-2 ring-offset-1 ring-primary" : "border-border"}`}
                title={c} />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {elementHits.slice(0, 12).map(({ item }) => (
              <button
                key={item.id}
                onClick={() => onAddIcon(item.svg.replace(/currentColor/g, accent), accent)}
                className="border rounded-lg p-1.5 hover:border-primary hover:bg-muted/50 transition-colors"
                title={item.label}
              >
                <span className="block w-full aspect-square [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: item.svg }} />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── stock photos ──────────────────────────────────────────── */}
      {submitted && (
        <section className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <ImageIcon className="h-3 w-3" /> Photos
            <span className="flex gap-1 ml-1">
              {(["unsplash", "pexels"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPhotoSource(s)}
                  className={`px-1.5 rounded ${photoSource === s ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {s === "unsplash" ? "Unsplash" : "Pexels"}
                </button>
              ))}
            </span>
            <Button
              variant="ghost" size="sm"
              className="h-5 text-[10px] px-1.5 ml-auto"
              onClick={() => photos.refetch()}
              disabled={photos.isFetching}
            >
              {photos.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : "More"}
            </Button>
          </p>
          {photoHits.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {photoHits.slice(0, 12).map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => { onAddPhoto(p.full_url); toast.success("Photo added"); }}
                  className="aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors"
                  title={p.author || "Stock photo"}
                >
                  {/* thumbnails are proxied by the stock provider — safe to hotlink */}
                  <img src={p.thumb_url || p.preview_url || p.full_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          ) : photos.isFetching ? (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading photos…</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">No photos (or the stock API keys are not configured)</p>
          )}
        </section>
      )}

      {!q && templateHits.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Type a keyword to search templates, graphics and photos — results insert in one click.</p>
      )}
    </div>
  );
}
