/**
 * Legacy writer → writer2 (TipTap / ProseMirror) document converter.
 *
 * Writer templates are seeded as `writer_json` = {type:"writer", config, blocks}
 * (the OLD block-based writer format). The old loader (`writerBlocksToHTML`)
 * emitted styled <div> soup that StarterKit's schema silently stripped —
 * an opened "NEB Marksheet" template rendered as a couple of plain
 * paragraphs while its thumbnail showed a rich document.
 *
 * This converter builds ProseMirror JSON directly against the writer2 schema:
 *   paragraphs/headings with {textAlign, color}, textStyle marks
 *   {fontSize, color}, horizontalRule, pageBreak, tables (th/td, colSpan),
 *   hardBreak spacers and .writer-token chips for {token} placeholders.
 *
 * It also converts the legacy config {size, font, fontSize, orientation,
 * margins} to WriterSettings (pageSize, pt-fontSize, px margins) so the
 * page setup (paper size, font, margins) matches the template design.
 */
import type { WriterSettings } from "@/lib/writer/settings";

// ── minimal ProseMirror JSON helpers ────────────────────────────────────

type Attrs = Record<string, unknown>;
export type PMNode = { type: string; attrs?: Attrs; content?: PMNode[]; marks?: Mark[]; text?: string };
type Mark = { type: string; attrs?: Attrs };

function text(value: string, marks?: Mark[]): PMNode {
  const t: PMNode = { type: "text", text: value };
  if (marks?.length) t.marks = marks;
  return t;
}

function blockquote(children: PMNode[]): PMNode {
  return { type: "blockquote", content: children };
}

function bulletList(items: string[]): PMNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraphFromText(item)],
    })),
  };
}

/**
 * Parse "**bold**" inline markdown + `{token}` placeholders into text nodes
 * with marks. Tokens become .writer-token chips (same markup the writer
 * inserts via the token bar) so they data-fill and render on the server.
 */
function inlineRuns(raw: string, base: Mark[] = []): PMNode[] {
  const runs: PMNode[] = [];

  // split into bold segments first, then tokens inside each segment
  const boldParts = String(raw ?? "").split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const part of boldParts) {
    const isBold = part.startsWith("**") && part.endsWith("**") && part.length > 4;
    const body = isBold ? part.slice(2, -2) : part;
    const marks = isBold ? [...base, { type: "bold" }] : base;

    const tokenParts = body.split(/(\{[^{}]+\})/g).filter(Boolean);
    for (const tp of tokenParts) {
      if (!tp) continue;
      if (/^\{[^{}]+\}$/.test(tp)) {
        // token chip: highlight + bold so it reads as a fillable placeholder
        // (the backend fills {token} strings at render time; the highlight
        // is styled by the editor's .writer-token CSS via the mark output)
        runs.push({
          type: "text",
          text: tp,
          marks: [...marks, { type: "highlight", attrs: { color: "#e0f2fe" } }],
        });
      } else if (tp) {
        runs.push(text(tp, marks.length ? marks : undefined));
      }
    }
  }
  return runs;
}

function paragraphFromText(raw: string, attrs?: Attrs, marks?: Mark[]): PMNode {
  const content = inlineRuns(raw, marks ?? []);
  const p: PMNode = { type: "paragraph" };
  if (attrs && Object.keys(attrs).length) p.attrs = attrs;
  if (content.length) p.content = content;
  return p;
}

function heading(textStr: string, level: number, attrs?: Attrs, marks?: Mark[]): PMNode {
  const h: PMNode = {
    type: "heading",
    attrs: { level, ...(attrs || {}) },
    content: inlineRuns(textStr, marks ?? []),
  };
  return h;
}

function tableCell(children: PMNode[], attrs?: Attrs): PMNode {
  const c: PMNode = { type: "tableCell" };
  if (attrs && Object.keys(attrs).length) c.attrs = attrs;
  if (children.length) c.content = children;
  return c;
}

// ── data-driven table previews (match the backend _render_writer_html) ──

function marksTable(): PMNode {
  const header = ["Subject", "Th. Full", "Th. Obt.", "Pr. Full", "Pr. Obt.", "Total", "Grade", "Result"];
  const row = ["{subject}", "—", "—", "—", "—", "—", "—", "—"];
  return table(header, [row]);
}

function nebTable(): PMNode {
  const header = ["SUBJECTS", "CREDIT HOUR", "GRADE", "GRADE POINT", "FINAL GRADE"];
  const rows = [
    ["{subject} (TH)", "—", "—", "—", "—"],
    ["{subject} (IN)", "—", "—", "—", ""],
  ];
  return table(header, rows);
}

function feeTable(): PMNode {
  const header = ["Particulars", "Billed (Rs.)", "Paid (Rs.)", "Due (Rs.)"];
  const rows = [["{fee_item}", "—", "—", "—"]];
  return table(header, rows);
}

