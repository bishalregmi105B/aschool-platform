"use client";

/**
 * Writer v2 custom TipTap extensions: page break node, floating box node
 * (text box / WordArt / shape), paragraph indent + borders + shading.
 * Everything else comes from StarterKit / @tiptap extensions.
 */
import { Extension, Node, Mark, mergeAttributes, CommandProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import React, { useCallback, useRef, useState } from "react";
import type { Mark as PMMark } from "@tiptap/pm/model";
import type { FloatingBox } from "./settings";
import { WORDART_STYLES } from "./settings";

// ── Paragraph indent / borders / shading (global attrs) ────────────────

export const WriterParagraphFormat = Extension.create({
  name: "writerParagraphFormat",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: null as number | null,
            parseHTML: (el) => {
              const v = parseInt((el as HTMLElement).style.paddingLeft || "", 10);
              return Number.isFinite(v) && v > 0 ? v : null;
            },
            renderHTML: (attrs) =>
              attrs.indent ? { style: `padding-left:${attrs.indent}px` } : {},
          },
          borders: {
            default: "none" as string, // none|top|bottom|topbottom|box
            parseHTML: (el) => (el as HTMLElement).getAttribute("data-pborders") || "none",
            renderHTML: (attrs) => {
              const b = attrs.borders as string;
              if (!b || b === "none") return {};
              const line = "1.5px solid #64748b";
              const style: Record<string, string> = {};
              if (b === "top" || b === "topbottom" || b === "box") style["border-top"] = line;
              if (b === "bottom" || b === "topbottom" || b === "box") style["border-bottom"] = line;
              if (b === "box") { style["border-left"] = line; style["border-right"] = line; }
              return { style: Object.entries(style).map(([k, v]) => `${k}:${v}`).join(";"), "data-pborders": b };
            },
          },
          shading: {
            default: null as string | null,
            parseHTML: (el) => (el as HTMLElement).getAttribute("data-shading"),
            renderHTML: (attrs) =>
              attrs.shading ? { style: `background-color:${attrs.shading}`, "data-shading": attrs.shading } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      indentMore: () => changeIndent(36),
      indentLess: () => changeIndent(-36),
    } as never;
  },
});

function changeIndent(delta: number) {
  return (props: CommandProps) => {
    const { state, view, tr } = props;
    const { from, to } = state.selection;
    let touched = false;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === "paragraph" || node.type.name === "heading") {
        const cur = Number(node.attrs.indent || 0);
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: Math.max(0, cur + delta) });
        touched = true;
      }
      return true;
    });
    if (touched) view.dispatch(tr);
    return touched;
  };
}

// ── Page break node ────────────────────────────────────────────────────

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },
  renderHTML() {
    return ["div", mergeAttributes({ "data-page-break": "true", class: "writer-pagebreak" })];
  },
  addCommands() {
    return {
      setPageBreak: () => (props: CommandProps) => props.commands.insertContent({ type: this.name }),
    } as never;
  },
  addKeyboardShortcuts() {
    return { "Mod-Enter": () => (this.editor.commands.setPageBreak() as unknown as boolean) };
  },
});

// ── Floating box node (text box / wordart / shape) ─────────────────────

function boxStyle(box: FloatingBox): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    left: box.x,
    top: box.y,
    width: box.w,
    height: box.h,
    fontFamily: `'${box.font}',Arial,sans-serif`,
    fontSize: `${box.fontSize}pt`,
    color: box.color,
    textAlign: box.align as React.CSSProperties["textAlign"],
    zIndex: 5,
  };
  if (box.kind === "wordart") {
    const art = WORDART_STYLES[box.artStyle ?? 0] ?? WORDART_STYLES[0];
    return {
      ...base,
      fontWeight: art.weight,
      background: `linear-gradient(135deg, ${art.from}, ${art.to})`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: box.align === "left" ? "flex-start" : box.align === "right" ? "flex-end" : "center",
      whiteSpace: "pre-wrap",
    };
  }
  if (box.kind === "textbox") {
    return {
      ...base,
      background: box.fill || "transparent",
      border: box.border ? "1px solid #64748b" : "1px solid transparent",
      padding: 6,
      overflow: "hidden",
      whiteSpace: "pre-wrap",
    };
  }
  return base;
}

function ShapeSvg({ box }: { box: FloatingBox }) {
  const stroke = box.stroke || "#0f172a";
  const fill = box.fill || "transparent";
  const common = { fill, stroke, strokeWidth: 2 };
  if (box.kind === "ellipse")
    return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="49" ry="49" {...common} /></svg>;
  if (box.kind === "arrow")
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
        <polygon points="0,22 70,22 70,8 100,20 70,32 70,18 0,18" {...common} strokeLinejoin="round" />
      </svg>
    );
  if (box.kind === "star")
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points="50,2 61,38 99,38 68,60 80,98 50,74 20,98 32,60 1,38 39,38" {...common} strokeLinejoin="round" />
      </svg>
    );
  return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="1" y="1" width="98" height="98" {...common} /></svg>;
}

