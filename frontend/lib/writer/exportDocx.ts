/**
 * Writer v2 — client-side DOCX export.
 *
 * Maps the TipTap ProseMirror JSON + WriterSettings onto a real .docx
 * (Office Open XML) via the `docx` npm package: heading/paragraph styles,
 * inline marks (bold/italic/underline/strike/sub/sup/highlight/color/font/
 * size), alignment, line spacing, indent, borders & shading, bullet +
 * numbered lists, tables (with header row), base64 images, page breaks,
 * page size/orientation/margins, section columns (1/2/3 with divider +
 * spacing), line numbering, headers/footers and page numbers. Floating
 * boxes export as framed paragraphs (best effort).
 */
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun,
  LevelFormat, PageBreak, PageNumber, Packer, Paragraph, ShadingType, Table,
  TableCell, TableRow, TextRun, VerticalAlign, WidthType, convertMillimetersToTwip,
} from "docx";
import type { IParagraphOptions, ISectionPropertiesOptions } from "docx";
import type { ParagraphChild } from "docx";
import type { WriterSettings } from "./settings";
import { PAGE_SIZES, MM_TO_PX, PX_TO_TWIP } from "./settings";

type JsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

type DocxBlock = Paragraph | Table;

// ── helpers ─────────────────────────────────────────────────────────────

const HEADINGS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
};

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

function ptToHalfPoints(pt: number) {
  return Math.round(pt * 2);
}

function pxToTwip(px: number) {
  return Math.round(px * PX_TO_TWIP);
}

function pxToMm(px: number) {
  return px / MM_TO_PX;
}

function hex(c?: string | null): string | undefined {
  if (!c) return undefined;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(c.trim());
  return m ? m[1].toUpperCase() : undefined;
}

interface MarkInfo {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  subScript?: boolean;
  superScript?: boolean;
  highlight?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: number; // half-points
  link?: string;
}

function collectMarks(node: JsonNode): MarkInfo {
  const info: MarkInfo = {};
  for (const m of node.marks || []) {
    switch (m.type) {
      case "bold": info.bold = true; break;
      case "italic": info.italics = true; break;
      case "underline": info.underline = true; break;
      case "strike": info.strike = true; break;
      case "subscript": info.subScript = true; break;
      case "superscript": info.superScript = true; break;
      case "highlight": info.highlight = hex((m.attrs?.color as string) || "FFFF00"); break;
      case "color": info.color = hex(m.attrs?.color as string); break;
      case "fontFamily": info.fontFamily = (m.attrs?.fontFamily as string) || undefined; break;
      case "fontSize": {
        const raw = m.attrs?.fontSize;
        const pt = typeof raw === "number" ? raw : parseFloat(String(raw || "11"));
        if (Number.isFinite(pt)) info.fontSize = ptToHalfPoints(pt);
        break;
      }
      case "link": info.link = (m.attrs?.href as string) || undefined; break;
      default: break;
    }
  }
  return info;
}

type RunOpts = NonNullable<ConstructorParameters<typeof TextRun>[0]>;

function runsFromInline(node: JsonNode): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  for (const child of node.content || []) {
    if (child.type === "hardBreak") {
      runs.push(new TextRun({ break: 1 }));
      continue;
    }
    if (child.type === "image") {
      runs.push(...imageRuns(child));
      continue;
    }
    if (child.text !== undefined) {
      const m = collectMarks(child);
      const opts: RunOpts = {
        text: child.text,
        bold: m.bold,
        italics: m.italics,
        underline: m.underline ? {} : undefined,
        strike: m.strike,
        subScript: m.subScript,
        superScript: m.superScript,
        color: m.color,
        font: m.fontFamily,
        size: m.fontSize,
        // Word's w:highlight only accepts preset names — arbitrary hex
        // colors go through run shading instead.
        ...(m.highlight ? { shading: { type: ShadingType.CLEAR, fill: m.highlight } } : {}),
      };
      if (m.link) {
        runs.push(
          new ExternalHyperlink({
            link: m.link,
            children: [new TextRun({ ...opts, style: "Hyperlink" })],
          }),
        );
      } else {
        runs.push(new TextRun(opts));
      }
    }
  }
  return runs;
}

