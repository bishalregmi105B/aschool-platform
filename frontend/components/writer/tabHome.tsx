"use client";

/**
 * Home tab — Clipboard (paste, cut, copy, format painter), Font (family,
 * size, grow/shrink, B/I/U/S, sub/sup, highlight, color, clear), Paragraph
 * (styles, bullets/numbering, indent, align, line spacing, borders &
 * shading), Editing (find/replace, select all).
 */
import React from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Subscript as SubIcon,
  Superscript as SupIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent, ClipboardPaste, Scissors, Copy,
  Paintbrush, RemoveFormatting, Search, TextCursorInput, CaseSensitive,
  ChevronsUpDown, ChevronsDownUp, Minus, RectangleHorizontal, Slash,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { RibbonGroup, RBtn, BtnCol, VSep, ColorSplitBtn, ColorGrid } from "@/components/writer/ribbon";
import type { WriterCtx } from "@/components/writer/context";
import { cn } from "@/lib/utils";
import { ALL_FONTS, FONT_SIZES, LINE_SPACINGS, HIGHLIGHT_COLORS } from "@/lib/writer/settings";

export function HomeTab({ ctx }: { ctx: WriterCtx }) {
  const { editor, settings, update } = ctx;
  const ch = editor.chain().focus();

  const fontAttr = (editor.getAttributes("textStyle").fontFamily as string) || "";
  const sizeAttr = (editor.getAttributes("textStyle").fontSize as string) || "";
  const activeSize = sizeAttr ? parseFloat(sizeAttr) : settings.fontSize;

  const growShrink = (delta: 1 | -1) => {
    const sizes = FONT_SIZES;
    let idx = sizes.findIndex((s) => s >= activeSize);
    if (idx === -1) idx = sizes.length - 1;
    const next = sizes[Math.min(sizes.length - 1, Math.max(0, idx + delta))];
    editor.chain().focus().setFontSize(`${next}pt`).run();
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.chain().focus().insertContent(text).run();
      else toast.info("Clipboard is empty");
    } catch {
      toast.info("Browser blocked clipboard access — press Ctrl+V to paste");
    }
  };

  const copySel = () => {
    const ok = document.execCommand("copy");
    if (!ok) toast.info("Select text first, then copy");
  };
  const cutSel = () => {
    const ok = document.execCommand("cut");
    if (!ok) toast.info("Select text first, then cut");
  };

  // format painter — capture the active marks and re-apply on next click
  const paintMarks = () => {
    const { from, to, empty } = editor.state.selection;
    const marks = empty ? editor.state.selection.$from.marks() : editor.state.doc.resolve(from).marksAcross(editor.state.doc.resolve(to)) || [];
    const usable = marks.filter((m) => !["link", "dataToken"].includes(m.type.name));
    if (!usable.length) {
      toast.info("Place the cursor in formatted text first");
      return;
    }
    ctx.togglePainter(usable.map((m) => ({ type: m.type.name, attrs: m.attrs })));
  };

  const activeAlign = ["left", "center", "right", "justify"].find((a) =>
    editor.isActive({ textAlign: a })) || "left";
  const styleValue =
    editor.isActive("heading", { level: 1 }) ? "h1" :
    editor.isActive("heading", { level: 2 }) ? "h2" :
    editor.isActive("heading", { level: 3 }) ? "h3" :
    editor.isActive("heading", { level: 4 }) ? "h4" :
    editor.isActive("blockquote") ? "quote" :
    editor.isActive("codeBlock") ? "code" : "p";

  const curLine = (editor.getAttributes("paragraph").lineHeight as string)
    || (editor.getAttributes("heading").lineHeight as string) || "1.6";

  const bordersAttr = (editor.getAttributes("paragraph").borders as string) || "none";
  const shadingAttr = editor.getAttributes("paragraph").shading as string | undefined;

  const setBorders = (b: string) => {
    // apply to every selected paragraph/heading block
    const { state, view } = editor;
    const { from, to } = state.selection;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === "paragraph" || node.type.name === "heading") {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, borders: b });
      }
      return true;
    });
    view.dispatch(tr);
  };

  const setShading = (color: string | null) => {
    const { state, view } = editor;
    const { from, to } = state.selection;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === "paragraph" || node.type.name === "heading") {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, shading: color });
      }
      return true;
    });
    view.dispatch(tr);
  };

  const blockBtn = (type: string) =>
    editor.isActive(type) || (type === "paragraph" && styleValue === "p");

  return (
    <>
      {/* Clipboard */}
      <RibbonGroup label="Clipboard">
        <BtnCol>
          <RBtn icon={<ClipboardPaste className="h-4 w-4" />} label="Paste" title="Paste from clipboard" onClick={paste} />
          <div className="flex gap-0.5">
            <RBtn icon={<Scissors className="h-3.5 w-3.5" />} title="Cut" onClick={cutSel} />
            <RBtn icon={<Copy className="h-3.5 w-3.5" />} title="Copy" onClick={copySel} />
            <RBtn icon={<Paintbrush className="h-3.5 w-3.5" />} title="Format painter" active={ctx.painterActive} onClick={paintMarks} />
          </div>
        </BtnCol>
      </RibbonGroup>

      {/* Font */}
      <RibbonGroup label="Font">
        <div className="flex gap-1 items-start">
          <div className="flex flex-col gap-1">
            <Select
              value={fontAttr || settings.font}
              onValueChange={(v) => { editor.chain().focus().setFontFamily(v).run(); update({ font: v }); }}
            >
              <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {ALL_FONTS.map((f) => (
                  <SelectItem key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(activeSize)}
              onValueChange={(v) => editor.chain().focus().setFontSize(`${v}pt`).run()}
            >
              <SelectTrigger className="w-[60px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{FONT_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex">
              <RBtn icon={<Bold className="h-3.5 w-3.5" />} title="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => ch.toggleBold().run()} />
              <RBtn icon={<Italic className="h-3.5 w-3.5" />} title="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => ch.toggleItalic().run()} />
              <RBtn icon={<UnderlineIcon className="h-3.5 w-3.5" />} title="Underline (Ctrl+U)" active={editor.isActive("underline")} onClick={() => ch.toggleUnderline().run()} />
              <RBtn icon={<Strikethrough className="h-3.5 w-3.5" />} title="Strikethrough" active={editor.isActive("strike")} onClick={() => ch.toggleStrike().run()} />
            </div>
            <div className="flex">
              <RBtn icon={<SubIcon className="h-3.5 w-3.5" />} title="Subscript" active={editor.isActive("subscript")} onClick={() => ch.toggleSubscript().run()} />
              <RBtn icon={<SupIcon className="h-3.5 w-3.5" />} title="Superscript" active={editor.isActive("superscript")} onClick={() => ch.toggleSuperscript().run()} />
              <RBtn icon={<CaseSensitive className="h-3.5 w-3.5" />} title="Clear formatting" onClick={() => ch.unsetAllMarks().clearNodes().run()} />
              <RBtn icon={<ChevronsUpDown className="h-3.5 w-3.5" />} title="Grow font" onClick={() => growShrink(1)} />
              <RBtn icon={<ChevronsDownUp className="h-3.5 w-3.5" />} title="Shrink font" onClick={() => growShrink(-1)} />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <ColorSplitBtn
              icon={<span className="text-[11px] font-bold leading-none">A</span>}
              title="Font color"
              onPick={(c) => editor.chain().focus().setColor(c).run()}
            />
            <ColorSplitBtn
              icon={<span className="text-[11px] font-bold leading-none border border-[var(--w11-border-strong)] rounded-[var(--w11-radius-sm)] px-0.5">ab</span>}
              title="Text highlight color"
              colors={HIGHLIGHT_COLORS}
              allowNone
              onPick={(c) => (c === "none" ? editor.chain().focus().unsetHighlight().run() : editor.chain().focus().setHighlight({ color: c }).run())}
            />
          </div>
        </div>
      </RibbonGroup>

      {/* Paragraph */}
      <RibbonGroup label="Paragraph">
        <div className="flex gap-1 items-start">
          <div className="flex flex-col gap-0.5">
            <div className="flex">
              <RBtn icon={<List className="h-3.5 w-3.5" />} title="Bullets" active={editor.isActive("bulletList")} onClick={() => ch.toggleBulletList().run()} />
              <RBtn icon={<ListOrdered className="h-3.5 w-3.5" />} title="Numbering" active={editor.isActive("orderedList")} onClick={() => ch.toggleOrderedList().run()} />
              <RBtn icon={<Outdent className="h-3.5 w-3.5" />} title="Decrease indent" disabled={!editor.can().liftListItem("listItem") && !editor.can().indentLess()} onClick={() => {
                if (editor.isActive("bulletList") || editor.isActive("orderedList")) ch.liftListItem("listItem").run();
                else ch.indentLess().run();
              }} />
              <RBtn icon={<Indent className="h-3.5 w-3.5" />} title="Increase indent" disabled={!editor.can().sinkListItem("listItem") && !editor.can().indentMore()} onClick={() => {
                if (editor.isActive("bulletList") || editor.isActive("orderedList")) ch.sinkListItem("listItem").run();
                else ch.indentMore().run();
              }} />
            </div>
            <div className="flex">
              <RBtn icon={<AlignLeft className="h-3.5 w-3.5" />} title="Align left" active={activeAlign === "left"} onClick={() => ch.setTextAlign("left").run()} />
              <RBtn icon={<AlignCenter className="h-3.5 w-3.5" />} title="Center" active={activeAlign === "center"} onClick={() => ch.setTextAlign("center").run()} />
              <RBtn icon={<AlignRight className="h-3.5 w-3.5" />} title="Align right" active={activeAlign === "right"} onClick={() => ch.setTextAlign("right").run()} />
              <RBtn icon={<AlignJustify className="h-3.5 w-3.5" />} title="Justify" active={activeAlign === "justify"} onClick={() => ch.setTextAlign("justify").run()} />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            {/* line spacing */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" title="Line spacing" className="commandbar-button !h-7 !min-h-0 px-1.5 text-[11px]" style={{ transition: "background var(--w11-transition-fast)" }}>
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 4h14M3 10h14M3 16h14" /><path d="M17 6.5 15.5 5 14 6.5M14 13.5 15.5 15 17 13.5" />
                  </svg>
                  <span className="text-[9px]">{curLine}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {LINE_SPACINGS.map((l) => (
                  <DropdownMenuItem key={l} onClick={() => { ch.setLineHeight(l).run(); }}>
                    <span className={curLine === l ? "font-bold" : ""}>{l}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* borders & shading */}
            <div className="flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" title="Borders" className="commandbar-button !h-7 !min-h-0 px-1" style={{ transition: "background var(--w11-transition-fast)" }}>
                    <RectangleHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setBorders("none")}><Minus className="h-3 w-3 mr-2" />None</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBorders("top")}><svg viewBox="0 0 16 16" className="h-3 w-3 mr-2 text-[var(--w11-text-secondary)]"><rect x="1" y="2" width="14" height="2" fill="currentColor" /></svg>Top</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBorders("bottom")}><svg viewBox="0 0 16 16" className="h-3 w-3 mr-2 text-[var(--w11-text-secondary)]"><rect x="1" y="12" width="14" height="2" fill="currentColor" /></svg>Bottom</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBorders("topbottom")}><svg viewBox="0 0 16 16" className="h-3 w-3 mr-2 text-[var(--w11-text-secondary)]"><rect x="1" y="2" width="14" height="2" fill="currentColor" /><rect x="1" y="12" width="14" height="2" fill="currentColor" /></svg>Top & bottom</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBorders("box")}><svg viewBox="0 0 16 16" className="h-3 w-3 mr-2 text-[var(--w11-text-secondary)]"><rect x="1" y="2" width="14" height="12" fill="none" stroke="currentColor" strokeWidth="2" /></svg>Box</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" title="Shading" className="commandbar-button !h-7 !min-h-0 px-1 flex-col" style={{ transition: "background var(--w11-transition-fast)" }}>
                    <span className="text-[9px] font-bold leading-none">ab</span>
                    <span className="block w-4 h-[3px] rounded-sm" style={{ background: shadingAttr || "transparent" }} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="p-0">
                  <ColorGrid
                    onPick={(c) => setShading(c === "none" ? null : c)}
                    allowNone
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              <RBtn
                icon={<Slash className="h-3.5 w-3.5" />}
                title={`Paragraph borders: ${bordersAttr}`}
                active={bordersAttr !== "none"}
                onClick={() => setBorders(bordersAttr === "box" ? "none" : "box")}
              />
            </div>
          </div>
        </div>
      </RibbonGroup>

      {/* Styles (Word 365 Quick Styles Gallery) — token-driven tiles */}
      <RibbonGroup label="Styles">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5 max-w-[420px]">
          {[
            { id: "p", title: "Normal", sample: "AaBbCc", sampleStyle: "text-xs font-normal text-[var(--w11-text-primary)]" },
            { id: "h1", title: "Heading 1", sample: "AaBbCc", sampleStyle: "text-xs font-bold text-[var(--w11-accent)]" },
            { id: "h2", title: "Heading 2", sample: "AaBbCc", sampleStyle: "text-[11px] font-semibold text-[var(--w11-accent)] opacity-80" },
            { id: "h3", title: "Heading 3", sample: "AaBbCc", sampleStyle: "text-[11px] font-medium text-[var(--w11-text-primary)]" },
            { id: "quote", title: "Quote", sample: "“AaBb”", sampleStyle: "text-xs italic text-[var(--w11-text-secondary)]" },
            { id: "code", title: "Code", sample: "<code>", sampleStyle: "text-[11px] font-mono text-emerald-600 dark:text-emerald-400" },
          ].map((item) => {
            const isActive = blockBtn(item.id === "p" ? "paragraph" : item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "p") ch.setParagraph().run();
                  else if (item.id === "quote") ch.toggleBlockquote().run();
                  else if (item.id === "code") ch.toggleCodeBlock().run();
                  else ch.toggleHeading({ level: Number(item.id[1]) as 1 | 2 | 3 }).run();
                }}
                className={cn(
                  "flex flex-col items-center justify-center !px-2 min-w-[64px] h-[48px] cursor-pointer select-none",
                  isActive && "!font-semibold",
                )}
                style={{
                  borderRadius: "var(--w11-radius-md)",
                  transition: "background var(--w11-transition-fast), border-color var(--w11-transition-fast)",
                  ...(isActive ? {
                    background: "var(--w11-accent-light)",
                    borderColor: "var(--w11-accent)",
                    boxShadow: "0 0 0 1px var(--w11-accent)",
                  } : {}),
                }}
                title={`Apply style: ${item.title}`}
              >
                <span className={cn("leading-none select-none truncate max-w-full", item.sampleStyle)}>{item.sample}</span>
                <span className="text-[9px] font-medium text-[var(--w11-text-tertiary)] mt-1 select-none">{item.title}</span>
              </button>
            );
          })}
        </div>
      </RibbonGroup>

      {/* Editing */}
      <RibbonGroup label="Editing">
        <BtnCol>
          <RBtn icon={<Search className="h-3.5 w-3.5" />} label="Find" title="Find & replace (Ctrl+F)" onClick={() => ctx.openFindReplace(false)} />
          <div className="flex gap-0.5">
            <RBtn icon={<TextCursorInput className="h-3.5 w-3.5" />} title="Replace" onClick={() => ctx.openFindReplace(true)} />
            <RBtn icon={<span className="text-[10px] font-semibold">All</span>} title="Select all (Ctrl+A)" onClick={() => editor.chain().focus().selectAll().run()} />
          </div>
        </BtnCol>
      </RibbonGroup>
    </>
  );
}
