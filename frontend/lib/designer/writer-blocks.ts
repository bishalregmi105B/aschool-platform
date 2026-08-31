"use client";

/**
 * writerBlocksToHTML — legacy loader: converts the seeded writer_json block
 * format to TipTap-compatible HTML for the v2 writer. Old saved docs
 * ({type:"writer", html}) keep their raw HTML path.
 *
 * Block types: heading, paragraph, divider, spacer, table, columns,
 * signature, header_band, footer_band, subject_rows, subject_rows_neb, fee_rows.
 */

export function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** `**bold**` inline markdown → <strong> */
function md(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function subjectRowsPreview(): string {
  return (
    "<table><thead><tr><th>Subject</th><th>Th. Full</th><th>Th. Obt.</th>" +
    "<th>Pr. Full</th><th>Pr. Obt.</th><th>Total</th><th>Grade</th><th>Result</th></tr></thead>" +
    "<tbody><tr><td>{subject} — data fills at render time</td>" +
    "<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr></tbody></table>"
  );
}

function nebRowsPreview(): string {
  return (
    "<table><thead><tr><th>SUBJECTS</th><th>CREDIT HOUR</th><th>GRADE</th>" +
    "<th>GRADE POINT</th><th>FINAL GRADE</th></tr></thead>" +
    "<tbody><tr><td>{subject} (TH) — fills at render time</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>" +
    "<tr><td>{subject} (IN)</td><td>—</td><td>—</td><td>—</td></tr></tbody></table>"
  );
}

function feeRowsPreview(): string {
  return (
    "<table><thead><tr><th>Particulars</th><th>Billed (Rs.)</th><th>Paid (Rs.)</th><th>Due (Rs.)</th></tr></thead>" +
    "<tbody><tr><td>{fee item — fills at render time}</td><td>—</td><td>—</td><td>—</td></tr></tbody></table>"
  );
}

/** writer_json {config, blocks} → HTML string for TipTap setContent. */
export function writerBlocksToHTML(writerData: {
  config?: Record<string, unknown>;
  blocks?: Array<Record<string, unknown>>;
}): string {
  if (!writerData || !Array.isArray(writerData.blocks)) return "";
  const parts: string[] = [];

  for (const block of writerData.blocks) {
    const type = block?.type;
    switch (type) {
      case "header_band":
        parts.push(
          `<div data-band="header" style="background:${esc(block.bg ?? "#0e3b2e")};color:${esc(block.color ?? "#fff")};text-align:center;padding:12px 16px;">` +
          `<h1 style="margin:0;font-size:20pt;">${md(String(block.school ?? ""))}</h1>` +
          `<p style="margin:2px 0 0;font-size:9pt;">${md(String(block.subtitle ?? ""))}</p>` +
          (block.tagline ? `<p style="margin:1px 0 0;font-size:8pt;font-style:italic;">${md(String(block.tagline))}</p>` : "") +
          `</div>`,
        );
        break;
      case "footer_band":
        parts.push(
          `<div data-band="footer" style="background:${esc(block.bg ?? "#0e3b2e")};color:${esc(block.color ?? "#fff")};text-align:center;padding:8px 16px;font-size:8.5pt;">${md(String(block.text ?? ""))}</div>`,
        );
        break;
      case "heading": {
        const level = Math.min(4, Math.max(1, Number(block.level) || 1));
        parts.push(
          `<h${level} style="text-align:${esc(block.align ?? "center")};color:${esc(block.color ?? "#1e293b")};${block.bold === false ? "" : "font-weight:700;"}">${md(String(block.text ?? ""))}</h${level}>`,
        );
        break;
      }
      case "paragraph":
        parts.push(
          `<p style="text-align:${esc(block.align ?? "left")};color:${esc(block.color ?? "#334155")};${block.fontSize ? `font-size:${esc(block.fontSize)}pt;` : ""}">${md(String(block.text ?? ""))}</p>`,
        );
        break;
      case "divider":
        parts.push("<hr />");
        break;
      case "spacer":
        parts.push(`<div style="height:${Number(block.height) || 20}px;"></div>`);
        break;
      case "table": {
        const headers = Array.isArray(block.headers) ? block.headers : [];
        const rows = Array.isArray(block.rows) ? block.rows : [];
        const thead = headers.length
          ? `<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`
          : "";
        const tbody = rows
          .map((r) => `<tr>${(Array.isArray(r) ? r : []).map((c) => `<td>${md(String(c ?? ""))}</td>`).join("")}</tr>`)
          .join("");
        parts.push(`<table>${thead}<tbody>${tbody}</tbody></table>`);
        break;
      }
      case "columns": {
        const cols = Array.isArray(block.columns) ? block.columns : [];
        parts.push(
          `<div data-columns style="display:flex;gap:24px;">` +
          cols
            .map((c) => `<div style="flex:1;text-align:${esc(c.align ?? "left")};">${md(String(c.text ?? ""))}</div>`)
            .join("") +
          `</div>`,
        );
        break;
      }
      case "signature":
        parts.push(
          `<div data-signatures style="display:flex;justify-content:space-between;margin-top:48px;">` +
          (Array.isArray(block.labels) ? block.labels : ["Prepared by", "Checked by", "Approved by"])
            .map(
              (l) =>
                `<div style="text-align:center;min-width:140px;"><div style="border-top:1px solid #334155;margin-top:40px;padding-top:4px;font-size:9pt;">${esc(l)}</div></div>`,
            )
            .join("") +
          `</div>`,
        );
        break;
      case "subject_rows":
        parts.push(subjectRowsPreview());
        break;
      case "subject_rows_neb":
        parts.push(nebRowsPreview());
        break;
      case "fee_rows":
        parts.push(feeRowsPreview());
        break;
      default:
        break;
    }
  }
  return parts.join("\n");
}