function table(headers: string[], rows: string[][]): PMNode {
  const content: PMNode[] = [];
  if (headers.length) {
    content.push({
      type: "tableRow",
      content: headers.map((h) => ({
        type: "tableHeader",
        content: [paragraphFromText(h, { textAlign: "center" }, [{ type: "bold" }])],
      })),
    });
  }
  for (const r of rows) {
    content.push({
      type: "tableRow",
      content: r.map((cell) => tableCell([paragraphFromText(cell)])),
    });
  }
  return { type: "table", content };
}

// ── main converter ──────────────────────────────────────────────────────

/**
 * Convert legacy writer_json {config, blocks} → a writer2 document
 * {doc: ProseMirrorJSON, settings: Partial<WriterSettings>}.
 *
 * Unknown block types are kept best-effort as paragraphs with their text
 * content (never crash, never silently drop text).
 */
export function writerJsonToWriterDoc(writerData: {
  config?: Record<string, unknown>;
  blocks?: Array<Record<string, unknown>>;
}): { doc: PMNode; settings: Partial<WriterSettings> } {
  const blocks = Array.isArray(writerData?.blocks) ? writerData.blocks : [];
  const content: PMNode[] = [];

  const pushSpacer = (heightPx: number) => {
    const lines = Math.max(1, Math.round(heightPx / 16));
    const brs: PMNode[] = [];
    for (let i = 0; i < lines; i++) brs.push({ type: "hardBreak" });
    content.push({ type: "paragraph", content: brs });
  };

  for (const block of blocks) {
    const type = String(block?.type ?? "");
    switch (type) {
      case "header_band": {
        // colored band: centered school / subtitle / tagline — use the
        // paragraph shading attr so the band survives save round-trips
        const bg = String(block.bg ?? "#0e3b2e");
        const fg = String(block.color ?? "#ffffff");
        content.push(
          paragraphFromText(String(block.school ?? ""), { textAlign: "center", shading: bg }, [
            { type: "bold" },
            { type: "textStyle", attrs: { fontSize: "20pt", color: fg } },
          ]),
        );
        if (block.subtitle) {
          content.push(
            paragraphFromText(String(block.subtitle), { textAlign: "center", shading: bg }, [
              { type: "textStyle", attrs: { fontSize: "10pt", color: fg } },
            ]),
          );
        }
        if (block.tagline) {
          content.push(
            paragraphFromText(String(block.tagline), { textAlign: "center", shading: bg }, [
              { type: "bold" },
              { type: "textStyle", attrs: { fontSize: "11pt", color: fg } },
            ]),
          );
        }
        break;
      }
      case "footer_band": {
        const bg = String(block.bg ?? "#1e293b");
        const fg = String(block.color ?? "#94a3b8");
        content.push(
          paragraphFromText(String(block.text ?? ""), { textAlign: "center", shading: bg }, [
            { type: "textStyle", attrs: { fontSize: "8.5pt", color: fg } },
          ]),
        );
        break;
      }
      case "heading": {
        const level = Math.min(4, Math.max(1, Number(block.level) || 1));
        const align = String(block.align ?? "center");
        const color = String(block.color ?? "#1e293b");
        content.push(
          heading(String(block.text ?? ""), level, { textAlign: align }, [
            ...(block.bold === false ? [] : [{ type: "bold" } as Mark]),
            { type: "textStyle", attrs: { color } },
          ]),
        );
        break;
      }
      case "paragraph": {
        const align = String(block.align ?? "left");
        const color = String(block.color ?? "#334155");
        const marks: Mark[] = [];
        if (block.color) marks.push({ type: "textStyle", attrs: { color } });
        if (block.bold) marks.push({ type: "bold" });
        if (block.italic) marks.push({ type: "italic" });
        const attrs: Attrs = { textAlign: align };
        // per-block font size survives as a textStyle mark on the text runs
        let runs: PMNode[];
        if (block.fontSize) {
          const fs = Number(block.fontSize);
          runs = inlineRuns(String(block.text ?? ""), [
            ...marks,
            { type: "textStyle", attrs: { fontSize: `${Number.isFinite(fs) ? fs : 12}pt` } },
          ]);
          content.push({ type: "paragraph", attrs, content: runs });
        } else {
          content.push(paragraphFromText(String(block.text ?? ""), attrs, marks));
        }
        break;
      }
      case "divider":
        content.push({ type: "horizontalRule" });
        break;
      case "spacer":
        pushSpacer(Number(block.height) || 20);
        break;
      case "table": {
        const headers = Array.isArray(block.headers) ? (block.headers as unknown[]) : [];
        const rows = Array.isArray(block.rows) ? (block.rows as unknown[][]) : [];
        content.push(
          table(
            headers.map((h) => String(h ?? "")),
            rows.map((r) => (Array.isArray(r) ? r : []).map((c) => String(c ?? ""))),
          ),
        );
        break;
      }
      case "columns": {
        // legacy flex columns → one line with "   •   " separators keeps the
        // information on a single visual row without a custom node type
        const cols = Array.isArray(block.columns) ? (block.columns as Array<Record<string, unknown>>) : [];
        const joined = cols.map((c) => String(c.text ?? "").trim()).filter(Boolean).join("    •    ");
        if (joined) content.push(paragraphFromText(joined));
        break;
      }
      case "signature": {
        const labels = Array.isArray(block.labels)
          ? (block.labels as unknown[])
          : ["Prepared by", "Checked by", "Approved by"];
        pushSpacer(48);
        content.push(paragraphFromText(labels.map(() => "____________________").join("        ")));
        content.push(paragraphFromText(labels.map((l) => String(l)).join("        ")));
        break;
      }
      case "subject_rows":
        content.push(marksTable());
        break;
      case "subject_rows_neb":
        content.push(nebTable());
        break;
      case "fee_rows":
        content.push(feeTable());
        break;
      case "section_header": {
        content.push(
          paragraphFromText(String(block.text ?? ""), { shading: "#0f172a" }, [
            { type: "bold" },
            { type: "textStyle", attrs: { color: "#ffffff", fontSize: "10.5pt" } },
          ]),
        );
        break;
      }
      case "question": {
        const number = String(block.number ?? "");
        const qText = `${number ? `${number}. ` : ""}${String(block.text ?? "")}${block.marks != null ? `   [${block.marks}]` : ""}`;
        content.push(paragraphFromText(qText));
        const subparts = Array.isArray(block.subparts) ? (block.subparts as Array<Record<string, unknown>>) : [];
        for (const sp of subparts) {
          const spText = `    ${String(sp.label ?? "a")}) ${String(sp.text ?? "")}${sp.marks != null ? `   [${sp.marks}]` : ""}`;
          content.push(paragraphFromText(spText));
        }
        break;
      }
      case "answer_space": {
        const lines = Math.max(0, Number(block.lines) || 4);
        for (let i = 0; i < lines; i++) {
          content.push(paragraphFromText("_______________________________________________"));
        }
        break;
      }
      case "page_break":
        content.push({ type: "pageBreak" });
        break;
      case "checkbox_list": {
        const items = Array.isArray(block.items) ? (block.items as unknown[]) : [];
        content.push(bulletList(items.map((i) => `☐  ${String(i)}`)));
        break;
      }
      default: {
        // best-effort: keep any text-bearing unknown block as a paragraph
        const t = (block as Record<string, unknown>)?.text ?? (block as Record<string, unknown>)?.school;
        if (t) content.push(paragraphFromText(String(t)));
        break;
      }
    }
  }

  if (!content.length) content.push({ type: "paragraph" });

  return {
    doc: { type: "doc", content },
    settings: writerConfigToSettings(writerData?.config),
  };
}