function imageRuns(node: JsonNode): ParagraphChild[] {
  const src = String(node.attrs?.src || "");
  const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(src);
  if (!m) return [];
  const fmt = m[1].toLowerCase() === "jpeg" ? "jpg" : (m[1].toLowerCase() as "png" | "jpg" | "gif" | "bmp");
  const w = Number(node.attrs?.width) || 300;
  const h = Number(node.attrs?.height) || Math.round(w * 0.66);
  return [
    new ImageRun({
      type: fmt,
      data: m[2],
      transformation: { width: Math.min(w, 600), height: Math.min(h, 800) },
    }),
  ];
}

// ── paragraph-level mapping ─────────────────────────────────────────────

function bulletLevelChar(style: string, level: number): string {
  const chars: Record<string, string[]> = {
    disc: ["●", "○", "■"],
    circle: ["○", "●", "■"],
    square: ["■", "□", "▪"],
  };
  return (chars[style] || chars.disc)[level % 3];
}

function numberingLevelText(style: string, level: number): string {
  const fmts: Record<string, string[]> = {
    decimal: ["%1.", "%2.", "%3."],
    lowerLetter: ["%1)", "%2)", "%3)"],
    lowerRoman: ["%1.", "%2.", "%3."],
  };
  return (fmts[style] || fmts.decimal)[Math.min(level, 2)];
}

function numberingFormat(style: string): (typeof LevelFormat)[keyof typeof LevelFormat] {
  switch (style) {
    case "lowerLetter": return LevelFormat.LOWER_LETTER;
    case "lowerRoman": return LevelFormat.LOWER_ROMAN;
    case "upperLetter": return LevelFormat.UPPER_LETTER;
    case "upperRoman": return LevelFormat.UPPER_ROMAN;
    default: return LevelFormat.DECIMAL;
  }
}

function buildNumberingConfig(bullet: string, number: string) {
  return [
    {
      reference: `writer-bullets-${bullet}`,
      levels: [0, 1, 2].map((lv) => ({
        level: lv,
        format: LevelFormat.BULLET,
        text: bulletLevelChar(bullet, lv),
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: pxToTwip(36 * (lv + 1)), hanging: 260 } } },
      })),
    },
    {
      reference: `writer-numbers-${number}`,
      levels: [0, 1, 2].map((lv) => ({
        level: lv,
        format: numberingFormat(number),
        text: numberingLevelText(number, lv),
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: pxToTwip(36 * (lv + 1)), hanging: 260 } } },
      })),
    },
  ];
}

interface Ctx {
  settings: WriterSettings;
  bulletStyle: string;
  numberStyle: string;
  listDepth: number;
  currentList: string;
}

function paragraphOpts(node: JsonNode): IParagraphOptions {
  const attrs = node.attrs || {};
  const align = ALIGN[(attrs.textAlign as string) || "left"];
  const indentPx = Number(attrs.indent || 0);
  const borders = attrs.borders as string | undefined;
  const shading = attrs.shading as string | undefined;

  const pb = { style: BorderStyle.SINGLE, size: 6, color: "64748B" };
  const border: Record<string, object> = {};
  if (borders === "top" || borders === "topbottom" || borders === "box") border.top = pb;
  if (borders === "bottom" || borders === "topbottom" || borders === "box") border.bottom = pb;
  if (borders === "box") { border.left = pb; border.right = pb; }

  const lh = parseFloat(String(attrs.lineHeight || "1.6"));
  return {
    alignment: align,
    spacing: { line: Number.isFinite(lh) ? Math.round(lh * 240) : undefined },
    indent: indentPx ? { left: pxToTwip(indentPx) } : undefined,
    border: Object.keys(border).length ? border : undefined,
    shading: shading && hex(shading) ? { type: ShadingType.CLEAR, fill: hex(shading) } : undefined,
  };
}

function tableFromNode(node: JsonNode, ctx: Ctx): Table {
  const rows = (node.content || []).filter((r) => r.type === "tableRow");
  const colCount = rows.reduce((mx, r) => Math.max(mx, (r.content || []).length), 1);
  const docRows = rows.map((row, ri) => {
    const cells = (row.content || []).filter(
      (c) => c.type === "tableHeader" || c.type === "tableCell",
    );
    return new TableRow({
      tableHeader: ri === 0 && cells[0]?.type === "tableHeader",
      children: cells.map(
        (cell) =>
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            shading:
              cell.type === "tableHeader"
                ? { type: ShadingType.CLEAR, fill: "F1F5F9" }
                : undefined,
            children: (cell.content || [])
              .map((block) => blockTypeToDocx(block, ctx))
              .filter((b): b is Paragraph => b instanceof Paragraph),
          }),
      ),
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: Array.from({ length: colCount }, () => Math.floor(9360 / colCount)),
    rows: docRows,
  });
}

