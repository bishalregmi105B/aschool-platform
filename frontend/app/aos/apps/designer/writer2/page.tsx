"use client";

/**
 * Writer v2 — TipTap 3 document editor (Word-like ribbon edition).
 *
 * CHROME: Word-style tabbed ribbon (Home / Insert / Layout / Review / View)
 * with grouped controls, collapsible, plus a title bar (title, Tokens, Save,
 * Export) and a status bar (page x of y, word count, zoom).
 *
 * PAGE MODEL: real visual pagination — fixed-height page bands; a
 * ProseMirror decoration plugin pushes blocks that cross a page boundary to
 * the next page (and honours explicit page-break nodes).
 *
 * SAVE: same endpoints/payload shape as the original writer2 —
 *   POST /design-studio/documents {name, template_type:"writer_doc",
 *   canvas_state:{type:"writer2", doc, config}} (autosave every 15s when dirty).
 *
 * Legacy support: opens old {type:"writer", html} docs and seeded
 * writer_json templates (via writerBlocksToHTML).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextSelection } from "@tiptap/pm/state";
import { useSearchParams, useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize, LineHeight } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { writerBlocksToHTML } from "@/lib/designer/writer-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Save, Download, ChevronDown, FileOutput, FileText, Braces, Loader2, BookOpen,
} from "lucide-react";

import { Ribbon } from "@/components/writer/ribbon";
import { FindReplaceDialog, WordArtDialog, HeaderFooterDialog } from "@/components/writer/dialogs";
import { WriterRuler, StatusBar } from "@/components/writer/chrome";
import { WriterSidePanel, type WriterCitation } from "@/components/writer/ResearchPanel";
import type { WriterCtx, WordCounts } from "@/components/writer/context";
import { FindReplaceExtension, setFindState } from "@/lib/writer/findReplace";
import { PaginationExtension, computePagination, applyPagination, PAGE_GAP } from "@/lib/writer/pagination";
import { WriterParagraphFormat, PageBreak, FloatingBoxNode, WriterImage, WriterCommentMark, TrackInsertMark, TrackDeleteMark } from "@/lib/writer/editorKit";
import { exportDocx, downloadBlob, slugifyName } from "@/lib/writer/exportDocx";
import {
  mergeSettings, pageGeometry, ALL_FONTS, WORDART_STYLES,
} from "@/lib/writer/settings";
import type { WriterSettings, ShapeKind } from "@/lib/writer/settings";

// token chip styles + page band styles injected once
// NOTE: the editable surface is a `.writer-surface` div laid OVER the static
// `.writer-band` page bands (not inside them), so every ProseMirror style
// must be scoped to `.writer-surface` — scoping to `.writer-band` silently
// dead-styles the editor (and the missing `outline:none` made the browser
// draw its focus box around the content while typing).
const TOKEN_CSS = `
.writer-token {
  background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 4px;
  padding: 0 4px; margin: 0 1px; font-family: monospace; font-size: 0.9em;
  color: #0369a1; user-select: all;
}
.writer-find-hit { background: #fde68a; border-radius: 2px; }
.writer-find-hit.current { background: #fb923c; color: white; }
.writer-band {
  position: absolute; left: 0; width: 100%; background: #ffffff;
  box-shadow: 0 2px 12px rgba(0,0,0,0.14); overflow: hidden;
}
.writer-band.dark-border { border: 1px solid #334155; box-shadow: 0 2px 16px rgba(15,23,42,0.4); }
.writer-surface .ProseMirror { outline: none; min-height: 100%; }
.writer-surface .ProseMirror:focus { outline: none; }
.writer-surface .ProseMirror table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.writer-surface .ProseMirror th, .writer-surface .ProseMirror td {
  border: 1px solid #cbd5e1; padding: 5px 8px; position: relative;
}
.writer-surface .ProseMirror th { background: #f1f5f9; font-weight: 600; }
.writer-surface .ProseMirror .selectedCell:after {
  content: ""; position: absolute; inset: 0; background: rgba(59,130,246,0.12); pointer-events: none;
}
.writer-surface .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder); color: #94a3b8; float: left; height: 0; pointer-events: none;
}
.writer-surface .ProseMirror blockquote {
  border-left: 3px solid #94a3b8; padding-left: 12px; color: #475569; font-style: italic;
}
.writer-surface .ProseMirror pre {
  background: #f1f5f9; border-radius: 6px; padding: 10px 12px;
  font-family: Consolas, monospace; font-size: 0.9em;
}
.writer-pagebreak { border-top: 2px dashed #94a3b8; margin: 4px 0; opacity: .65; }
.writer-pagespacer { width: 100%; }
.writer-linenumbers .ProseMirror > * { position: relative; counter-increment: wline; }
.writer-linenumbers .ProseMirror > *::before {
  content: counter(wline); position: absolute; left: -30px; top: 0;
  font-size: 9px; color: #94a3b8; min-width: 24px; text-align: right;
}
.writer-floating-box { user-select: none; }
.writer-floating-box [contenteditable="true"] { outline: 1.5px dashed #2563eb; user-select: text; }

/* images (Word-like resize + wrap) */
.writer-image-node { position: relative; display: block; max-width: 100%; line-height: 0; }
.writer-image-node img { display: inline-block; max-width: 100%; }
.writer-image-node.writer-image-left { float: left; margin: 4px 14px 8px 0; }
.writer-image-node.writer-image-right { float: right; margin: 4px 0 8px 14px; }
.writer-image-node.writer-image-center { margin-left: auto; margin-right: auto; }
.writer-image-node button { font-family: inherit; }

