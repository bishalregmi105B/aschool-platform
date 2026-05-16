"use client";
/**
 * Writer — full Microsoft Word-like document editor
 * Features: headings, formatting, lists, tables, font size/family, colors,
 *           page settings, headers/footers, columns, PDF export, save
 */
import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { api } from "@/lib/api";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Save, Download, ChevronDown, Undo2, Redo2,
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Minus, Plus, Table, FileJson, Type,
  Subscript, Superscript, RemoveFormatting, Indent, Outdent,
  Palette, Link2, Image as ImageIcon, Scissors,
} from "lucide-react";

// ── Google Fonts ───────────────────────────────────────────────────────────
const GOOGLE_FONTS = [
  "Roboto","Open Sans","Lato","Montserrat","Raleway","Nunito","Poppins",
  "Playfair Display","Merriweather","Source Serif 4","Dancing Script","Lobster",
  "Pacifico","Caveat","Oswald","Ubuntu","PT Sans","Noto Sans","Inter",
  "Space Grotesk","Crimson Text","EB Garamond",
];
const SYSTEM_FONTS = ["Arial","Times New Roman","Georgia","Courier New","Verdana","Tahoma","serif","sans-serif","monospace"];
const ALL_FONTS    = [...SYSTEM_FONTS, ...GOOGLE_FONTS];

const loadedFonts = new Set<string>();
const loadGoogleFont = (family: string) => {
  if (loadedFonts.has(family) || SYSTEM_FONTS.includes(family)) return;
  loadedFonts.add(family);
  const link  = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
  document.head.appendChild(link);
};

// ── Page sizes ─────────────────────────────────────────────────────────────
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4:     { width: 794,  height: 1123 },
  A5:     { width: 559,  height: 794  },
  A3:     { width: 1123, height: 1587 },
  Letter: { width: 816,  height: 1056 },
  Legal:  { width: 816,  height: 1344 },
};

type Orientation = "portrait" | "landscape";
interface Config {
  size: string; orientation: Orientation;
  mt: number; mr: number; mb: number; ml: number;
  bg: string; font: string; fontSize: number;
  showHeader: boolean; showFooter: boolean;
  headerText: string; footerText: string;
}

const DEFAULT_CONFIG: Config = {
  size: "A4", orientation: "portrait",
  mt: 72, mr: 72, mb: 72, ml: 72,
  bg: "#ffffff", font: "Times New Roman", fontSize: 12,
  showHeader: false, showFooter: false,
  headerText: "", footerText: "",
};

// Table insertion helper
function insertTable(rows: number, cols: number) {
  const cellStyle = `border:1px solid #cbd5e1;padding:6px 10px;min-width:60px;min-height:24px;position:relative;`;
  let html = `<table style="border-collapse:collapse;width:100%;margin:8px 0;">`;
  for (let r = 0; r < rows; r++) {
    html += "<tr>";
    for (let c = 0; c < cols; c++) {
      html += r === 0
        ? `<th contenteditable="true" style="${cellStyle}background:#f1f5f9;font-weight:600;">Cell</th>`
        : `<td contenteditable="true" style="${cellStyle}"> </td>`;
    }
    html += "</tr>";
  }
  html += "</table>";
  document.execCommand("insertHTML", false, html);
}