function floatingBoxToParagraph(node: JsonNode): Paragraph {
  const attrs = node.attrs || {};
  const text = String(attrs.text || "");
  const kind = String(attrs.kind || "textbox");
  const size = ptToHalfPoints(Number(attrs.fontSize || 14));
  const color = hex(attrs.color as string) || "0F172A";
  const frameOpts = {
    type: "absolute" as const,
    position: { x: pxToTwip(Number(attrs.x || 0)), y: pxToTwip(Number(attrs.y || 0)) },
    width: pxToTwip(Number(attrs.w || 240)),
    height: pxToTwip(Number(attrs.h || 100)),
    anchor: { horizontal: "page" as const, vertical: "page" as const },
    wrap: "around" as const,
  };

  if (kind === "wordart") {
    return new Paragraph({
      frame: frameOpts,
      alignment: ALIGN[(attrs.align as string) || "left"],
      children: [new TextRun({ text: text || "WordArt", bold: true, size: Math.max(size, 48), color })],
    });
  }
  if (kind === "rect" || kind === "ellipse" || kind === "arrow" || kind === "star") {
    const fill = hex(attrs.fill as string);
    return new Paragraph({
      frame: frameOpts,
      shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
      children: [new TextRun("")],
    });
  }
  return new Paragraph({
    frame: frameOpts,
    alignment: ALIGN[(attrs.align as string) || "left"],
    border: attrs.border
      ? {
          top: { style: BorderStyle.SINGLE, size: 4, color: "64748B" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "64748B" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "64748B" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "64748B" },
        }
      : undefined,
    children: [
      new TextRun({ text, size, color, font: (attrs.font as string) || undefined }),
    ],
  });
}

function blockTypeToDocx(node: JsonNode, ctx: Ctx): DocxBlock | DocxBlock[] {
  switch (node.type) {
    case "heading": {
      const level = Math.min(4, Math.max(1, Number(node.attrs?.level || 1)));
      const runs = runsFromInline(node);
      if (!runs.length) runs.push(new TextRun(""));
      return new Paragraph({
        heading: HEADINGS[level],
        alignment: ALIGN[(node.attrs?.textAlign as string) || "left"],
        children: runs,
      });
    }
    case "paragraph": {
      const runs = runsFromInline(node);
      if (!runs.length) runs.push(new TextRun(""));
      return new Paragraph({ ...paragraphOpts(node), children: runs });
    }
    case "blockquote":
      return new Paragraph({
        ...paragraphOpts(node),
        indent: { left: pxToTwip(36 + Number(node.attrs?.indent || 0)) },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: "94A3B8", space: 12 } },
        children: (node.content || []).flatMap((p) => runsFromInline(p)),
      });
    case "codeBlock": {
      const code = (node.content || []).map((c) => c.text || "").join("\n");
      return new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
        children: [new TextRun({ text: code, font: "Consolas", size: ptToHalfPoints(10) })],
      });
    }
    case "horizontalRule":
      return new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8", space: 4 } },
        children: [],
      });
    case "image":
      return new Paragraph({ children: imageRuns(node) });
    case "pageBreak":
      return new Paragraph({ children: [new PageBreak()] });
    case "bulletList":
    case "orderedList":
      return (node.content || [])
        .filter((li) => li.type === "listItem")
        .flatMap((li) => listItemToDocx(li, ctx));
    case "table":
      return tableFromNode(node, ctx);
    case "floatingBox":
      return floatingBoxToParagraph(node);
    default: {
      const runs = runsFromInline(node);
      if (!runs.length) return new Paragraph("");
      return new Paragraph({ children: runs });
    }
  }
}

function listItemToDocx(li: JsonNode, ctx: Ctx): DocxBlock[] {
  const out: DocxBlock[] = [];
  for (const child of li.content || []) {
    if (child.type === "paragraph") {
      const runs = runsFromInline(child);
      if (!runs.length) runs.push(new TextRun(""));
      const base = paragraphOpts(child);
      const depth = Math.min(Math.max(ctx.listDepth - 1, 0), 2);
      out.push(
        new Paragraph({
          ...base,
          numbering:
            ctx.currentList === "bulletList"
              ? { reference: `writer-bullets-${ctx.bulletStyle}`, level: depth }
              : { reference: `writer-numbers-${ctx.numberStyle}`, level: depth },
          children: runs,
        }),
      );
    } else if (child.type === "bulletList" || child.type === "orderedList") {
      out.push(...listToDocx(child, ctx));
    } else {
      const blk = blockTypeToDocx(child, ctx);
      if (blk) out.push(...(Array.isArray(blk) ? blk : [blk]));
    }
  }
  return out;
}