/* research citations [n] */
.writer-citation { color: #2563eb; font-size: 0.72em; font-weight: 600; padding: 0 1px; }

/* tracked changes + comments */
.writer-surface .ProseMirror ins[data-track] { text-decoration: none; background: #dcfce7; color: #166534; }
.writer-surface .ProseMirror del[data-track] { text-decoration: line-through; background: #fee2e2; color: #991b1b; }
.writer-comment-mark {
  display: inline-block; width: 10px; height: 10px; margin-left: 2px;
  border-radius: 50%; background: #f59e0b; cursor: pointer; vertical-align: super;
}

/* continuous-paper fallback: when a block (e.g. a long table) is taller than
   one page it flows across boundaries — paint the gaps white so nothing
   floats on the gray canvas, and mark page starts with a dashed rule */
.writer-has-tall { background: #ffffff; border-radius: 2px; }
.writer-has-tall .writer-band { box-shadow: none; outline: 1px solid #e2e8f0; }
.writer-has-tall .writer-band + .writer-band { border-top: 1px dashed #94a3b8; }
`;

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
  const [settings, setSettings] = useState<WriterSettings>(() => mergeSettings());
  const [dirty, setDirty] = useState(false);
  const [showTokenBar, setShowTokenBar] = useState(false);
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [focusMode, setFocusMode] = useState(false);
  const [spellCheck, setSpellCheck] = useState(false);
  const [painter, setPainter] = useState<{ type: string; attrs: Record<string, unknown> }[] | null>(null);
  const [pages, setPages] = useState(1);
  const [stackH, setStackH] = useState(0);
  const [hasTallBlock, setHasTallBlock] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [counts, setCounts] = useState<WordCounts>({ words: 0, chars: 0, paras: 0, pages: 1, page: 1 });

  // dialogs
  const [findOpen, setFindOpen] = useState(false);
  const [findShowReplace, setFindShowReplace] = useState(false);
  const [wordArtOpen, setWordArtOpen] = useState(false);
  const [hfOpen, setHfOpen] = useState(false);
  const [sidePanel, setSidePanel] = useState<"none" | "research">("none");
  const [citations, setCitations] = useState<WriterCitation[]>([]);
  const [trackChanges, setTrackChanges] = useState(false);

  const loadedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeenPage = useRef(1);
  const trackRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      TextStyle, FontSize, LineHeight.configure({ types: ["paragraph", "heading"] }),
      Color, Highlight.configure({ multicolor: true }), Subscript, Superscript,
      WriterParagraphFormat, PageBreak, FloatingBoxNode, PaginationExtension,
      WriterCommentMark, TrackInsertMark, TrackDeleteMark,
      FindReplaceExtension,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      WriterImage.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Start writing your document…" }),
    ],
    content: "<p></p>",
    onUpdate: () => setDirty(true),
    editorProps: {
      attributes: {
        spellcheck: "false",
        style: `font-family:'${settings.font}',Arial,sans-serif; font-size:${settings.fontSize}pt; line-height:1.6;`,
      },
      // ── Word-like tracked changes: typed text is marked, deletions are
      //    struck through first (second delete removes them) ──
      handleTextInput: (view, from, to, text) => {
        if (!trackRef.current) return false;
        const { schema } = view.state;
        const tr = view.state.tr;
        if (from !== to) tr.addMark(from, to, schema.marks.trackDelete.create());
        tr.replaceSelectionWith(schema.text(text, [schema.marks.trackInsert.create()]), true);
        view.dispatch(tr.scrollIntoView());
        return true;
      },
      handleKeyDown: (view, event) => {
        if (!trackRef.current) return false;
        if (event.key !== "Backspace" && event.key !== "Delete") return false;
        const { state } = view;
        const { from, to, empty } = state.selection;
        const delMark = state.schema.marks.trackDelete.create();
        if (!empty) {
          view.dispatch(state.tr.addMark(from, to, delMark));
          return true;
        }
        const $from = state.selection.$from;
        if (event.key === "Backspace") {
          if ($from.parentOffset === 0) return false;
          const pos = $from.pos - 1;
          const node = state.doc.nodeAt(pos);
          if (!node?.isText) return false;
          const tracked = node.marks.some((m) => m.type.name === "trackDelete");
          if (tracked) view.dispatch(state.tr.delete(pos, pos + node.nodeSize));
          else {
            view.dispatch(
              state.tr.addMark(pos, pos + node.nodeSize, delMark)
                .setSelection(TextSelection.create(state.doc, pos)),
            );
          }
          return true;
        }
        const node = state.doc.nodeAt($from.pos);
        if (!node?.isText) return false;
        const tracked = node.marks.some((m) => m.type.name === "trackDelete");
        if (tracked) view.dispatch(state.tr.delete($from.pos, $from.pos + node.nodeSize));
        else view.dispatch(state.tr.addMark($from.pos, $from.pos + node.nodeSize, delMark));
        return true;
      },
    },
  });

  // ── load doc or template (same endpoints as the original writer2) ─
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

  function loadGoogleFont(family: string) {
    const id = `gfont-${family.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    if (!ALL_FONTS.includes(family)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    const devanagari = family.includes("Devanagari") || family === "Mukta" || family === "Hind";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap${devanagari ? "&subset=devanagari" : ""}`;
    document.head.appendChild(link);
  }

  useEffect(() => {
    if (!editor || loadedRef.current) return;
    if (docData) {
      loadedRef.current = true;
      const doc = docData as any;
      setDocName(doc.name || "Untitled Document");
      const state = doc.canvas_state;
      if (state?.type === "writer2" && state.doc) {
        if (state.config) setSettings(mergeSettings(state.config));
        editor.commands.setContent(state.doc);
      } else if (state?.type === "writer" && state.html) {
        if (state.config) setSettings(mergeSettings(state.config));
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
      if (tpl.writer_json?.config) setSettings(mergeSettings(tpl.writer_json.config));
      editor.commands.setContent(writerBlocksToHTML(tpl.writer_json || {}));
    }
  }, [editor, docData, templateId, templates]);

  // keep editor base font in sync with settings
  useEffect(() => {
    if (!editor) return;
    loadGoogleFont(settings.font);
    const el = editor.view.dom as HTMLElement;
    el.style.fontFamily = `'${settings.font}',Arial,sans-serif`;
    el.style.fontSize = `${settings.fontSize}pt`;
  }, [editor, settings.font, settings.fontSize]);

  const update = useCallback((patch: Partial<WriterSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setDirty(true);
  }, []);

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

  // ── save (identical endpoints/payload shape to the original) ─────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editor) return null;
      const payload: any = {
        name: docName,
        template_type: "writer_doc",
        canvas_state: { type: "writer2", doc: editor.getJSON(), config: settings },
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
      downloadBlob(blob, `${slugifyName(docName)}.pdf`);
      toast.success("PDF downloaded (print-ready, Nepali-safe)");
    },
    onError: (e: any) => {
      if (e?.message === "save-first") toast.info("Save the document first, then export server PDF");
      else toast.error("Server PDF failed");
    },
  });

  // ── DOCX export: client-side primary, server fallback on failure ──
  const doExportDocx = useCallback(async () => {
    if (!editor) return;
    setExporting(true);
    try {
      const json = editor.getJSON() as any;
      const blob = await exportDocx({ doc: json, settings, title: docName });
      downloadBlob(blob, `${slugifyName(docName)}.docx`);
      toast.success("Word document downloaded");
    } catch (err) {
      try {
        const r = await api.post(
          "/design-studio/writer/export-docx",
          { name: docName, doc: editor.getJSON(), settings },
          { responseType: "blob" },
        );
        downloadBlob(r.data as Blob, `${slugifyName(docName)}.docx`);
        toast.success("Word document downloaded (server export)");
      } catch {
        toast.error(`DOCX export failed: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    } finally {
      setExporting(false);
    }
  }, [editor, settings, docName]);

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

  // focus mode Esc exit + Ctrl+F find
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusMode) setFocusMode(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindShowReplace(false);
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  // ── pagination + counts — event driven (update / resize / settings) ─
  const geom = useMemo(() => pageGeometry(settings), [settings]);
  const pageGeom = useMemo(
    () => ({ pw: geom.pw, ph: geom.ph, marginTop: settings.marginTop, marginBottom: settings.marginBottom }),
    [geom, settings.marginTop, settings.marginBottom],
  );
  const zoomScale = zoom / 100;

  const recomputeLayout = useCallback(() => {
    if (!editor) return;
    try {
      const res = computePagination(editor, pageGeom);
      applyPagination(editor.view, res.breaks);
      setPages(res.pages);
      setStackH(res.stackH);
      setHasTallBlock(!!res.hasTallBlock);
      const txt = editor.state.doc.textBetween(0, editor.state.doc.content.size, " ", " ");
      const words = txt.split(/\s+/).filter(Boolean).length;
      setCounts((c) => ({
        ...c,
        words,
        chars: txt.length,
        paras: editor.state.doc.childCount,
        pages: res.pages,
        page: Math.min(c.page, res.pages),
      }));
    } catch { /* keep last known state */ }
  }, [editor, geom]);

  useEffect(() => {
    if (!editor) return;
    const schedule = () => requestAnimationFrame(recomputeLayout);
    editor.on("update", schedule);
    editor.on("create", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(editor.view.dom as HTMLElement);
    recomputeLayout();
    return () => {
      editor.off("update", schedule);
      editor.off("create", schedule);
      ro.disconnect();
    };
  }, [editor, recomputeLayout]);

  // track the visible page for the status bar (scroll position)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const pageH = (geom.ph + PAGE_GAP) * zoomScale;
      const band = Math.floor(el.scrollTop / pageH);
      lastSeenPage.current = Math.min(Math.max(1, band + 1), pages);
      setCounts((c) => ({ ...c, page: lastSeenPage.current }));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [geom, pages, zoomScale]);

  // ── actions for the ribbon ───────────────────────────────────────
  const insertSymbol = useCallback((chr: string) => {
    editor?.chain().focus().insertContent(chr).run();
  }, [editor]);

  const insertImageFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      editor?.chain().focus().setImage({ src: reader.result as string }).run();
    };
    reader.readAsDataURL(file);
  }, [editor]);

  const insertImageUrl = useCallback((url: string) => {
    editor?.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const insertLink = useCallback((url: string) => {
    editor?.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const insertTextbox = useCallback(() => {
    editor?.chain().focus().insertFloatingBox({
      kind: "textbox", w: 260, h: 110, text: "", border: true, fontSize: 12,
    }).run();
  }, [editor]);

  const insertShape = useCallback((kind: ShapeKind) => {
    editor?.chain().focus().insertFloatingBox({
      kind, w: kind === "arrow" ? 160 : 120, h: kind === "arrow" ? 60 : 120,
      fill: kind === "rect" ? "#dbeafe" : kind === "ellipse" ? "#dcfce7" : "#fef9c3",
      stroke: "#475569", border: false,
    }).run();
  }, [editor]);

  const doInsertWordArt = useCallback((text: string, style: number) => {
    const art = WORDART_STYLES[style] || WORDART_STYLES[0];
    editor?.chain().focus().insertFloatingBox({
      kind: "wordart", w: 420, h: 90, text, artStyle: style,
      font: art.font, fontSize: 36, color: art.from, align: "center", border: false,
    }).run();
  }, [editor]);

  const insertPageBreak = useCallback(() => {
    editor?.chain().focus().setPageBreak().run();
  }, [editor]);

  const insertDivider = useCallback(() => {
    editor?.chain().focus().setHorizontalRule().run();
  }, [editor]);

  const insertTable = useCallback((rows: number, cols: number, header = true) => {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: header }).run();
  }, [editor]);

  // ── research & citations ─────────────────────────────────────────
  const citationCountRef = useRef(0);
  const addCitation = useCallback((c: Omit<WriterCitation, "n">) => {
    citationCountRef.current += 1;
    const n = citationCountRef.current;
    setCitations((prev) => [...prev, { ...c, n }]);
    return n;
  }, []);

  const insertCitationMarker = useCallback((n: number) => {
    editor?.chain().focus()
      .insertContent(`<sup class="writer-citation">[${n}]</sup>`)
      .run();
  }, [editor]);

  const insertBibliography = useCallback((list: WriterCitation[]) => {
    if (!editor || !list.length) return;
    const items = list
      .map((c) => `<p><sup>[${c.n}]</sup> <a href="${c.url}" rel="noreferrer">${c.title}</a> — ${c.url}</p>`)
      .join("");
    editor.chain().focus().insertContent(`<h3>References</h3>${items}`).run();
    toast.success(`Bibliography with ${list.length} sources inserted`);
  }, [editor]);

  const insertQuote = useCallback((text: string, sourceUrl: string) => {
    const safe = text.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch] || ch));
    editor?.chain().focus().insertContent(`<blockquote>${safe}<br/>— <a href="${sourceUrl}" rel="noreferrer">${sourceUrl}</a></blockquote><p></p>`).run();
    toast.success("Excerpt inserted");
  }, [editor]);

  // ── AI agent (writer mode) ───────────────────────────────────────
  const toggleTrackChanges = useCallback(() => {
    trackRef.current = !trackRef.current;
    setTrackChanges(trackRef.current);
    toast.info(trackRef.current ? "Track changes ON — edits are recorded" : "Track changes OFF");
  }, []);

  const addCommentOnSelection = useCallback(() => {
    const body = window.prompt("Comment text / टिप्पणी:");
    if (!body?.trim()) return;
    editor?.commands.addWriterComment("You", body.trim());
    setDirty(true);
    toast.success("Comment added");
  }, [editor]);

  const acceptAllChanges = useCallback(() => {
    if (!editor) return;
    const { state, view } = editor;
    const tr = state.tr;
    tr.removeMark(0, state.doc.content.size, state.schema.marks.trackInsert);
    // deletions become real removals
    const delRanges: Array<[number, number]> = [];
    state.doc.descendants((node, pos) => {
      if (node.isText && node.marks.some((m) => m.type.name === "trackDelete")) {
        delRanges.push([pos, pos + node.nodeSize]);
      }
      return true;
    });
    for (let i = delRanges.length - 1; i >= 0; i--) {
      const [a, b] = delRanges[i];
      tr.delete(a, b);
    }
    tr.removeMark(0, tr.doc.content.size, state.schema.marks.trackDelete);
    view.dispatch(tr);
    toast.success("All changes accepted");
  }, [editor]);

  const rejectAllChanges = useCallback(() => {
    if (!editor) return;
    const { state, view } = editor;
    const tr = state.tr;
    // insertions are removed
    const insRanges: Array<[number, number]> = [];
    state.doc.descendants((node, pos) => {
      if (node.isText && node.marks.some((m) => m.type.name === "trackInsert")) {
        insRanges.push([pos, pos + node.nodeSize]);
      }
      return true;
    });
    for (let i = insRanges.length - 1; i >= 0; i--) {
      const [a, b] = insRanges[i];
      tr.delete(a, b);
    }
    tr.removeMark(0, tr.doc.content.size, state.schema.marks.trackDelete);
    view.dispatch(tr);
    toast.success("All changes rejected");
  }, [editor]);


  const getAgentContext = useCallback((): Record<string, unknown> => ({
    documentName: docName,
    page: { size: settings.pageSize, orientation: settings.orientation },
    wordCount: counts.words,
    selectedText: (() => {
      const { from, to } = editor?.state.selection ?? { from: 0, to: 0 };
      try { return editor?.state.doc.textBetween(from, to, " ")?.slice(0, 300) ?? null; } catch { return null; }
    })(),
  }), [docName, settings.pageSize, settings.orientation, counts.words, editor]);

  const executeAgentAction = useCallback((action: Record<string, unknown>) => {
    if (!editor) return;
    const kind = String(action.action || "");
    const text = String(action.text ?? "");
    switch (kind) {
      case "insert_text_at_cursor":
        if (text) editor.chain().focus().insertContent(text).run();
        break;
      case "add_bullet_points": {
        const items = Array.isArray(action.items) ? action.items.map(String).filter(Boolean) : [];
        if (items.length) {
          editor.chain().focus().insertContent(
            items.map((t) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] })),
          ).run();
        }
        break;
      }
      case "replace_selected_text": {
        const { from, to } = editor.state.selection;
        if (from !== to) {
          editor.chain().focus().insertContentAt({ from, to }, text).run();
        } else {
          editor.chain().focus().insertContent(text).run();
        }
        break;
      }
      case "replace_document_text":
      case "add_text":
      case "add_heading":
      default:
        if (text) editor.chain().focus().insertContent(text).run();
        break;
    }
  }, [editor]);


  const setPageNumber = useCallback((pos: WriterSettings["pageNumber"]) => {
    setSettings((s) => ({ ...s, pageNumber: pos, footerOn: pos !== "none" ? true : s.footerOn }));
    setDirty(true);
    if (pos !== "none") toast.success(`Page numbers: bottom-${pos.split("-")[1]}`);
  }, []);

  const togglePainter = useCallback((marks?: { type: string; attrs: Record<string, unknown> }[]) => {
    if (marks) setPainter(marks);
    else setPainter(null);
  }, []);

  // apply captured marks on the next click in the document
  useEffect(() => {
    if (!editor || !painter) return;
    const onUp = () => {
      const sel = editor.state.selection;
      if (!sel.empty) {
        let chain = editor.chain().focus().unsetAllMarks();
        for (const m of painter) chain = chain.setMark(m.type as never, m.attrs as never);
        chain.run();
        setPainter(null);
        toast.success("Format painted");
      }
    };
    const dom = editor.view.dom as HTMLElement;
    dom.addEventListener("mouseup", onUp);
    return () => dom.removeEventListener("mouseup", onUp);
  }, [editor, painter]);

  const setFind = useCallback((patch: { query?: string; caseSensitive?: boolean; index?: number }) => {
    if (editor) setFindState(editor, patch);
  }, [editor]);

  const openFindReplace = useCallback((showReplace = false) => {
    setFindShowReplace(showReplace);
    setFindOpen(true);
  }, []);
  const openHeaderFooter = useCallback(() => setHfOpen(true), []);

  const find = useMemo(() => ({ query: "", caseSensitive: false, index: 0 }), []);

  if (!editor) return <div className="h-screen" />;

  const { pw, ph } = geom;
  const contentW = Math.max(80, pw - settings.marginLeft - settings.marginRight);

  const ctx: WriterCtx = {
    editor, settings, update,
    zoom, setZoom, focusMode, setFocusMode,
    toggleRibbon: () => setRibbonCollapsed((c) => !c),
    spellCheck,
    toggleSpellCheck: () => {
      setSpellCheck((s) => !s);
      (editor.view.dom as HTMLElement).spellcheck = !spellCheck;
    },
    painterActive: !!painter,
    togglePainter,
    counts,
    find, setFind,
    openFindReplace, openHeaderFooter,
    insertWordArt: () => setWordArtOpen(true),
    insertSymbol, insertImageFile, insertImageUrl, insertLink,
    insertTextbox, insertShape, insertPageBreak, insertDivider, insertTable,
    setPageNumber,
    exportDocx: doExportDocx, exportPdf: () => pdfMutation.mutate(), exporting,
    trackChanges,
    toggleTrackChanges,
    addCommentOnSelection,
    acceptAllChanges,
    rejectAllChanges,
  };

  const insertToken = (token: string) => {
    editor.chain().focus().insertContent(`<span class="writer-token" data-token="${token}">${token}</span>&nbsp;`).run();
  };

  const pageCount = Math.max(1, pages);

  return (
    <div className="relative h-screen flex flex-col bg-[#e8ecf1] overflow-hidden">
      <style>{TOKEN_CSS}</style>

      {/* Title bar */}
      <div className={`flex items-center gap-2 px-3 h-12 border-b bg-background shrink-0 ${focusMode ? "hidden" : ""}`}>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/dashboard/designer")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input value={docName} onChange={(e) => { setDocName(e.target.value); setDirty(true); }} className="w-52 h-7 text-sm font-medium" />
        <span className="text-[10px] text-slate-400 hidden md:inline">writer2 · word-mode</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setSidePanel(sidePanel === "research" ? "none" : "research")}>
            <BookOpen className="h-3.5 w-3.5" /> Research &amp; AI
          </Button>
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
              <DropdownMenuItem onClick={doExportDocx} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Word Document (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => pdfMutation.mutate()}>
                <FileOutput className="h-4 w-4 mr-2" /> PDF — Print-ready (server)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>
                <Download className="h-4 w-4 mr-2" /> Print / Save as PDF (browser)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                const html = `<html><head><meta charset="utf-8"><style>body{font-family:'${settings.font}',Arial;}</style></head><body>${editor.getHTML()}</body></html>`;
                const blob = new Blob([html], { type: "text/html" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${slugifyName(docName)}.html`;
                a.click();
              }}>
                Download HTML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Token bar */}
      {showTokenBar && !focusMode && (
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

      {/* Ribbon (hidden in focus mode) */}
      {!focusMode && (
        <Ribbon ctx={ctx} collapsed={ribbonCollapsed} onToggleCollapse={() => setRibbonCollapsed(false)} />
      )}
      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="absolute right-3 top-2 z-50 text-[10px] bg-slate-800/70 text-white rounded px-2 py-1"
        >
          Exit focus mode (Esc)
        </button>
      )}

      {/* Ruler (scales with zoom, aligned to page) */}
      {!focusMode && settings.ruler && (
        <div className="shrink-0 border-b border-slate-300 bg-[#eef2f7] overflow-hidden">
          <div style={{ width: pw * zoomScale, height: 24 * zoomScale, margin: "0 auto", overflow: "hidden" }}>
            <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "top left", width: pw }}>
              <WriterRuler
                settings={settings}
                contentWidth={contentW}
                offsetPx={settings.marginLeft}
                trailingPx={settings.marginRight}
              />
            </div>
          </div>
        </div>
      )}

      {/* Page canvas — paginated page bands with a single editor surface */}
      <div ref={scrollRef} className="flex-1 overflow-auto print:overflow-visible">
        <div
          style={{
            width: pw * zoomScale,
            height: (stackH || ph) * zoomScale,
            margin: "20px auto 48px",
          }}
        >
          <div
            className={`relative ${hasTallBlock ? "writer-has-tall" : ""}`}
            style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: "top left",
              width: pw,
              height: stackH || ph,
            }}
          >
            {/* page bands */}
            {Array.from({ length: pageCount }, (_, i) => (
              <div
                key={i}
                className={`writer-band ${settings.darkPageBorder ? "dark-border" : ""}`}
                style={{ top: i * (ph + PAGE_GAP), height: ph }}
              >
                {settings.headerOn && settings.headerText && (
                  <div
                    className="absolute text-center text-[9pt] text-slate-500 border-b border-slate-200 pb-1 truncate"
                    style={{
                      top: Math.max(6, settings.marginTop / 2 - 10),
                      left: settings.marginLeft,
                      right: settings.marginRight,
                    }}
                  >
                    {settings.headerText}
                  </div>
                )}
                {settings.footerOn && (
                  <div
                    className="absolute text-[8pt] text-slate-500 border-t border-slate-200 pt-1"
                    style={{
                      bottom: Math.max(6, settings.marginBottom / 2 - 12),
                      left: settings.marginLeft,
                      right: settings.marginRight,
                      textAlign: settings.pageNumber === "bottom-left" ? "left"
                        : settings.pageNumber === "bottom-right" ? "right" : "center",
                    }}
                  >
                    {settings.footerText}
                    {settings.pageNumber !== "none" && (
                      <span className="ml-2">Page {i + 1} of {pageCount}</span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* the single editable surface, laid over the bands at the content origin */}
            <div
              className={`writer-surface absolute ${settings.lineNumbers ? "writer-linenumbers" : ""}`}
              style={{
                left: settings.marginLeft,
                top: settings.marginTop,
                width: contentW,
                // CSS columns for the 2/3-column layout
                columnCount: settings.columns > 1 ? settings.columns : undefined,
                columnGap: settings.columns > 1 ? settings.columnSpacing : undefined,
                columnRule: settings.columns > 1 && settings.columnDivider ? "1px solid #cbd5e1" : undefined,
              }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar counts={counts} zoom={zoom} setZoom={setZoom} dirty={dirty} />

      {/* Research / AI drawer */}
      {sidePanel === "research" && (
        <div className="absolute right-0 top-0 bottom-0 w-80 z-40 shadow-2xl">
          <WriterSidePanel
            onClose={() => setSidePanel("none")}
            executeAgentAction={executeAgentAction}
            getAgentContext={getAgentContext}
            insertCitationMarker={insertCitationMarker}
            insertBibliography={insertBibliography}
            citations={citations}
            addCitation={addCitation}
            insertQuote={insertQuote}
          />
        </div>
      )}

      {/* Dialogs */}
      <FindReplaceDialog
        ctx={ctx}
        open={findOpen}
        showReplace={findShowReplace}
        onClose={() => { setFindOpen(false); setFind({ query: "" }); }}
      />
      <WordArtDialog
        open={wordArtOpen}
        onClose={() => setWordArtOpen(false)}
        onInsert={doInsertWordArt}
      />
      <HeaderFooterDialog ctx={ctx} open={hfOpen} onClose={() => setHfOpen(false)} />
    </div>
  );
}