// ── Writer JSON blocks → HTML renderer ────────────────────────────────────
// Renders the structured writer_json blocks into HTML for contentEditable.
// This is the writer's equivalent of the designer loading fabric.js canvas_json.
function writerBlocksToHTML(blocks: any[]): string {
  let html = "";

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const tag = `h${Math.min(Math.max(block.level || 1, 1), 4)}`;
        const styles: string[] = [];
        if (block.align) styles.push(`text-align:${block.align}`);
        if (block.color) styles.push(`color:${block.color}`);
        const s = styles.length ? ` style="${styles.join(";")}"` : "";
        const text = block.bold !== false ? `<strong>${esc(block.text)}</strong>` : esc(block.text);
        html += `<${tag}${s}>${text}</${tag}>\n`;
        break;
      }
      case "paragraph": {
        const styles: string[] = [];
        if (block.align && block.align !== "left") styles.push(`text-align:${block.align}`);
        if (block.color && block.color !== "#334155") styles.push(`color:${block.color}`);
        if (block.fontSize && block.fontSize !== 12) styles.push(`font-size:${block.fontSize}pt`);
        const s = styles.length ? ` style="${styles.join(";")}"` : "";
        let text = esc(block.text || "");
        // Handle **bold** markdown-style in text
        text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        if (block.bold) text = `<strong>${text}</strong>`;
        if (block.italic) text = `<em>${text}</em>`;
        html += `<p${s}>${text}</p>\n`;
        break;
      }
      case "divider": {
        html += `<hr style="border:none;border-top:${block.width || 1}px solid ${block.color || "#334155"};margin:8px 0;" />\n`;
        break;
      }
      case "spacer": {
        html += `<div style="height:${block.height || 20}px"></div>\n`;
        break;
      }
      case "table": {
        const cellStyle = "border:1px solid #cbd5e1;padding:6px 10px;";
        html += `<table style="border-collapse:collapse;width:100%;margin:8px 0;">\n`;
        if (block.headers?.length) {
          html += "<thead><tr>";
          for (const h of block.headers) {
            let text = esc(h);
            text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
            html += `<th style="${cellStyle}background:#f1f5f9;font-weight:600;">${text}</th>`;
          }
          html += "</tr></thead>\n";
        }
        html += "<tbody>";
        for (const row of block.rows || []) {
          html += "<tr>";
          for (const cell of row) {
            let text = esc(cell);
            text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
            html += `<td style="${cellStyle}">${text}</td>`;
          }
          html += "</tr>\n";
        }
        html += "</tbody></table>\n";
        break;
      }
      case "columns": {
        const cols = block.columns || [];
        const pct = Math.floor(100 / cols.length);
        html += `<div style="display:flex;gap:8px;margin:4px 0;">\n`;
        for (const col of cols) {
          const align = col.align || "left";
          let text = esc(col.text || "");
          text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
          html += `<div style="flex:1;text-align:${align};">${text}</div>`;
        }
        html += `</div>\n`;
        break;
      }
      case "signature": {
        const labels = block.labels || [];
        html += `<div style="display:flex;justify-content:space-between;margin-top:16px;">\n`;
        for (const label of labels) {
          html += `<div style="text-align:center;">
            <div style="border-top:1px solid #334155;width:180px;margin:0 auto;"></div>
            <div style="font-size:10pt;color:#64748b;margin-top:4px;">${esc(label)}</div>
          </div>`;
        }
        html += `</div>\n`;
        break;
      }
      case "header_band": {
        html += `<div style="background:${block.bg || "#1e40af"};color:${block.color || "#ffffff"};padding:12px 20px;margin:-72px -72px 12px -72px;text-align:center;">
          <div style="font-size:18pt;font-weight:bold;">${esc(block.school || "")}</div>
          ${block.subtitle ? `<div style="font-size:10pt;opacity:0.85;margin-top:2px;">${esc(block.subtitle)}</div>` : ""}
          ${block.tagline ? `<div style="font-size:11pt;font-weight:bold;margin-top:4px;opacity:0.9;">${esc(block.tagline)}</div>` : ""}
        </div>\n`;
        break;
      }
      case "footer_band": {
        html += `<div style="background:${block.bg || "#1e293b"};color:${block.color || "#94a3b8"};padding:6px 20px;margin:12px -72px -72px -72px;text-align:center;font-size:8pt;">
          ${esc(block.text || "")}
        </div>\n`;
        break;
      }
    }
  }

  return html || "<p>Start typing…</p>";
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function WriterPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const docId        = searchParams.get("doc");
  const templateId   = searchParams.get("template");

  const editorRef  = useRef<HTMLDivElement>(null);
  const pageRef    = useRef<HTMLDivElement>(null);

  const [docName, setDocName] = useState("Untitled Document");
  const [config, setConfig]   = useState<Config>(DEFAULT_CONFIG);
  const [showPagePane, setShowPagePane] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [linkUrl, setLinkUrl]     = useState("");
  const [numPages, setNumPages]   = useState(1);

  // ── Load Google Font whenever config.font changes ─────────────────
  useEffect(() => { loadGoogleFont(config.font); }, [config.font]);

  // ── ResizeObserver: recompute numPages as content grows ───────────
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const d = PAGE_SIZES[config.size] ?? PAGE_SIZES.A4;
    const ph = config.orientation === "landscape" ? d.width : d.height;
    const ro = new ResizeObserver(() => {
      const h = el.scrollHeight;
      setNumPages(n => {
        const next = Math.max(1, Math.ceil(h / ph));
        return next !== n ? next : n;
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [config.size, config.orientation]);

  // ── Load saved document ───────────────────────────────────────────
  useQuery<any>({
    queryKey: ["writer-doc", docId],
    queryFn: async () => { const r = await api.get(`/design-studio/documents/${docId}`); return r.data?.data; },
    enabled: !!docId,
    onSuccess: (data: any) => {
      if (!data) return;
      setDocName(data.name || "Untitled Document");
      const state = data.canvas_state;
      if (state?.type === "writer") {
        if (state.config) setConfig(state.config);
        if (editorRef.current && state.html) editorRef.current.innerHTML = state.html;
      }
    },
  } as any);

  // ── Load template from writer_json (native blocks) ────────────────
  useQuery<any>({
    queryKey: ["writer-template", templateId],
    queryFn: async () => {
      const r = await api.get("/design-studio/templates");
      const all = Array.isArray(r.data?.data) ? r.data.data : [];
      return all.find((t: any) => t.id === templateId) || null;
    },
    enabled: !!templateId && !docId,
    onSuccess: (tpl: any) => {
      if (!tpl) return;
      setDocName(tpl.name || "Untitled Document");

      const writerData = tpl.writer_json;
      if (writerData?.type === "writer") {
        // Apply writer config (font, page size, header/footer)
        if (writerData.config) {
          setConfig(prev => ({ ...prev, ...writerData.config }));
        }
        // Render blocks → HTML
        if (writerData.blocks?.length && editorRef.current) {
          editorRef.current.innerHTML = writerBlocksToHTML(writerData.blocks);
        }
      }
    },
  } as any);

  // ── Save ──────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const html = editorRef.current?.innerHTML || "";
      const payload: any = {
        name: docName,
        template_type: "writer_doc",
        canvas_state: { type: "writer", html, config },
      };
      if (docId) payload.id = docId;
      const r = await api.post("/design-studio/documents", payload);
      return r.data?.data;
    },
    onSuccess: (data) => {
      toast.success("Document saved");
      if (!docId && data?.id) router.replace(`/dashboard/designer/writer?doc=${data.id}`);
    },
    onError: () => toast.error("Failed to save"),
  });

  // ── execCommand shortcut ──────────────────────────────────────────
  const cmd = useCallback((c: string, v?: string) => {
    editorRef.current?.focus();
    document.execCommand(c, false, v);
  }, []);

  // ── Apply font size (replaces the 1-7 size system) ────────────────
  const applyFontSize = useCallback((sz: number) => {
    setConfig(prev => ({ ...prev, fontSize: sz }));
    cmd("fontSize", "7");
    const fonts = editorRef.current?.querySelectorAll('font[size="7"]');
    fonts?.forEach((f) => {
      const span = document.createElement("span");
      span.style.fontSize = `${sz}pt`;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.parentNode?.replaceChild(span, f);
    });
  }, [cmd]);

  // ── Apply font family ─────────────────────────────────────────────
  const applyFont = useCallback((f: string) => {
    loadGoogleFont(f);
    setConfig(prev => ({ ...prev, font: f }));
    cmd("fontName", f);
  }, [cmd]);

  // ── Export PDF (multi-page aware) ────────────────────────────────
  const exportPDF = useCallback(async () => {
    const el = pageRef.current;
    if (!el) return;
    const wasEditable = editorRef.current?.contentEditable;
    if (editorRef.current) editorRef.current.contentEditable = "false";
    try {
      toast.info("Generating PDF…");
      // Capture full content at 2× scale
      const cv = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: config.bg });
      const imgEl = new window.Image();
      imgEl.src = cv.toDataURL("image/png");
      await new Promise<void>(r => { imgEl.onload = () => r(); });

      const d  = PAGE_SIZES[config.size] ?? PAGE_SIZES.A4;
      const pw = config.orientation === "landscape" ? d.height : d.width;
      const ph = config.orientation === "landscape" ? d.width  : d.height;

      const pdf = new jsPDF({ orientation: config.orientation, unit: "pt", format: config.size.toLowerCase() as any });
      const pdfW   = pdf.internal.pageSize.getWidth();
      const pdfH   = pdf.internal.pageSize.getHeight();
      const sliceH = Math.round(cv.width / pw * ph);
      const pages  = Math.max(1, Math.ceil(cv.height / sliceH));

      for (let i = 0; i < pages; i++) {
        if (i > 0) pdf.addPage();
        const slice = document.createElement("canvas");
        slice.width  = cv.width;
        slice.height = sliceH;
        const sctx = slice.getContext("2d")!;
        sctx.drawImage(imgEl, 0, i * sliceH, slice.width, sliceH,
                               0, 0,          slice.width, sliceH);
        pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pdfW, pdfH);
      }
      pdf.save(`${docName.replace(/\s+/g,"_").toLowerCase()}.pdf`);
      toast.success("PDF exported");
    } finally {
      if (editorRef.current && wasEditable) editorRef.current.contentEditable = wasEditable;
    }
  }, [docName, config]);

  const exportHTML = useCallback(() => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${docName}</title>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(config.font)}:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet"/>