function listToDocx(list: JsonNode, ctx: Ctx): DocxBlock[] {
  ctx.listDepth += 1;
  ctx.currentList = list.type || "bulletList";
  const out: DocxBlock[] = [];
  for (const li of (list.content || []).filter((n) => n.type === "listItem")) {
    out.push(...listItemToDocx(li, ctx));
  }
  ctx.listDepth -= 1;
  return out;
}

// ── section + document assembly ─────────────────────────────────────────

function sectionProps(settings: WriterSettings): ISectionPropertiesOptions {
  const def = PAGE_SIZES[settings.pageSize] ?? PAGE_SIZES.A4;
  const portrait = settings.orientation === "portrait";
  const widthMm = portrait ? def.wMm : def.hMm;
  const heightMm = portrait ? def.hMm : def.wMm;

  const props: Record<string, unknown> = {
    page: {
      size: {
        width: convertMillimetersToTwip(widthMm),
        height: convertMillimetersToTwip(heightMm),
        orientation: portrait ? "portrait" : "landscape",
      },
      margin: {
        top: convertMillimetersToTwip(pxToMm(settings.marginTop)),
        right: convertMillimetersToTwip(pxToMm(settings.marginRight)),
        bottom: convertMillimetersToTwip(pxToMm(settings.marginBottom)),
        left: convertMillimetersToTwip(pxToMm(settings.marginLeft)),
      },
    },
  };
  if (settings.columns > 1) {
    props.column = {
      count: settings.columns,
      space: convertMillimetersToTwip(pxToMm(settings.columnSpacing)),
      separate: settings.columnDivider,
    };
  }
  if (settings.lineNumbers) {
    props.lineNumbers = { countBy: 1, restart: "continuous" };
  }
  return props as ISectionPropertiesOptions;
}

function buildHeaderFooter(settings: WriterSettings) {
  const header = settings.headerOn
    ? new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8", space: 4 } },
            children: [new TextRun({ text: settings.headerText || "", size: 18, color: "64748B" })],
          }),
        ],
      })
    : undefined;

  const footerChildren: Paragraph[] = [];
  if (settings.footerOn && settings.footerText) {
    footerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: settings.footerText, size: 18, color: "64748B" })],
      }),
    );
  }
  if (settings.pageNumber !== "none") {
    const pos = settings.pageNumber.split("-")[1] as "left" | "center" | "right";
    footerChildren.push(
      new Paragraph({
        alignment:
          pos === "center" ? AlignmentType.CENTER : pos === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [
          new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 18 }),
        ],
      }),
    );
  }
  const footer = footerChildren.length ? new Footer({ children: footerChildren }) : undefined;
  return { header, footer };
}

export interface ExportInput {
  doc: JsonNode;
  settings: WriterSettings;
  title: string;
}

/** Build the .docx Blob from the editor JSON + settings. Throws on failure. */
export async function exportDocx(input: ExportInput): Promise<Blob> {
  const { doc, settings } = input;
  const ctx: Ctx = { settings, bulletStyle: "disc", numberStyle: "decimal", listDepth: 0, currentList: "bulletList" };
  const { header, footer } = buildHeaderFooter(settings);

  const body: DocxBlock[] = [];
  for (const block of doc.content || []) {
    const mapped = blockTypeToDocx(block, ctx);
    if (Array.isArray(mapped)) body.push(...mapped);
    else body.push(mapped);
  }
  if (!body.length) body.push(new Paragraph(""));

  const docxFile = new Document({
    title: input.title,
    numbering: { config: buildNumberingConfig(ctx.bulletStyle, ctx.numberStyle) },
    styles: {
      default: {
        document: {
          run: { font: settings.font, size: ptToHalfPoints(settings.fontSize) },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: sectionProps(settings),
        headers: header ? { default: header } : undefined,
        footers: footer ? { default: footer } : undefined,
        children: body,
      },
    ],
  });

  return Packer.toBlob(docxFile);
}

/** Trigger a browser download for a generated blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function slugifyName(name: string) {
  return name.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9._-]/g, "") || "document";
}