interface BoxViewProps {
  node: { attrs: Record<string, unknown> };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  selected: boolean;
  deleteNode: () => void;
}

/** Absolute-positioned, drag/resize/editable floating box rendered from the node. */
function FloatingBoxView({ node, updateAttributes, selected, deleteNode }: BoxViewProps) {
  const box = node.attrs as unknown as FloatingBox;
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);

  const drag = useCallback(
    (e: React.PointerEvent, mode: "move" | "resize") => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const orig = { x: box.x, y: box.y, w: box.w, h: box.h };
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (mode === "move") {
          updateAttributes({ x: Math.max(0, orig.x + dx), y: Math.max(0, orig.y + dy) });
        } else {
          updateAttributes({
            w: Math.max(40, orig.w + dx),
            h: Math.max(24, orig.h + dy),
          });
        }
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [box.x, box.y, box.w, box.h, updateAttributes],
  );

  const commitText = (el: HTMLElement) => {
    setEditing(false);
    const text = el.innerText.replace(/\n$/, "");
    if (text !== box.text) updateAttributes({ text });
  };

  return (
    <NodeViewWrapper
      as="div"
      className="writer-floating-box"
      style={{ ...boxStyle(box), outline: selected ? "2px solid #2563eb" : undefined, cursor: editing ? "text" : "move" }}
    >
      <div
        ref={ref}
        style={{ width: "100%", height: "100%" }}
        onDoubleClick={() => { if (box.kind === "textbox" || box.kind === "wordart") setEditing(true); }}
        onBlur={(e) => commitText(e.currentTarget)}
        contentEditable={editing}
        suppressContentEditableWarning
      >
        {box.kind === "textbox" && (box.text || (editing ? "" : "Text box"))}
        {box.kind === "wordart" && box.text}
      </div>
      {box.kind !== "textbox" && box.kind !== "wordart" && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <ShapeSvg box={box} />
        </div>
      )}
      {selected && (
        <>
          <span
            title="Drag to move"
            onPointerDown={(e) => drag(e, "move")}
            style={{ position: "absolute", left: -9, top: -9, width: 16, height: 16, borderRadius: "50%", background: "#2563eb", border: "2px solid white", cursor: "grab", zIndex: 6 }}
          />
          <span
            title="Resize"
            onPointerDown={(e) => drag(e, "resize")}
            style={{ position: "absolute", right: -6, bottom: -6, width: 12, height: 12, background: "#2563eb", border: "2px solid white", cursor: "nwse-resize", zIndex: 6 }}
          />
          <button
            title="Delete"
            onClick={deleteNode}
            style={{ position: "absolute", right: -10, top: -10, width: 18, height: 18, borderRadius: 4, background: "#dc2626", color: "white", fontSize: 11, lineHeight: "16px", cursor: "pointer", zIndex: 6, border: "none" }}
          >
            ×
          </button>
        </>
      )}
    </NodeViewWrapper>
  );
}

