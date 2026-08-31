"use client";

/**
 * Writer v2 — TipTap 3 document editor (Word-like).
 *
 * Saves STRUCTURED ProseMirror JSON: canvas_state = {type:"writer2", doc, config}
 * so documents survive round-trips, enable token/bulk filling, and render
 * server-side (WeasyPrint) with correct Nepali shaping.
 *
 * Legacy support: opens old {type:"writer", html} docs and seeded writer_json
 * templates (via writerBlocksToHTML).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { writerBlocksToHTML } from "@/lib/designer/writer-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Save, Download, Undo2, Redo2, Bold, Italic, Underline as UnderlineIcon,
  Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  Indent, Outdent, Table as TableIcon, Link2, ChevronDown, FileOutput, Image as ImageIcon,
  Braces, Type as TypeIcon, Highlighter, RemoveFormatting, Minus, Subscript as SubIcon,
  Superscript as SupIcon, Loader2,
} from "lucide-react";

// ── fonts ────────────────────────────────────────────────────────────────
const SYSTEM_FONTS = ["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Trebuchet MS"];
const GOOGLE_FONTS = [
  "Poppins", "Roboto", "Open Sans", "Lato", "Montserrat", "Nunito",
  "Playfair Display", "Merriweather", "PT Serif", "Libre Baskerville",
  "Noto Sans Devanagari", "Mukta", "Hind",
];
const ALL_FONTS = [...SYSTEM_FONTS, ...GOOGLE_FONTS];

function loadGoogleFont(family: string) {
  const id = `gfont-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  const devanagari = family.includes("Devanagari") || family === "Mukta" || family === "Hind";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap${devanagari ? "&subset=devanagari" : ""}`;
  document.head.appendChild(link);
}

// ── page sizes (px @96dpi) ─────────────────────────────────────────────
const PAGE_SIZES: Record<string, { width: number; height: number; css: string }> = {
  A4: { width: 794, height: 1123, css: "A4" },
  A5: { width: 559, height: 794, css: "A5" },
  Letter: { width: 816, height: 1056, css: "letter" },
  Legal: { width: 816, height: 1344, css: "legal" },
};

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

// token chip styles injected once
const TOKEN_CSS = `
.writer-token {
  background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 4px;
  padding: 0 4px; margin: 0 1px; font-family: monospace; font-size: 0.9em;
  color: #0369a1; user-select: all;
}
.writer-page { box-shadow: 0 2px 12px rgba(0,0,0,0.12); }
.writer-page .ProseMirror { outline: none; min-height: 100%; }
.writer-page .ProseMirror table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.writer-page .ProseMirror th, .writer-page .ProseMirror td {
  border: 1px solid #cbd5e1; padding: 5px 8px; position: relative;
}
.writer-page .ProseMirror th { background: #f1f5f9; font-weight: 600; }
.writer-page .ProseMirror .selectedCell:after {
  content: ""; position: absolute; inset: 0; background: rgba(59,130,246,0.12); pointer-events: none;
}
.writer-page .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder); color: #94a3b8; float: left; height: 0; pointer-events: none;
}
`;

interface WriterConfig {
  pageSize: string;
  orientation: "portrait" | "landscape";
  font: string;
  fontSize: number;
  marginTop: number; marginRight: number; marginBottom: number; marginLeft: number;
}

const DEFAULT_CONFIG: WriterConfig = {
  pageSize: "A4",
  orientation: "portrait",
  font: "Poppins",
  fontSize: 12,
  marginTop: 64, marginRight: 56, marginBottom: 64, marginLeft: 56,
};

export default function WriterPage() {
  return (
    <PluginGate slug="design_studio">
      <WriterContent />
    </PluginGate>
  );
}

function WriterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get("doc");
  const templateId = searchParams.get("template");

  const [docName, setDocName] = useState("Untitled Document");
  const [config, setConfig] = useState<WriterConfig>(DEFAULT_CONFIG);
  const [showLayout, setShowLayout] = useState(false);
  const [showTokenBar, setShowTokenBar] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [fontSize, setFontSize] = useState(12);
  const loadedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Start writing your document…" }),
    ],
    content: "<p></p>",
    onUpdate: () => setDirty(true),
    editorProps: {
      attributes: {
        style: `font-family:'${config.font}',Arial,sans-serif; font-size:${config.fontSize}pt; line-height:1.6;`,
      },
    },
  });

  // ── load doc or template ────────────────────────────────────────
  const { data: docData } = useQuery({
    queryKey: ["writer-doc", docId],
    queryFn: async () => (await api.get(`/design-studio/documents/${docId}`)).data?.data,
    enabled: !!docId,
  } as any);

  const { data: templates = [] } = useQuery({
    queryKey: ["design-templates"],
    queryFn: async () => {
      const r = await api.get("/design-studio/templates");
      return Array.isArray(r.data?.data) ? r.data.data : [];
    },
    enabled: !!templateId,
  });

  useEffect(() => {
    if (!editor || loadedRef.current) return;
    if (docData) {
      loadedRef.current = true;
      const doc = docData as any;
      setDocName(doc.name || "Untitled Document");
      const state = doc.canvas_state;
      if (state?.type === "writer2" && state.doc) {
        // structured v2 — restore native
        if (state.config) setConfig({ ...DEFAULT_CONFIG, ...state.config });
        editor.commands.setContent(state.doc);
      } else if (state?.type === "writer" && state.html) {
        // legacy raw HTML doc
        if (state.config) setConfig({ ...DEFAULT_CONFIG, ...state.config });
        editor.commands.setContent(state.html);
        toast.info("Legacy document loaded — saving will upgrade it to the new format");
      }
      return;
    }
    if (templateId && templates.length) {
      const tpl = templates.find((t: any) => t.id === templateId);
      if (!tpl) return;
      loadedRef.current = true;
      setDocName(tpl.name || "Document");
      if (tpl.writer_json?.config) setConfig({ ...DEFAULT_CONFIG, ...tpl.writer_json.config });
      editor.commands.setContent(writerBlocksToHTML(tpl.writer_json || {}));
    }
  }, [editor, docData, templateId, templates]);

  // keep editor font in sync with config
  useEffect(() => {
    if (!editor) return;
    loadGoogleFont(config.font);
    const el = editor.view.dom as HTMLElement;
    el.style.fontFamily = `'${config.font}',Arial,sans-serif`;
    el.style.fontSize = `${config.fontSize}pt`;
  }, [editor, config.font, config.fontSize]);

  // ── data sources for tokens ─────────────────────────────────────
  const { data: sources = [] } = useQuery({
    queryKey: ["data-sources"],
    queryFn: async () => {
      try {
        const r = await api.get("/design-studio/data-sources");
        return r.data?.data || [];
      } catch {
        return [];
      }
    },
  });

  // ── save ────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: docName,
        template_type: "writer_doc",
        canvas_state: { type: "writer2", doc: editor!.getJSON(), config },
      };
      if (docId) payload.id = docId;
      return (await api.post("/design-studio/documents", payload)).data?.data;
    },
    onSuccess: (data) => {
      setDirty(false);
      toast.success("Document saved");
      if (!docId && data?.id) router.replace(`/dashboard/designer/writer?doc=${data.id}`);
    },
    onError: () => toast.error("Failed to save"),
  });

  // server PDF via template render or saved doc
  const pdfMutation = useMutation({
    mutationFn: async () => {
      if (!docId) throw new Error("save-first");
      const r = await api.post(
        "/design-studio/export/pdf",
        { document_id: docId },
        { responseType: "blob" },
      );
      return r.data as Blob;
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docName.replace(/\s+/g, "_").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded (print-ready, Nepali-safe)");
    },
    onError: (e: any) => {
      if (e?.message === "save-first") toast.info("Save the document first, then export server PDF");
      else toast.error("Server PDF failed");
    },
  });

  // autosave draft every 15s when dirty
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      if (!saveMutation.isPending) saveMutation.mutate();
    }, 15000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  // unsaved-changes guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const insertToken = useCallback((token: string) => {
    editor?.chain().focus().insertContent(`<span class="writer-token" data-token="${token}">${token}</span>&nbsp;`).run();
  }, [editor]);

  const applyFontSize = (size: number) => {
    setFontSize(size);
    editor?.chain().focus().setFontSize(`${size}pt`).run();
  };

  const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor?.chain().focus().setImage({ src: reader.result as string }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const ribbonBtn = "h-7 w-7";
  const page = PAGE_SIZES[config.pageSize] ?? PAGE_SIZES.A4;
  const pw = config.orientation === "landscape" ? page.height : page.width;
  const ph = config.orientation === "landscape" ? page.width : page.height;

  if (!editor) return <div className="h-screen" />;

  return (
    <div className="h-screen flex flex-col bg-[#eef1f4]">
      <style>{TOKEN_CSS}</style>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={addImage} />

      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 h-12 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/dashboard/designer")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input value={docName} onChange={(e) => { setDocName(e.target.value); setDirty(true); }} className="w-52 h-7 text-sm font-medium" />
        {dirty && <span className="text-[10px] text-amber-600">● unsaved</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowTokenBar(!showTokenBar)}>
            <Braces className="h-3.5 w-3.5" /> Tokens
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => pdfMutation.mutate()}>
                <FileOutput className="h-4 w-4 mr-2" /> PDF — Print-ready (server)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>
                <Download className="h-4 w-4 mr-2" /> Print / Save as PDF (browser)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                const html = `<html><head><meta charset="utf-8"><style>body{font-family:'${config.font}',Arial;}</style></head><body>${editor.getHTML()}</body></html>`;
                const blob = new Blob([html], { type: "text/html" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${docName.replace(/\s+/g, "_").toLowerCase()}.html`;
                a.click();
              }}>
                Download HTML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Ribbon */}
      <div className="flex items-center flex-wrap gap-1 px-2 py-1.5 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Select value={config.font} onValueChange={(v) => { setConfig((c) => ({ ...c, font: v })); setDirty(true); }}>
          <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{ALL_FONTS.map((f) => <SelectItem key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(fontSize)} onValueChange={(v) => applyFontSize(Number(v))}>
          <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{FONT_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button variant={editor.isActive("bold") ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></Button>
        <Button variant={editor.isActive("italic") ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></Button>
        <Button variant={editor.isActive("underline") ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-3.5 w-3.5" /></Button>
        <Button variant={editor.isActive("strike") ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></Button>
        <input type="color" className="w-6 h-6 rounded border cursor-pointer" title="Text color"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
        <Button variant={editor.isActive("highlight") ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Highlight"><Highlighter className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Select value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : editor.isActive("heading", { level: 4 }) ? "h4" : editor.isActive("blockquote") ? "quote" : editor.isActive("codeBlock") ? "code" : "p"}
          onValueChange={(v) => {
            if (v === "p") editor.chain().focus().setParagraph().run();
            else if (v === "quote") editor.chain().focus().toggleBlockquote().run();
            else if (v === "code") editor.chain().focus().toggleCodeBlock().run();
            else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 | 4 }).run();
          }}>
          <SelectTrigger className="w-28 h-7 text-xs"><SelectValue placeholder="Style" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Body text</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
            <SelectItem value="h4">Heading 4</SelectItem>
            <SelectItem value="quote">Quote</SelectItem>
            <SelectItem value="code">Code block</SelectItem>
          </SelectContent>
        </Select>
        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button variant={editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-3.5 w-3.5" /></Button>
        <Button variant={editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-3.5 w-3.5" /></Button>
        <Button variant={editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-3.5 w-3.5" /></Button>
        <Button variant={editor.isActive({ textAlign: "justify" }) ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button variant={editor.isActive("bulletList") ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></Button>
        <Button variant={editor.isActive("orderedList") ? "secondary" : "ghost"} size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().sinkListItem("listItem").run()} disabled={!editor.can().sinkListItem("listItem")}><Indent className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().liftListItem("listItem").run()} disabled={!editor.can().liftListItem("listItem")}><Outdent className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table"><TableIcon className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => { const url = window.prompt("Image URL"); if (url) editor.chain().focus().setImage({ src: url }).run(); }} title="Insert image from URL"><ImageIcon className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => (fileRef.current as HTMLInputElement | null)?.click()} title="Upload image"><ImageIcon className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => { const url = window.prompt("Link URL"); if (url) editor.chain().focus().setLink({ href: url }).run(); }}><Link2 className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().toggleSubscript().run()}><SubIcon className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().toggleSuperscript().run()}><SupIcon className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className={ribbonBtn} onClick={() => editor.chain().focus().unsetAllMarks().run()} title="Clear formatting"><RemoveFormatting className="h-3.5 w-3.5" /></Button>

        {/* table ops when inside a table */}
        {editor.isActive("table") && (
          <>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5" onClick={() => editor.chain().focus().addRowAfter().run()}>Row+</Button>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5" onClick={() => editor.chain().focus().deleteRow().run()}>Row−</Button>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5" onClick={() => editor.chain().focus().addColumnAfter().run()}>Col+</Button>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5" onClick={() => editor.chain().focus().deleteColumn().run()}>Col−</Button>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5 text-destructive" onClick={() => editor.chain().focus().deleteTable().run()}>Del</Button>
          </>
        )}

        <Button variant={showLayout ? "secondary" : "ghost"} size="sm" className="h-7 text-xs ml-auto gap-1" onClick={() => setShowLayout(!showLayout)}>
          <TypeIcon className="h-3.5 w-3.5" /> Layout
        </Button>
      </div>

      {/* Token bar */}
      {showTokenBar && (
        <div className="flex items-center flex-wrap gap-1.5 px-3 py-2 border-b bg-sky-50 shrink-0">
          <span className="text-xs text-sky-700 font-medium mr-1">Click to insert:</span>
          {sources.flatMap((src: any) =>
            (src.fields || []).slice(0, 14).map((f: string) => (
              <button key={`${src.id}.${f}`} onClick={() => insertToken(`{${f}}`)}
                className="text-[10px] px-1.5 py-0.5 bg-white border border-sky-200 rounded font-mono text-sky-700 hover:bg-sky-100"
                title={`${src.name} → {${f}}`}>
                {`{${f}}`}
              </button>
            )),
          )}
          <span className="text-[10px] text-sky-600 ml-2">Tokens auto-fill from Data panels and server renders.</span>
        </div>
      )}

      {/* Layout pane */}
      {showLayout && (
        <div className="flex items-center flex-wrap gap-4 px-3 py-2 border-b bg-muted/40 shrink-0">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">Size</Label>
            <Select value={config.pageSize} onValueChange={(v) => { setConfig((c) => ({ ...c, pageSize: v })); setDirty(true); }}>
              <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(PAGE_SIZES).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">Orientation</Label>
            <Select value={config.orientation} onValueChange={(v: "portrait" | "landscape") => { setConfig((c) => ({ ...c, orientation: v })); setDirty(true); }}>
              <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map((m) => (
            <div key={m} className="flex items-center gap-1">
              <Label className="text-[10px] capitalize">{m.replace("margin", "M ")}</Label>
              <Input type="number" value={config[m]} min={0} max={200}
                onChange={(e) => { setConfig((c) => ({ ...c, [m]: Number(e.target.value) })); setDirty(true); }}
                className="w-16 h-7 text-xs" />
            </div>
          ))}
        </div>
      )}

      {/* Page canvas — real A4 page view with margins */}
      <div className="flex-1 overflow-auto py-8 print:bg-white print:py-0">
        <div
          className="writer-page relative bg-white mx-auto print:shadow-none"
          style={{
            width: pw,
            minHeight: ph,
            paddingTop: config.marginTop,
            paddingRight: config.marginRight,
            paddingBottom: config.marginBottom,
            paddingLeft: config.marginLeft,
            boxSizing: "border-box",
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
