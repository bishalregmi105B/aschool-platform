"use client";

/**
 * Writer v2 dialogs — Find & Replace (with highlight-all), WordArt picker
 * (style presets + text), and Header & Footer editor.
 */
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  replaceAllMatches, replaceCurrentMatch, findNextMatch, setFindState, countMatches,
} from "@/lib/writer/findReplace";
import { WORDART_STYLES } from "@/lib/writer/settings";
import type { WriterCtx } from "@/components/writer/context";
import { toast } from "sonner";

// ── Find & Replace ──────────────────────────────────────────────────────

export function FindReplaceDialog({
  ctx, open, showReplace, onClose,
}: {
  ctx: WriterCtx;
  open: boolean;
  showReplace: boolean;
  onClose: () => void;
}) {
  const { editor, find, setFind } = ctx;
  const [query, setQuery] = useState(find.query);
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setFindState(editor, { query: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setFindState(editor, { query, caseSensitive, index: 0 });
    setMatchCount(query ? countMatches(editor, query, caseSensitive) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, caseSensitive]);

  const doReplaceAll = () => {
    const n = replaceAllMatches(editor, replacement);
    if (n) { toast.success(`Replaced ${n} occurrence${n > 1 ? "s" : ""}`); setMatchCount(0); }
    else toast.info("No matches to replace");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Find and Replace</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-[10px]">Find what</Label>
            <div className="flex gap-1">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") findNextMatch(editor, e.shiftKey ? -1 : 1); }}
                placeholder="Search the document…"
                className="h-8 text-sm"
              />
              <Button size="icon" variant="outline" className="h-8 w-8" title="Previous match" onClick={() => findNextMatch(editor, -1)}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Next match" onClick={() => findNextMatch(editor, 1)}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {query ? `${matchCount} match${matchCount === 1 ? "" : "es"} highlighted` : "All matches are highlighted as you type"}
            </div>
          </div>

          {showReplace && (
            <div>
              <Label className="text-[10px]">Replace with</Label>
              <Input value={replacement} onChange={(e) => setReplacement(e.target.value)} className="h-8 text-sm" />
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => replaceCurrentMatch(editor, replacement)}>
                  Replace
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={doReplaceAll}>
                  Replace All
                </Button>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <Switch checked={caseSensitive} onCheckedChange={setCaseSensitive} />
            Match case
          </label>
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── WordArt ─────────────────────────────────────────────────────────────

export function WordArtDialog({
  open, onClose, onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (text: string, style: number) => void;
}) {
  const [text, setText] = useState("WordArt");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Insert WordArt</DialogTitle></DialogHeader>
        <Input value={text} onChange={(e) => setText(e.target.value)} className="h-8 text-sm" placeholder="Your text…" />
        <div className="grid grid-cols-2 gap-2 py-1">
          {WORDART_STYLES.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => { onInsert(text || "WordArt", i); onClose(); }}
              className="h-12 rounded border border-slate-200 hover:border-blue-500 flex items-center justify-center overflow-hidden"
            >
              <span
                className="text-lg"
                style={{
                  fontFamily: `'${s.font}',Impact,Arial`,
                  fontWeight: s.weight,
                  background: `linear-gradient(135deg, ${s.from}, ${s.to})`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  WebkitTextStroke: s.outline ? `1px ${s.from}` : undefined,
                }}
              >
                {text || "WordArt"}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Header & Footer ─────────────────────────────────────────────────────

export function HeaderFooterDialog({
  ctx, open, onClose,
}: {
  ctx: WriterCtx;
  open: boolean;
  onClose: () => void;
}) {
  const { settings, update } = ctx;
  const [header, setHeader] = useState(settings.headerText);
  const [footer, setFooter] = useState(settings.footerText);
  const [pageNo, setPageNo] = useState(settings.pageNumber !== "none");

  useEffect(() => {
    if (open) {
      setHeader(settings.headerText);
      setFooter(settings.footerText);
      setPageNo(settings.pageNumber !== "none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () => {
    update({
      headerOn: !!header.trim(),
      headerText: header,
      footerOn: !!(footer.trim() || pageNo),
      footerText: footer,
      pageNumber: pageNo ? (settings.pageNumber === "none" ? "bottom-center" : settings.pageNumber) : "none",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Header & Footer</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-[10px]">Header text (top of every page)</Label>
            <Input value={header} onChange={(e) => setHeader(e.target.value)} className="h-8 text-sm" placeholder="e.g. School name / report title" />
          </div>
          <div>
            <Label className="text-[10px]">Footer text (bottom of every page)</Label>
            <Input value={footer} onChange={(e) => setFooter(e.target.value)} className="h-8 text-sm" placeholder="e.g. Confidential — for internal use" />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <Switch checked={pageNo} onCheckedChange={setPageNo} />
            Show &quot;Page X of Y&quot; in the footer
          </label>
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
