"use client";
/**
 * CanvasEditor — Canva-like canvas designer
 * Layout: [Icon Bar 64px] | [Sliding Panel 280px] | [Canvas] | [Properties 280px]
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useCanvas, PAGE_SIZES } from "@/lib/hooks/useCanvas";
import { useExport } from "@/lib/hooks/useExport";

import { Button }   from "@/components/ui/button";
import { FilePicker } from "@/components/files/FilePicker";
import { Input }    from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Save, Download, Undo2, Redo2, ZoomIn, ZoomOut,
  Sparkles, ChevronDown, Plus, FileJson, X,
  LayoutTemplate, Shapes, Type, Image as ImageIcon,
  Palette, Upload, Search, Copy, Trash2,
  ArrowUp, ArrowDown, FlipHorizontal, FlipVertical,
} from "lucide-react";

import PropertiesPanel from "./PropertiesPanel";
import AIAssistPanel   from "./AIAssistPanel";
import DataFillPanel   from "./DataFillPanel";

const SHAPE_GROUPS = [
  { label: "Basic",    shapes: [{ id:"rect",label:"Rectangle",emoji:"⬜"},{ id:"circle",label:"Circle",emoji:"⭕"},{ id:"triangle",label:"Triangle",emoji:"🔺"},{ id:"line",label:"Line",emoji:"➖"},{ id:"arrow",label:"Arrow",emoji:"➡"}] },
  { label: "Polygons", shapes: [{ id:"poly5",label:"Pentagon",emoji:"⬠"},{ id:"poly6",label:"Hexagon",emoji:"⬡"},{ id:"poly8",label:"Octagon",emoji:"🔷"}] },
  { label: "Stars",    shapes: [{ id:"star4",label:"Star 4pt",emoji:"✦"},{ id:"star5",label:"Star 5pt",emoji:"⭐"},{ id:"star6",label:"Star 6pt",emoji:"✶"}] },
];

const BG_PRESETS = [
  "#ffffff","#f8fafc","#f1f5f9","#e2e8f0","#fef3c7","#fce7f3","#ede9fe","#d1fae5",
  "#dbeafe","#fee2e2","#fdf4ff","#f0fdf4","#1e293b","#0f172a","#18181b","#7c2d12",
];

type PanelId = "templates"|"elements"|"text"|"media"|"background"|"data"|null;

const SIDEBAR_ICONS = [
  { id:"templates" as PanelId, icon:"📄", label:"Templates" },
  { id:"elements"  as PanelId, icon:"⬜", label:"Shapes"    },
  { id:"text"      as PanelId, icon:"T",  label:"Text"      },
  { id:"media"     as PanelId, icon:"🖼", label:"Media"     },
  { id:"background"as PanelId, icon:"🎨", label:"Background"},
  { id:"data"      as PanelId, icon:"📋", label:"Data Fill" },
];

export default function CanvasEditor() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const docId        = searchParams.get("doc");
  const templateId   = searchParams.get("template");
  const bulkSessionId = searchParams.get("bulk_session");

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const canvas         = useCanvas(canvasRef);
  const { exportPDF, exportPNG } = useExport();

  const [docName, setDocName]         = useState("Untitled Design");
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [showAI, setShowAI]           = useState(false);
  const [bgColor, setBgColor]         = useState("#ffffff");
  const [imgUrlInput, setImgUrlInput] = useState("");
  const [tplSearch, setTplSearch]     = useState("");
  const [unsplashQ, setUnsplashQ]     = useState("");
  const [unsplashResults, setUnsplashResults] = useState<string[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const templateLoadedRef = useRef(false);
  const docLoadedRef      = useRef(false);
  const importFileRef     = useRef<HTMLInputElement>(null);

  const { data: docData } = useQuery({
    queryKey: ["designer-doc", docId],
    queryFn: async () => { const r = await api.get(`/design-studio/documents/${docId}`); return r.data?.data; },
    enabled: !!docId,
  } as any);

  useEffect(() => {
    if (!docData || docLoadedRef.current || !canvas.isReady) return;
    docLoadedRef.current = true;
    const doc = docData as any;
    setDocName(doc.name || "Untitled Design");
    if (doc.canvas_state) canvas.loadJSON(doc.canvas_state);
  }, [docData, canvas, canvas.isReady]);

  const { data: allTemplates = [] } = useQuery({
    queryKey: ["design-templates"],
    queryFn: async () => {
      const r = await api.get("/design-studio/templates");
      return Array.isArray(r.data?.data) ? r.data.data : [];
    },
  });

  useEffect(() => {
    if (!templateId || docId || templateLoadedRef.current || !allTemplates?.length || !canvas.isReady) return;
    const tpl = allTemplates.find((t: any) => t.id === templateId);
    if (!tpl) return;
    templateLoadedRef.current = true;
    setDocName(tpl.name);
    if (tpl.canvas_json && Object.keys(tpl.canvas_json).length > 0) {
      if (tpl.canvas_json.version === "multi-page") {
        canvas.loadJSON(tpl.canvas_json as any);
      } else {
        canvas.loadFromTemplateJson(tpl.canvas_json, tpl.width, tpl.height);
      }
    } else canvas.loadPreset(tpl.id, tpl.category, tpl.page_size);
  }, [templateId, docId, allTemplates, canvas, canvas.isReady]);

  useEffect(() => {
    if (!bulkSessionId || docLoadedRef.current || !canvas.isReady) return;
    const globalData = (window as any).__bulkSessionData;
    const key = `bulk_${bulkSessionId}`;
    const dataStr = sessionStorage.getItem(key);
    
    if (globalData || dataStr) {
      docLoadedRef.current = true;
      setDocName("Bulk Generation");
      try {
        const parsed = globalData || JSON.parse(dataStr!);
        canvas.loadJSON(parsed);
        delete (window as any).__bulkSessionData;
      } catch (err) {
        toast.error("Failed to load bulk data");
      }
    }
  }, [bulkSessionId, canvas, canvas.isReady]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fullJSON = canvas.toFullJSON();
      const thumb = (() => { try { const fc = (window as any).__activeCanvas; return fc ? fc.toDataURL({ format:"jpeg", quality:0.4, multiplier:0.3 }) : ""; } catch { return ""; } })();
      const payload: any = { name: docName, template_type: templateId || "custom", canvas_state: fullJSON, thumbnail_url: thumb };
      if (docId) payload.id = docId;
      const r = await api.post("/design-studio/documents", payload);
      return r.data?.data;
    },
    onSuccess: (data) => {
      toast.success("Design saved");
      if (!docId && data?.id) router.replace(`/dashboard/designer/editor?doc=${data.id}`);
    },
    onError: () => toast.error("Failed to save"),
  });

  const handleExport = useCallback(async (format: "pdf"|"png"|"json") => {
    const name = docName.replace(/\s+/g,"_").toLowerCase();
    if (format === "json") {
      const blob = new Blob([JSON.stringify(canvas.toFullJSON(), null, 2)], { type:"application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.aschool-design`; a.click(); URL.revokeObjectURL(a.href);
      return;
    }
    const fc = (window as any).__activeCanvas;
    if (!fc) { toast.error("Canvas not ready"); return; }
    const multiPageDoc = canvas.toFullJSON() as any;
    if (format === "pdf") await exportPDF(fc, `${name}.pdf`, multiPageDoc);
    else await exportPNG(fc, `${name}.png`, multiPageDoc);
  }, [docName, canvas, exportPDF, exportPNG]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { canvas.loadJSON(JSON.parse(ev.target?.result as string)); setDocName(file.name.replace(/\.(aschool-design|json)$/, "")); toast.success("Design loaded"); } catch { toast.error("Invalid file"); } };
    reader.readAsText(file); e.target.value = "";
  };

  const handleShape = (id: string) => {
    const map: Record<string, () => void> = {
      rect: canvas.addRect, circle: canvas.addCircle, triangle: canvas.addTriangle,
      line: canvas.addLine, arrow: canvas.addArrow,
      poly5: () => canvas.addPolygon(5), poly6: () => canvas.addPolygon(6), poly8: () => canvas.addPolygon(8),
      star4: () => canvas.addStar(4), star5: () => canvas.addStar(5), star6: () => canvas.addStar(6),
    };
    map[id]?.();
  };

  const searchUnsplash = () => {
    if (!unsplashQ.trim()) return;
    setUnsplashResults(Array.from({ length: 9 }, (_, i) =>
      `https://source.unsplash.com/200x200/?${encodeURIComponent(unsplashQ)}&sig=${Date.now() + i}`
    ));
  };

  const zoom = canvas.zoom;
  const currentSizeName = Object.entries(PAGE_SIZES).find(
    ([, v]) => v.width === canvas.currentPageSettings?.width && v.height === canvas.currentPageSettings?.height
  )?.[0] ?? "Custom";
  const filteredTemplates = allTemplates.filter((t: any) => !tplSearch || t.name.toLowerCase().includes(tplSearch.toLowerCase()));

  const applyDataFields = useCallback((fields: Record<string, string>) => {
    const fc = (window as any).__activeCanvas;
    if (!fc || !fields || Object.keys(fields).length === 0) {
      toast.error("No data available to apply");
      return;
    }

    const replaceTokens = (value: string) => {
      let out = value;
      Object.entries(fields).forEach(([key, raw]) => {
        const v = raw == null ? "" : String(raw);
        out = out.replaceAll(`{{${key}}}`, v);
        out = out.replaceAll(`{${key}}`, v);
      });
      return out;
    };

    // Templates may reference the same image under legacy token names.
    const imageField = (key: string) => {
      if (key === "photo") return fields.photo || fields.photo_url || fields.student_photo || "";
      if (key === "photo_url") return fields.photo_url || fields.photo || "";
      return fields[key] || "";
    };

    let changed = 0;
    const pendingImages: Promise<void>[] = [];
    fc.getObjects().forEach((obj: any) => {
      const type = String(obj.type || "").toLowerCase();
      if (["textbox", "text", "i-text"].includes(type) && typeof obj.text === "string") {
        const next = replaceTokens(obj.text);
        if (next !== obj.text) {
          obj.set({ text: next });
          changed += 1;
        }
        return;
      }
      if (type === "image") {
        // placeholders survive as data.token when src was sanitized to ""
        const tokenSrc: string = obj.data?.token
          || (typeof obj.src === "string" && obj.src.includes("{") ? obj.src : "");
        const tokenMatch = tokenSrc.match(/\{\{?(\w+)\}?\}/);
        if (tokenMatch) {
          const next = imageField(tokenMatch[1]);
          if (next && next !== obj.src) {
            const target = obj;
            const frame = { width: target.width, height: target.height, scaleX: target.scaleX ?? 1, scaleY: target.scaleY ?? 1 };
            pendingImages.push(
              target.setSrc(next, { crossOrigin: "anonymous" })
                .then(() => {
                  // setSrc adopts the image's natural size — restore the template frame
                  target.set({ ...frame, dirty: true });
                  target.setCoords();
                  fc.renderAll();
                })
                .then(() => { target.data = { ...(target.data ?? {}), token: undefined }; })
                .catch(() => { /* image unavailable — leave placeholder slot */ })
            );
            changed += 1;
          }
        }
      }
    });

    if (pendingImages.length > 0) {
      Promise.allSettled(pendingImages).then(() => {
        fc.requestRenderAll();
        canvas.snapshot();
      });
    }

    if (changed > 0) {
      fc.renderAll();
      if (pendingImages.length === 0) canvas.snapshot();
      toast.success(`Applied data to ${changed} layer${changed > 1 ? "s" : ""}`);
    } else {
      toast.info("No placeholders found. Use {field_name} tokens in text or image layers.");
    }
  }, [canvas]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-muted/20">
        <input ref={importFileRef} type="file" accept=".json,.aschool-design" className="hidden" onChange={handleImport} />
        <FilePicker
          open={showImagePicker}
          onOpenChange={setShowImagePicker}
          fileType="image"
          title="Select Image"
          onSelect={(files) => {
            const selected = files[0];
            if (selected?.url) {
              canvas.addImage(selected.url);
            }
          }}
        />

        {/* TOP BAR */}
        <div className="flex items-center gap-1.5 px-3 h-12 border-b bg-background shrink-0 z-10">
          <Link href="/dashboard/designer">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <Input value={docName} onChange={(e) => setDocName(e.target.value)} className="w-44 h-7 text-sm font-medium shrink-0" />
          <Select value={currentSizeName} onValueChange={(v) => canvas.changePageSize(v)}>
            <SelectTrigger className="w-24 h-7 text-xs shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.keys(PAGE_SIZES).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2 shrink-0"
            onClick={() => canvas.updatePageSettings({ orientation: canvas.currentPageSettings?.orientation === "portrait" ? "landscape" : "portrait" })}>
            {canvas.currentPageSettings?.orientation === "portrait" ? "Portrait" : "Landscape"}
          </Button>
          <Separator orientation="vertical" className="h-6 shrink-0" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.undo} disabled={!canvas.canUndo}><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.redo} disabled={!canvas.canRedo}><Redo2 className="h-3.5 w-3.5" /></Button>
          <Separator orientation="vertical" className="h-6 shrink-0" />
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => canvas.setZoomLevel(Math.max(zoom - 0.1, 0.2))}><ZoomOut className="h-3.5 w-3.5" /></Button>
            <button className="text-xs w-12 text-center hover:bg-muted rounded px-1 py-0.5" onClick={() => canvas.setZoomLevel(1)}>{Math.round(zoom * 100)}%</button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => canvas.setZoomLevel(Math.min(zoom + 0.1, 4))}><ZoomIn className="h-3.5 w-3.5" /></Button>
          </div>
          {canvas.selectedObject && (
            <>
              <Separator orientation="vertical" className="h-6 shrink-0" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.duplicateSelected}><Copy className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.bringToFront}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.sendToBack}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.flipHorizontal}><FlipHorizontal className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={canvas.flipVertical}><FlipVertical className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={canvas.deleteSelected}><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-violet-600" onClick={() => { setShowAI(!showAI); setActivePanel(null); }}>
              <Sparkles className="h-3.5 w-3.5" /> AI
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-3.5 w-3.5" />{saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("pdf")}>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("png")}>Export as PNG</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}><FileJson className="h-4 w-4 mr-2" />Save as .aschool-design</DropdownMenuItem>
                <DropdownMenuItem onClick={() => importFileRef.current?.click()}>Open .aschool-design File</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* BODY */}
        <div className="flex flex-1 min-h-0">
          {/* Icon bar */}
          <div className="flex flex-col items-center gap-1 py-3 w-16 border-r bg-background shrink-0">
            {SIDEBAR_ICONS.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setActivePanel(prev => prev === item.id ? null : item.id); setShowAI(false); }}
                    className={`flex flex-col items-center justify-center gap-0.5 w-12 h-14 rounded-xl text-[9px] font-medium transition-all
                      ${activePanel === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    <span className="text-lg leading-none">{item.icon}</span>
                    <span className="leading-none">{item.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Sliding panel */}
          {activePanel && (
            <div className="w-72 border-r bg-background shrink-0 flex flex-col overflow-hidden animate-in slide-in-from-left-2 duration-150">
              <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0">
                <span className="font-semibold text-sm capitalize">{activePanel}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActivePanel(null)}><X className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4">

                {activePanel === "templates" && (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Search…" value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} className="pl-7 h-8 text-xs" />
                    </div>
                    {filteredTemplates.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No templates found</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredTemplates.map((tpl: any) => (
                          <button key={tpl.id}
                            onClick={() => {
                              setDocName(tpl.name);
                              if (tpl.canvas_json && Object.keys(tpl.canvas_json).length > 0)
                                canvas.loadFromTemplateJson(tpl.canvas_json, tpl.width, tpl.height);
                              else canvas.loadPreset(tpl.id, tpl.category, tpl.page_size);
                              setActivePanel(null);
                            }}
                            className="group relative border rounded-lg overflow-hidden hover:border-primary hover:shadow-sm transition-all bg-muted/30"
                            style={{ paddingTop:"75%" }}
                          >
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-1.5">
                              <span className="text-3xl">{tpl.thumbnail_emoji ?? "📄"}</span>
                              <span className="text-[9px] text-center text-muted-foreground mt-1 leading-tight">{tpl.name}</span>
                            </div>
                            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activePanel === "elements" && (
                  <>
                    {SHAPE_GROUPS.map((group) => (
                      <div key={group.label}>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {group.shapes.map((s) => (
                            <button key={s.id} onClick={() => handleShape(s.id)}
                              className="flex flex-col items-center justify-center gap-1 border rounded-lg p-2.5 hover:bg-primary/5 hover:border-primary transition-all">
                              <span className="text-xl">{s.emoji}</span>
                              <span className="text-[9px] text-muted-foreground">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {activePanel === "text" && (
                  <>
                    <p className="text-[10px] text-muted-foreground">Click to add text to canvas</p>
                    <div className="space-y-2">
                      {[
                        { label:"Add a Heading",    action:() => canvas.addHeading(1), style:{fontSize:"22px", fontWeight:700} },
                        { label:"Add a Subheading", action:() => canvas.addHeading(2), style:{fontSize:"18px", fontWeight:600} },
                        { label:"Add body text",     action:() => canvas.addText("Body text"), style:{fontSize:"14px"} },
                        { label:"Add a caption",     action:() => canvas.addText("Caption", {fontSize:11}), style:{fontSize:"11px",color:"#64748b"} },
                      ].map((t) => (
                        <button key={t.label} onClick={t.action}
                          className="w-full text-left border rounded-lg px-3 py-2.5 hover:bg-primary/5 hover:border-primary transition-all"
                          style={t.style}>{t.label}</button>
                      ))}
                    </div>
                    <Separator />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">School Labels</p>
                    {["School Name","Student Name","Roll No","Class / Section","Date of Birth","Address","Phone","Academic Year"].map((label) => (
                      <button key={label} onClick={() => canvas.addText(label, {fontSize:13})}
                        className="w-full text-left text-xs px-2 py-1.5 border rounded hover:bg-muted transition-colors">{label}</button>
                    ))}
                  </>
                )}

                {activePanel === "media" && (
                  <>
                    <Button className="w-full h-10 gap-2" variant="outline" onClick={() => setShowImagePicker(true)}>
                      <Upload className="h-4 w-4" /> Upload Image
                    </Button>
                    <div>
                      <p className="text-xs font-medium mb-1.5">Image from URL</p>
                      <div className="flex gap-1.5">
                        <Input placeholder="https://..." value={imgUrlInput} onChange={(e) => setImgUrlInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && imgUrlInput.trim()) { canvas.addImage(imgUrlInput.trim()); setImgUrlInput(""); }}}
                          className="h-8 text-xs" />
                        <Button size="sm" className="h-8 px-2 text-xs shrink-0"
                          onClick={() => { if (imgUrlInput.trim()) { canvas.addImage(imgUrlInput.trim()); setImgUrlInput(""); }}}>Add</Button>
                      </div>
                    </div>
                    <Separator />
                    <p className="text-xs font-medium">Search Stock Photos</p>
                    <div className="flex gap-1.5">
                      <Input placeholder="Search Unsplash…" value={unsplashQ} onChange={(e) => setUnsplashQ(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchUnsplash()} className="h-8 text-xs" />
                      <Button size="sm" className="h-8 px-2 shrink-0 text-xs" onClick={searchUnsplash}>
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {unsplashResults.length > 0 && (
                      <div className="grid grid-cols-3 gap-1">
                        {unsplashResults.map((url, i) => (
                          <button key={i} onClick={() => canvas.addImage(url)}
                            className="aspect-square rounded overflow-hidden border hover:border-primary hover:scale-105 transition-all">
                            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activePanel === "background" && (
                  <>
                    <p className="text-xs font-medium">Solid Colors</p>
                    <div className="grid grid-cols-5 gap-2">
                      {BG_PRESETS.map((c) => (
                        <button key={c} onClick={() => { setBgColor(c); canvas.updatePageSettings({ background: c }); }}
                          className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${bgColor === c ? "border-primary ring-2 ring-primary/30" : "border-transparent"}`}
                          style={{ background: c }} title={c} />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs">Custom:</label>
                      <input type="color" value={bgColor}
                        onChange={(e) => { setBgColor(e.target.value); canvas.updatePageSettings({ background: e.target.value }); }}
                        className="w-8 h-8 rounded border cursor-pointer" />
                      <span className="text-xs font-mono text-muted-foreground">{bgColor}</span>
                    </div>
                    <Separator />
                    <p className="text-xs font-medium">Gradients</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[["#6366f1","#8b5cf6"],["#3b82f6","#06b6d4"],["#f59e0b","#ef4444"],["#10b981","#3b82f6"],["#ec4899","#8b5cf6"],["#1e293b","#334155"]].map(([c1,c2]) => (
                        <button key={`${c1}${c2}`}
                          onClick={() => canvas.updatePageSettings({ background: `linear-gradient(135deg, ${c1}, ${c2})` })}
                          className="h-10 rounded-lg border hover:scale-105 transition-transform"
                          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
                      ))}
                    </div>
                  </>
                )}

                {activePanel === "data" && (
                  <DataFillPanel onApply={applyDataFields} />
                )}

              </div>
            </div>
          )}

          {/* Canvas + pages strip */}
          <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background overflow-x-auto shrink-0">
              {canvas.pages.map((pg, idx) => (
                <button key={pg.id} onClick={() => canvas.goToPage(idx)}
                  className={`relative flex-shrink-0 flex items-center justify-center rounded border text-xs font-medium transition-all
                    ${canvas.currentPageIdx === idx ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "border-border bg-background hover:bg-muted"}`}
                  style={{ width:38, height:50 }}>
                  {idx+1}
                  {canvas.pages.length > 1 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[9px] flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); canvas.removePage(idx); }}>×</span>
                  )}
                </button>
              ))}
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 border border-dashed" onClick={canvas.addPage}><Plus className="h-3.5 w-3.5" /></Button>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">{canvas.currentPageIdx+1} / {canvas.pages.length}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center bg-[#f0f0f0] dark:bg-zinc-800 p-8">
              <div
                style={{
                  width: canvas.currentPageSettings?.width ?? 794,
                  height: canvas.currentPageSettings?.height ?? 1123,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  transition: "transform 0.12s ease",
                  flexShrink: 0,
                }}
              >
                <canvas ref={canvasRef} id="fabric-canvas" className="block shadow-2xl" />
              </div>
            </div>
          </div>

          {/* Right: Properties / AI */}
          <div className="w-64 border-l bg-background flex flex-col shrink-0">
            {showAI ? (
              <>
                <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-violet-500" /> AI Assist
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAI(false)}><X className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex-1 overflow-y-auto"><AIAssistPanel canvas={canvas} /></div>
              </>
            ) : (
              <>
                <div className="px-3 py-2 border-b shrink-0">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {canvas.selectedObject ? "Properties" : "Page Settings"}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto"><PropertiesPanel canvas={canvas} /></div>
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