<style>body{font-family:'${config.font}',serif;font-size:${config.fontSize}pt;background:${config.bg};margin:${config.mt}px ${config.mr}px ${config.mb}px ${config.ml}px}table{border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:6px 10px}</style>
</head><body>${editorRef.current?.innerHTML??""}</body></html>`;
    const blob = new Blob([html], { type:"text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${docName.replace(/\s+/g,"_").toLowerCase()}.html`; a.click(); URL.revokeObjectURL(a.href);
  }, [docName, config]);

  const { width: pageW, height: pageH } = (() => {
    const d = PAGE_SIZES[config.size] ?? PAGE_SIZES.A4;
    return config.orientation === "landscape" ? { width: d.height, height: d.width } : d;
  })();

  const TB = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
          onMouseDown={(e) => { e.preventDefault(); onClick(); }}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-[#f0f0f0] dark:bg-zinc-800">

        {/* ── Title Bar (Word-like blue header) ─────────────────── */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2b579a] text-white shrink-0">
          <Link href="/dashboard/designer">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Input
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            className="w-52 h-6 text-sm font-medium bg-transparent border-0 border-b border-white/40 rounded-none text-white placeholder:text-white/50 focus-visible:ring-0 focus-visible:border-white px-0"
          />
          <span className="text-xs text-white/60 ml-1">— Word</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" className="h-7 text-xs gap-1 bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-3.5 w-3.5" />{saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-white hover:bg-white/20">
                  <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportPDF}>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={exportHTML}>Export as HTML</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Ribbon Tabs ───────────────────────────────────────── */}
        <div className="bg-[#f3f3f3] dark:bg-zinc-900 border-b">
          {/* Tab labels */}
          <div className="flex items-end px-2 pt-1 gap-0.5">
            {["Home","Insert","Layout"].map((t,i) => (
              <button key={t}
                className={`px-3 py-1 text-xs rounded-t-sm font-medium transition-colors
                  ${i===0 ? "bg-white dark:bg-zinc-800 border border-b-0 border-border" : "hover:bg-white/60 dark:hover:bg-zinc-700 text-muted-foreground"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Main toolbar */}
          <div className="flex items-center flex-wrap gap-x-1 gap-y-1 px-2 py-1.5 bg-white dark:bg-zinc-800 border-t">
            {/* Undo/Redo */}
            <TB title="Undo (Ctrl+Z)" onClick={() => cmd("undo")}><Undo2 className="h-3.5 w-3.5" /></TB>
            <TB title="Redo (Ctrl+Y)" onClick={() => cmd("redo")}><Redo2 className="h-3.5 w-3.5" /></TB>
            <Separator orientation="vertical" className="h-5 mx-0.5" />

            {/* Font family */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs w-36 justify-between shrink-0" style={{ fontFamily: config.font }}>
                  <span className="truncate">{config.font}</span><ChevronDown className="h-3 w-3 ml-1 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 max-h-72 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold">SYSTEM</div>
                {SYSTEM_FONTS.map(f => <DropdownMenuItem key={f} onSelect={() => applyFont(f)} style={{ fontFamily: f }}>{f}</DropdownMenuItem>)}
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold">GOOGLE FONTS</div>
                {GOOGLE_FONTS.map(f => <DropdownMenuItem key={f} onSelect={() => applyFont(f)} style={{ fontFamily: f }}>{f}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Font size */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-5 p-0"
                onMouseDown={(e) => { e.preventDefault(); applyFontSize(Math.max(config.fontSize - 1, 6)); }}>
                <Minus className="h-3 w-3" />
              </Button>
              <input type="number" value={config.fontSize}
                onChange={(e) => applyFontSize(Number(e.target.value))}
                className="w-11 h-7 text-xs text-center border rounded bg-background"
                min={6} max={144} />
              <Button variant="ghost" size="icon" className="h-7 w-5 p-0"
                onMouseDown={(e) => { e.preventDefault(); applyFontSize(Math.min(config.fontSize + 1, 144)); }}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Grow/Shrink */}
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-base font-bold shrink-0"
                onMouseDown={(e) => { e.preventDefault(); applyFontSize(config.fontSize + 2); }}>A+</Button>
            </TooltipTrigger><TooltipContent>Grow Font</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-xs font-bold shrink-0"
                onMouseDown={(e) => { e.preventDefault(); applyFontSize(Math.max(config.fontSize - 2, 6)); }}>A-</Button>
            </TooltipTrigger><TooltipContent>Shrink Font</TooltipContent></Tooltip>

            <Separator orientation="vertical" className="h-5 mx-0.5" />

            {/* Format buttons */}
            <TB title="Bold (Ctrl+B)"         onClick={() => cmd("bold")}><Bold className="h-3.5 w-3.5" /></TB>
            <TB title="Italic (Ctrl+I)"        onClick={() => cmd("italic")}><Italic className="h-3.5 w-3.5" /></TB>
            <TB title="Underline (Ctrl+U)"     onClick={() => cmd("underline")}><Underline className="h-3.5 w-3.5" /></TB>
            <TB title="Strikethrough"          onClick={() => cmd("strikeThrough")}><Strikethrough className="h-3.5 w-3.5" /></TB>
            <TB title="Subscript"              onClick={() => cmd("subscript")}><Subscript className="h-3.5 w-3.5" /></TB>
            <TB title="Superscript"            onClick={() => cmd("superscript")}><Superscript className="h-3.5 w-3.5" /></TB>
            <TB title="Clear Formatting"       onClick={() => cmd("removeFormat")}><RemoveFormatting className="h-3.5 w-3.5" /></TB>

            {/* Colors */}
            <Tooltip><TooltipTrigger asChild>
              <label className="relative cursor-pointer h-7 w-7 flex items-center justify-center rounded hover:bg-muted border-b-2 border-primary shrink-0">
                <span className="text-xs font-bold">A</span>
                <input type="color" className="absolute opacity-0 w-0 h-0" onChange={(e) => cmd("foreColor", e.target.value)} />
              </label>
            </TooltipTrigger><TooltipContent>Font Color</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <label className="relative cursor-pointer h-7 w-7 flex items-center justify-center rounded hover:bg-muted border-b-2 border-yellow-400 shrink-0">
                <span className="text-xs font-bold" style={{ color:"#4b5563" }}>A</span>
                <input type="color" defaultValue="#fef08a" className="absolute opacity-0 w-0 h-0" onChange={(e) => cmd("hiliteColor", e.target.value)} />
              </label>
            </TooltipTrigger><TooltipContent>Highlight Color</TooltipContent></Tooltip>

            <Separator orientation="vertical" className="h-5 mx-0.5" />

            {/* Alignment */}
            <TB title="Align Left (Ctrl+L)"    onClick={() => cmd("justifyLeft")}><AlignLeft className="h-3.5 w-3.5" /></TB>
            <TB title="Center (Ctrl+E)"        onClick={() => cmd("justifyCenter")}><AlignCenter className="h-3.5 w-3.5" /></TB>
            <TB title="Align Right (Ctrl+R)"   onClick={() => cmd("justifyRight")}><AlignRight className="h-3.5 w-3.5" /></TB>
            <TB title="Justify (Ctrl+J)"       onClick={() => cmd("justifyFull")}><AlignJustify className="h-3.5 w-3.5" /></TB>

            <Separator orientation="vertical" className="h-5 mx-0.5" />

            {/* Lists & indent */}
            <TB title="Bullet List"            onClick={() => cmd("insertUnorderedList")}><List className="h-3.5 w-3.5" /></TB>
            <TB title="Numbered List"          onClick={() => cmd("insertOrderedList")}><ListOrdered className="h-3.5 w-3.5" /></TB>
            <TB title="Decrease Indent"        onClick={() => cmd("outdent")}><Outdent className="h-3.5 w-3.5" /></TB>
            <TB title="Increase Indent"        onClick={() => cmd("indent")}><Indent className="h-3.5 w-3.5" /></TB>

            <Separator orientation="vertical" className="h-5 mx-0.5" />

            {/* Heading styles */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0">
                  <Type className="h-3 w-3" /> Style <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => cmd("formatBlock","h1")} className="text-2xl font-bold py-0.5">Heading 1</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => cmd("formatBlock","h2")} className="text-xl font-bold py-0.5">Heading 2</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => cmd("formatBlock","h3")} className="text-lg font-semibold py-0.5">Heading 3</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => cmd("formatBlock","h4")} className="text-base font-semibold py-0.5">Heading 4</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => cmd("formatBlock","p")}>Normal Text</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => cmd("formatBlock","blockquote")}>Quote</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => cmd("formatBlock","pre")}>Code Block</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Table */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0">
                  <Table className="h-3 w-3" /> Table <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="p-3 space-y-2">
                <p className="text-xs font-medium">Insert Table</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs">Rows:</label>
                  <input type="number" value={tableRows} onChange={(e) => setTableRows(Number(e.target.value))} className="w-14 h-6 border rounded text-xs text-center" min={1} max={20} />
                  <label className="text-xs">Cols:</label>
                  <input type="number" value={tableCols} onChange={(e) => setTableCols(Number(e.target.value))} className="w-14 h-6 border rounded text-xs text-center" min={1} max={10} />
                </div>
                <Button size="sm" className="w-full h-7 text-xs"
                  onMouseDown={(e) => { e.preventDefault(); editorRef.current?.focus(); insertTable(tableRows, tableCols); }}>
                  Insert Table
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Link */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0">
                  <Link2 className="h-3 w-3" /> Link
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="p-3 space-y-2">
                <p className="text-xs font-medium">Insert Hyperlink</p>
                <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                  className="h-7 text-xs" onKeyDown={(e) => { if (e.key === "Enter" && linkUrl) { cmd("createLink", linkUrl); setLinkUrl(""); }}} />
                <Button size="sm" className="w-full h-7 text-xs"
                  onClick={() => { if (linkUrl) { cmd("createLink", linkUrl); setLinkUrl(""); }}}>Apply</Button>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Page settings */}
            <Button variant={showPagePane ? "secondary" : "outline"} size="sm" className="h-7 text-xs shrink-0"
              onClick={() => setShowPagePane(!showPagePane)}>
              Layout
            </Button>

            <Separator orientation="vertical" className="h-5 mx-0.5" />

            {/* Page Break */}
            <TB title="Insert Page Break"
              onClick={() => {
                editorRef.current?.focus();
                cmd("insertHTML", '<div class="wb-page-break" contenteditable="false"></div><p><br></p>');
              }}>
              <Scissors className="h-3.5 w-3.5" />
            </TB>
          </div>

          {/* Page settings bar */}
          {showPagePane && (
            <div className="flex items-center flex-wrap gap-3 px-3 py-2 bg-[#e8f0fb] dark:bg-zinc-900 border-t text-xs">
              <label className="flex items-center gap-1.5 whitespace-nowrap">
                Page Size
                <select className="border rounded px-1 py-0.5 text-xs bg-background" value={config.size}
                  onChange={(e) => setConfig(c => ({ ...c, size: e.target.value }))}>
                  {Object.keys(PAGE_SIZES).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 whitespace-nowrap">
                Orientation
                <select className="border rounded px-1 py-0.5 text-xs bg-background" value={config.orientation}
                  onChange={(e) => setConfig(c => ({ ...c, orientation: e.target.value as Orientation }))}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              {(["mt","mr","mb","ml"] as const).map((k, i) => (
                <label key={k} className="flex items-center gap-1 whitespace-nowrap">
                  {["Top","Right","Bottom","Left"][i]}
                  <input type="number" value={config[k]} onChange={(e) => setConfig(c => ({ ...c, [k]: Number(e.target.value) }))}
                    className="w-14 border rounded px-1 py-0.5 text-xs bg-background" min={0} max={200} />px
                </label>
              ))}
              <label className="flex items-center gap-1.5">
                Background
                <input type="color" value={config.bg} onChange={(e) => setConfig(c => ({ ...c, bg: e.target.value }))}
                  className="w-7 h-5 rounded border cursor-pointer" />
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={config.showHeader} onChange={(e) => setConfig(c => ({ ...c, showHeader: e.target.checked }))} />
                Header
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={config.showFooter} onChange={(e) => setConfig(c => ({ ...c, showFooter: e.target.checked }))} />
                Footer
              </label>
              {config.showHeader && (
                <label className="flex items-center gap-1.5 whitespace-nowrap">
                  Header text
                  <input className="border rounded px-1 py-0.5 text-xs bg-background w-48" value={config.headerText}
                    onChange={(e) => setConfig(c => ({ ...c, headerText: e.target.value }))} placeholder="Header…" />
                </label>
              )}
              {config.showFooter && (
                <label className="flex items-center gap-1.5 whitespace-nowrap">
                  Footer text
                  <input className="border rounded px-1 py-0.5 text-xs bg-background w-48" value={config.footerText}
                    onChange={(e) => setConfig(c => ({ ...c, footerText: e.target.value }))} placeholder="Footer…" />
                </label>
              )}
            </div>
          )}
        </div>

        {/* ── Document Area ──────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-neutral-500 dark:bg-zinc-700 py-8">
          <div className="flex justify-center">
            {/* Outer wrapper: provides the page stack width and acts as PDF capture root */}
            <div ref={pageRef} style={{ width: pageW, position: "relative" }}>

              {/* ── Page background cards (one per logical page) ── */}
              {Array.from({ length: numPages }).map((_, i) => (
                <Fragment key={i}>
                  {/* Page card */}
                  <div
                    className="shadow-xl"
                    style={{
                      width: pageW,
                      height: pageH,
                      backgroundColor: config.bg,
                      position: "relative",
                      marginBottom: i < numPages - 1 ? 12 : 0,
                      overflow: "hidden",
                    }}
                  >
                    {/* Header strip (inside top margin) */}
                    {config.showHeader && (
                      <div style={{
                        position: "absolute", top: 0, left: config.ml, right: config.mr,
                        height: config.mt - 8,
                        borderBottom: "1px dashed #93c5fd",
                        display: "flex", alignItems: "flex-end", paddingBottom: 3,
                        pointerEvents: "none",
                      }}>
                        <span style={{ fontSize: "9pt", color: "#64748b", fontFamily: config.font }}>
                          {config.headerText || "\u00a0"}
                        </span>
                        {numPages > 1 && (
                          <span style={{ fontSize: "8pt", color: "#94a3b8", marginLeft: "auto" }}>p.{i + 1}</span>
                        )}
                      </div>
                    )}

                    {/* Footer strip (inside bottom margin) */}
                    {config.showFooter && (
                      <div style={{
                        position: "absolute", bottom: 0, left: config.ml, right: config.mr,
                        height: config.mb - 8,
                        borderTop: "1px dashed #93c5fd",
                        display: "flex", alignItems: "flex-start", paddingTop: 3,
                        pointerEvents: "none",
                      }}>
                        <span style={{ fontSize: "9pt", color: "#64748b", fontFamily: config.font }}>
                          {config.footerText || "\u00a0"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Gap between pages (print-excluded) */}
                  {i < numPages - 1 && (
                    <div className="wb-page-gap" style={{ height: 12, backgroundColor: "transparent" }} />
                  )}
                </Fragment>
              ))}

              {/* ── Content editable: floats over all page cards ── */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck
                className="outline-none focus:outline-none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  // Span all page cards + gaps
                  minHeight: numPages * pageH + Math.max(0, numPages - 1) * 12,
                  // Margins applied as padding so content stays in the safe zone
                  padding: `${config.mt}px ${config.mr}px ${config.mb}px ${config.ml}px`,
                  fontFamily: config.font,
                  fontSize: `${config.fontSize}pt`,
                  color: "#000000",
                  lineHeight: 1.6,
                  background: "transparent",
                  zIndex: 1,
                  // Extra top padding on every subsequent page is approximated by
                  // the repeating page-gap value so text doesn't fall inside gap bands
                }}
                data-placeholder="Start typing\u2026"
                onKeyDown={(e) => {
                  if (e.key === "Tab") { e.preventDefault(); cmd("insertHTML", "&nbsp;&nbsp;&nbsp;&nbsp;"); }
                }}
                suppressHydrationWarning
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #94a3b8; pointer-events: none; }
        [contenteditable] h1 { font-size: 2em; font-weight: 700; margin: .67em 0; }
        [contenteditable] h2 { font-size: 1.5em; font-weight: 700; margin: .75em 0; }
        [contenteditable] h3 { font-size: 1.17em; font-weight: 700; margin: .83em 0; }
        [contenteditable] h4 { font-size: 1em; font-weight: 700; margin: 1.12em 0; }
        [contenteditable] blockquote { border-left: 4px solid #94a3b8; margin: .5em 0; padding: .25em 1em; color: #64748b; }
        [contenteditable] pre { background: #f1f5f9; padding: .5em .75em; border-radius: .25em; font-family: monospace; font-size: .9em; }
        [contenteditable] a { color: #2563eb; text-decoration: underline; }
        [contenteditable] ul { list-style: disc; margin-left: 1.5em; }
        [contenteditable] ol { list-style: decimal; margin-left: 1.5em; }
        [contenteditable] table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        [contenteditable] td, [contenteditable] th { border: 1px solid #cbd5e1; padding: 6px 10px; min-width: 40px; }
        [contenteditable] th { background: #f8fafc; font-weight: 600; }
        /* Page break element */
        .wb-page-break {
          display: block; height: 0;
          border-top: 2px dashed #94a3b8;
          margin: 12px 0;
          position: relative;
          user-select: none;
        }
        .wb-page-break::after {
          content: "— Page Break —";
          position: absolute; top: -9px; left: 50%;
          transform: translateX(-50%);
          background: #fff; padding: 0 8px;
          font-size: 9px; color: #94a3b8; white-space: nowrap;
          font-family: sans-serif;
        }
        /* Hide gap divs and page-break markers in print */
        @media print {
          .wb-page-gap { display: none; }
          .wb-page-break { page-break-after: always; break-after: page; border: none; }
          .wb-page-break::after { display: none; }
        }
      `}</style>
    </TooltipProvider>
  );
}