/**
 * Legacy writer config → WriterSettings patch.
 * Legacy keys: {size:"A4", orientation, font:"Arial", fontSize:10 (pt),
 *               margins:{top,right,bottom,left} in mm}
 * writer2 keys: pageSize, orientation, font, fontSize (pt), margins in px.
 */
export function writerConfigToSettings(
  config?: Record<string, unknown> | null,
): Partial<WriterSettings> {
  if (!config || typeof config !== "object") return {};
  const out: Partial<WriterSettings> = {};

  const size = String(config.size ?? config.pageSize ?? "").toUpperCase();
  if (["A4", "A5", "LETTER", "LEGAL"].includes(size)) {
    out.pageSize = (size === "LETTER" ? "Letter" : size === "LEGAL" ? "Legal" : size) as WriterSettings["pageSize"];
  }
  if (config.orientation === "landscape" || config.orientation === "portrait") {
    out.orientation = config.orientation;
  }
  if (typeof config.font === "string" && config.font) out.font = config.font;

  const fs = Number(config.fontSize);
  if (Number.isFinite(fs) && fs > 0) out.fontSize = fs;

  const mm = config.margins as Record<string, unknown> | undefined;
  if (mm && typeof mm === "object") {
    const MM_TO_PX = 96 / 25.4;
    const num = (v: unknown): number | undefined => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    const top = num(mm.top); const right = num(mm.right);
    const bottom = num(mm.bottom); const left = num(mm.left);
    if (top != null) out.marginTop = Math.round(top * MM_TO_PX);
    if (right != null) out.marginRight = Math.round(right * MM_TO_PX);
    if (bottom != null) out.marginBottom = Math.round(bottom * MM_TO_PX);
    if (left != null) out.marginLeft = Math.round(left * MM_TO_PX);
  }
  return out;
}
