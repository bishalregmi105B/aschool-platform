"use client";

/**
 * Insert tab — Tables (grid picker + contextual row/col ops), Pictures,
 * Shapes, WordArt, Links, Text box, Page break, Divider, Header & Footer,
 * Page numbers, Symbols.
 */
import React, { useState } from "react";
import {
  Table as TableIcon, Image as ImageIcon, Link2, Minus, FilePlus2,
  Type as TypeIcon, Square, Circle, ArrowRight, Star, Sigma,
  Hash, PanelTop, PanelBottom, Braces, Trash2, SplitSquareHorizontal,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RibbonGroup, RBtn, BtnCol } from "@/components/writer/ribbon";
import type { WriterCtx } from "@/components/writer/context";
import { SYMBOL_SETS } from "@/lib/writer/settings";
import type { ShapeKind } from "@/lib/writer/settings";

/** Word-like 8x8 insert-table grid. */
function TableGrid({ onPick }: { onPick: (r: number, c: number) => void }) {
  const [hover, setHover] = useState({ r: 0, c: 0 });
  const N = 8;
  return (
    <div className="p-2">
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${N}, 16px)` }}
        onMouseLeave={() => setHover({ r: 0, c: 0 })}
      >
        {Array.from({ length: N * N }, (_, i) => {
          const r = Math.floor(i / N) + 1;
          const c = (i % N) + 1;
          const on = r <= hover.r && c <= hover.c;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => onPick(r, c)}
              className={`w-4 h-4 rounded-[2px] border ${on ? "border-blue-500 bg-blue-200" : "border-slate-300 bg-white"}`}
            />
          );
        })}
      </div>
      <div className="text-[10px] text-slate-500 mt-1 text-center">
        {hover.c ? `${hover.c} x ${hover.r} table` : "Insert table"}
      </div>
    </div>
  );
}

const SHAPES: { kind: ShapeKind; icon: React.ReactNode; label: string }[] = [
  { kind: "rect", icon: <Square className="h-4 w-4" />, label: "Rectangle" },
  { kind: "ellipse", icon: <Circle className="h-4 w-4" />, label: "Ellipse" },
  { kind: "arrow", icon: <ArrowRight className="h-4 w-4" />, label: "Arrow" },
  { kind: "star", icon: <Star className="h-4 w-4" />, label: "Star" },
];

export function InsertTab({ ctx }: { ctx: WriterCtx }) {
  const { editor } = ctx;
  const ch = editor.chain().focus();
  const [imgUrl, setImgUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const inTable = editor.isActive("table");

  const pickImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) ctx.insertImageFile(file);
    };
    input.click();
  };

  return (
    <>
      {/* Tables */}
      <RibbonGroup label="Tables">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="h-[52px] w-[52px] rounded hover:bg-slate-100 flex flex-col items-center justify-center gap-0.5 text-slate-700" title="Insert table">
              <TableIcon className="h-5 w-5" />
              <span className="text-[9px]">Table</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <TableGrid onPick={(r, c) => ctx.insertTable(r, c, true)} />
          </PopoverContent>
        </Popover>
        {inTable && (
          <BtnCol>
            <div className="flex gap-0.5">
              <RBtn icon={<span className="text-[10px]">R+</span>} title="Add row below" onClick={() => ch.addRowAfter().run()} />
              <RBtn icon={<span className="text-[10px]">R−</span>} title="Delete row" onClick={() => ch.deleteRow().run()} />
              <RBtn icon={<span className="text-[10px]">C+</span>} title="Add column after" onClick={() => ch.addColumnAfter().run()} />
              <RBtn icon={<span className="text-[10px]">C−</span>} title="Delete column" onClick={() => ch.deleteColumn().run()} />
            </div>
            <div className="flex gap-0.5">
              <RBtn icon={<SplitSquareHorizontal className="h-3.5 w-3.5" />} title="Merge cells" onClick={() => ch.mergeCells().run()} />
              <RBtn icon={<span className="text-[10px]">Split</span>} title="Split cell" onClick={() => ch.splitCell().run()} />
              <RBtn icon={<Trash2 className="h-3.5 w-3.5" />} title="Delete table" onClick={() => ch.deleteTable().run()} />
            </div>
          </BtnCol>
        )}
      </RibbonGroup>

      {/* Illustrations */}
      <RibbonGroup label="Illustrations">
        <div className="flex flex-col gap-0.5">
          <RBtn icon={<ImageIcon className="h-4 w-4" />} label="Picture" title="Insert picture from file" onClick={pickImage} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" title="Insert image from URL" className="h-7 min-w-[52px] rounded px-1 flex items-center justify-center gap-1 text-[10px] text-slate-700 hover:bg-slate-100">
                <Link2 className="h-3.5 w-3.5" /> URL
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="p-2 flex gap-1">
              <Input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://…" className="h-7 w-56 text-xs" />
              <Button size="sm" className="h-7 text-xs" onClick={() => {
                if (imgUrl) { ctx.insertImageUrl(imgUrl); setImgUrl(""); }
              }}>Insert</Button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="h-[52px] w-[52px] rounded hover:bg-slate-100 flex flex-col items-center justify-center gap-0.5 text-slate-700" title="Insert shape">
              <Square className="h-5 w-5" />
              <span className="text-[9px]">Shapes</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {SHAPES.map((s) => (
              <DropdownMenuItem key={s.kind} onClick={() => ctx.insertShape(s.kind)}>
                {s.icon}<span className="ml-2 text-xs">{s.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <RBtn icon={<Star className="h-4 w-4" />} label="WordArt" title="Insert WordArt" wide onClick={() => ctx.insertWordArt()} />
      </RibbonGroup>

      {/* Links */}
      <RibbonGroup label="Links">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="h-[52px] w-[52px] rounded hover:bg-slate-100 flex flex-col items-center justify-center gap-0.5 text-slate-700" title="Insert link">
              <Link2 className="h-5 w-5" />
              <span className="text-[9px]">Link</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="p-2 flex gap-1">
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="h-7 w-56 text-xs" />
            <Button size="sm" className="h-7 text-xs" onClick={() => {
              if (linkUrl) { ctx.insertLink(linkUrl); setLinkUrl(""); }
            }}>Apply</Button>
          </DropdownMenuContent>
        </DropdownMenu>
      </RibbonGroup>

      {/* Text */}
      <RibbonGroup label="Text">
        <RBtn icon={<TypeIcon className="h-4 w-4" />} label="Text Box" title="Insert text box" wide onClick={() => ctx.insertTextbox()} />
        <RBtn icon={<Minus className="h-4 w-4" />} label="Divider" title="Horizontal divider" wide onClick={() => ctx.insertDivider()} />
        <RBtn icon={<FilePlus2 className="h-4 w-4" />} label="Page Break" title="Page break (Ctrl+Enter)" wide onClick={() => ctx.insertPageBreak()} />
      </RibbonGroup>

      {/* Header & Footer */}
      <RibbonGroup label="Header & Footer">
        <BtnCol>
          <RBtn icon={<PanelTop className="h-4 w-4" />} label="Header" title="Edit header text" active={ctx.settings.headerOn} wide onClick={() => ctx.openHeaderFooter()} />
          <RBtn icon={<PanelBottom className="h-4 w-4" />} label="Footer" title="Edit footer text" active={ctx.settings.footerOn} wide onClick={() => ctx.openHeaderFooter()} />
        </BtnCol>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="h-[52px] w-[52px] rounded hover:bg-slate-100 flex flex-col items-center justify-center gap-0.5 text-slate-700" title="Page numbers">
              <Hash className="h-5 w-5" />
              <span className="text-[9px]">Page №</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => ctx.setPageNumber("bottom-left")}>Bottom left</DropdownMenuItem>
            <DropdownMenuItem onClick={() => ctx.setPageNumber("bottom-center")}>Bottom center</DropdownMenuItem>
            <DropdownMenuItem onClick={() => ctx.setPageNumber("bottom-right")}>Bottom right</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => ctx.setPageNumber("none")}>Remove page numbers</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </RibbonGroup>

      {/* Symbols */}
      <RibbonGroup label="Symbols">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="h-[52px] w-[52px] rounded hover:bg-slate-100 flex flex-col items-center justify-center gap-0.5 text-slate-700" title="Insert symbol">
              <Sigma className="h-5 w-5" />
              <span className="text-[9px]">Symbol</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 overflow-auto p-1 w-64">
            {SYMBOL_SETS.map((set) => (
              <div key={set.name} className="mb-1">
                <div className="text-[9px] uppercase tracking-wide text-slate-400 px-1">{set.name}</div>
                <div className="grid grid-cols-8 gap-0.5">
                  {set.chars.map((c, i) => (
                    <button
                      key={`${set.name}-${i}`}
                      type="button"
                      onClick={() => ctx.insertSymbol(c)}
                      className="h-6 w-6 rounded text-sm hover:bg-blue-100"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <RBtn icon={<Braces className="h-4 w-4" />} label="Tokens" title="Insert data tokens" wide onClick={() => {
          toast.info("Use the Tokens button in the top bar to show the token palette");
        }} />
      </RibbonGroup>
    </>
  );
}