export const FloatingBoxNode = Node.create({
  name: "floatingBox",
  group: "block",
  atom: true,
  selectable: true,
  defining: true,
  addAttributes() {
    return {
      x: { default: 100 }, y: { default: 100 }, w: { default: 240 }, h: { default: 100 },
      kind: { default: "textbox" }, text: { default: "" },
      fontSize: { default: 14 }, font: { default: "Calibri" }, color: { default: "#0f172a" },
      align: { default: "left" }, fill: { default: null }, stroke: { default: null },
      border: { default: true }, artStyle: { default: 0 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-floating-box]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-floating-box": "true" }, HTMLAttributes)];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FloatingBoxView);
  },
  addCommands() {
    return {
      insertFloatingBox: (box: Partial<FloatingBox>) => (props: CommandProps) =>
        props.commands.insertContent({
          type: this.name,
          attrs: { ...box, id: `box-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
        }),
    } as never;
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    writerParagraphFormat: {
      indentMore: () => ReturnType;
      indentLess: () => ReturnType;
    };
    writerExtras: {
      setPageBreak: () => ReturnType;
      insertFloatingBox: (box: Partial<FloatingBox>) => ReturnType;
      setImageSize: (attrs: { width: number; height?: number | null }) => ReturnType;
      addWriterComment: (author: string, body: string) => ReturnType;
    };
  }
}

// ── Resizable / alignable image node (Word / Google Docs style) ─────────

interface ImageHandleProps {
  selected: boolean;
  width: number;
  height: number | null;
  align: "left" | "center" | "right" | "none";
  imgRef: React.RefObject<HTMLImageElement | null>;
  onWidthCommit: (w: number, h: number | null) => void;
  onAlign: (a: "left" | "center" | "right" | "none") => void;
  remove: () => void;
}

/** Selection handles + hover toolbar around a selected image. */
function ImageHandles({
  selected, width, height, align, imgRef, onWidthCommit, onAlign, remove,
}: ImageHandleProps) {
  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = imgRef.current;
      if (!el) return;
      const startX = e.clientX;
      const startW = el.offsetWidth;
      const aspect = el.offsetHeight > 0 ? el.offsetWidth / el.offsetHeight : 1;
      let latest = { w: startW, h: startW / aspect };
      const onMove = (ev: PointerEvent) => {
        const next = Math.max(48, Math.min(2000, Math.round(startW + (ev.clientX - startX) * 2)));
        latest = { w: next, h: Math.round(next / aspect) };
        el.style.width = `${latest.w}px`;
        el.style.height = `${latest.h}px`;
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        el.style.width = "";
        el.style.height = "";
        onWidthCommit(latest.w, latest.h);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [imgRef, onWidthCommit],
  );

  if (!selected) return null;
  return (
    <>
      <div
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          border: "1.5px solid #2563eb",
        }}
      />
      <span
        title="Resize (keep aspect)"
        onPointerDown={startDrag}
        style={{
          position: "absolute", right: -7, bottom: -7, width: 13, height: 13,
          background: "#2563eb", border: "2px solid white", borderRadius: 2,
          cursor: "nwse-resize", zIndex: 6,
        }}
      />
      <span
        title="Resize (keep aspect)"
        onPointerDown={startDrag}
        style={{
          position: "absolute", left: -7, bottom: -7, width: 13, height: 13,
          background: "#2563eb", border: "2px solid white", borderRadius: 2,
          cursor: "nesw-resize", zIndex: 6,
        }}
      />
      <div
        contentEditable={false}
        style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)", top: -34,
          display: "flex", gap: 1, background: "#0f172a", borderRadius: 6, padding: 3,
          zIndex: 7, boxShadow: "0 4px 14px rgba(0,0,0,.28)", whiteSpace: "nowrap",
        }}
      >
        {([
          ["left", "⯇", "Align left"],
          ["center", "≡", "Center"],
          ["right", "⯈", "Align right"],
          ["none", "⇥", "Inline with text"],
        ] as const).map(([value, glyph, title]) => (
          <button
            key={value}
            title={title}
            onClick={() => onAlign(value)}
            style={{
              background: align === value ? "#2563eb" : "transparent",
              color: "white", border: "none", borderRadius: 4, width: 24, height: 22,
              cursor: "pointer", fontSize: 12, lineHeight: "22px", padding: 0,
            }}
          >
            {glyph}
          </button>
        ))}
        <span style={{ color: "#64748b", padding: "0 3px" }}>|</span>
        <span title="Image width" style={{ color: "white", fontSize: 11, lineHeight: "22px", padding: "0 4px", userSelect: "none" }}>
          {width}px
        </span>
        <button
          title="Actual size (100%)"
          onClick={() => onWidthCommit(0, null)}
          style={{ background: "transparent", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, padding: "0 5px" }}
        >
          100%
        </button>
        <button
          title="Remove image"
          onClick={remove}
          style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, lineHeight: "22px", padding: 0, width: 22 }}
        >
          ×
        </button>
      </div>
      {height != null && (
        <span
          contentEditable={false}
          style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: -24,
            background: "#0f172a", color: "white", fontSize: 10, borderRadius: 4,
            padding: "1px 6px", zIndex: 6, userSelect: "none",
          }}
        >
          {width} × {height} px
        </span>
      )}
    </>
  );
}

/** Image node view: drag-to-resize handles + alignment toolbar, like Word. */
function WriterImageView(props: any) {
  const { node, updateAttributes, selected, deleteNode } = props;
  const attrs = node.attrs as { src: string; alt?: string; title?: string; width?: number | null; height?: number | null; textAlign?: string };
  const imgRef = useRef<HTMLImageElement>(null);
  const [live, setLive] = useState<{ w: number; h: number } | null>(null);

  const align = (attrs.textAlign as ImageHandleProps["align"]) || "none";
  const width = attrs.width || live?.w || null;
  const height = attrs.height || live?.h || null;

  const onWidthCommit = useCallback(
    (w: number, h: number | null) => {
      if (w === 0) updateAttributes({ width: null, height: null }); // reset to actual size
      else updateAttributes({ width: w, height: h });
    },
    [updateAttributes],
  );

  const onAlign = useCallback(
    (a: ImageHandleProps["align"]) => updateAttributes({ textAlign: a }),
    [updateAttributes],
  );

  return (
    <NodeViewWrapper
      as="div"
      className={`writer-image-node${align !== "none" ? ` writer-image-${align}` : ""}`}
      style={{ maxWidth: "100%" }}
    >
      <img
        ref={imgRef}
        src={attrs.src}
        alt={attrs.alt || ""}
        title={attrs.title || ""}
        draggable
        onLoad={() => {
          if (!attrs.width && imgRef.current) {
            setLive({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight });
          }
        }}
        style={{
          width: attrs.width || undefined,
          height: attrs.height || undefined,
          maxWidth: "100%",
        }}
      />
      <ImageHandles
        selected={selected}
        width={Number(width) || 0}
        height={height != null ? Number(height) : null}
        align={align}
        imgRef={imgRef}
        onWidthCommit={onWidthCommit}
        onAlign={onAlign}
        remove={deleteNode}
      />
    </NodeViewWrapper>
  );
}

export const WriterImage = Image.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      width: { default: null },
      height: { default: null },
      textAlign: { default: null },
    };
  },
  renderHTML({ HTMLAttributes }) {
    // keep the visual model in the DOM (export re-reads these attrs)
    const { textAlign, ...rest } = HTMLAttributes as Record<string, any>;
    const style: string[] = [];
    if (rest.width) style.push(`width:${rest.width}px`);
    if (rest.height) style.push(`height:${rest.height}px`);
    return ["img", mergeAttributes(rest, { style: style.join(";") || undefined, "data-align": textAlign || undefined })];
  },
  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (el) => {
          const dom = el as HTMLImageElement;
          const num = (v: string | null): number | null => {
            if (!v) return null;
            const n = parseInt(v, 10);
            return Number.isFinite(n) && n > 0 ? n : null;
          };
          return {
            width: num(dom.getAttribute("data-width") || dom.style.width || dom.getAttribute("width")),
            height: num(dom.getAttribute("data-height") || dom.style.height || dom.getAttribute("height")),
            textAlign: dom.getAttribute("data-align") || null,
          };
        },
      },
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(WriterImageView);
  },
  addCommands() {
    return {
      ...(this.parent?.() ?? {}),
      setImageSize: (attrs: { width: number; height?: number | null }) => (props: CommandProps) => {
        const { state, tr, view } = props;
        const { selection } = state;
        if (selection.empty) return false;
        const node = state.doc.nodeAt(selection.from);
        if (!node || node.type.name !== "image") return false;
        view.dispatch(
          tr.setNodeMarkup(selection.from, undefined, {
            ...node.attrs,
            width: attrs.width,
            height: attrs.height ?? null,
          }),
        );
        return true;
      },
    } as never;
  },
});

// ── Review tools: comments + tracked insert/delete marks (Word-like) ────
// Marks survive round-trips (rendered as data-* spans) and are exported to
// DOCX as real Word comments / tracked deletions by the writer_docx service.

export interface WriterComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

let commentCounter = 0;

export const WriterCommentMark = Node.create({
  name: "writerCommentMark",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      commentId: { default: null },
      author: { default: "" },
      body: { default: "" },
      createdAt: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({
      class: "writer-comment-mark",
      "data-comment-id": HTMLAttributes.commentId,
      title: `${HTMLAttributes.author}: ${HTMLAttributes.body}`,
    })];
  },
  renderText() {
    return "";
  },
  addCommands() {
    return {
      addWriterComment: (author: string, body: string) => (props: CommandProps) => {
        const { state, view } = props;
        const { from, to } = state.selection;
        commentCounter += 1;
        const id = `c-${Date.now()}-${commentCounter}`;
        const mark = state.schema.nodes.writerCommentMark.create({
          commentId: id, author, body, createdAt: new Date().toISOString(),
        });
        const tr = state.tr;
        // inline atom at the END of the selection (Word-style anchor marker)
        tr.insert(Math.min(to, state.doc.content.size), mark);
        view.dispatch(tr);
        return true;
      },
    } as never;
  },
});

export const TrackInsertMark = Mark.create({
  name: "trackInsert",
  inclusive: false,
  parseHTML() {
    return [{ tag: "ins[data-track]" }];
  },
  renderHTML() {
    return ["ins", { "data-track": "insert" }, 0];
  },
});

export const TrackDeleteMark = Mark.create({
  name: "trackDelete",
  inclusive: false,
  excludes: "",
  parseHTML() {
    return [{ tag: "del[data-track]" }];
  },
  renderHTML() {
    return ["del", { "data-track": "delete" }, 0];
  },
});

export type { PMMark };
