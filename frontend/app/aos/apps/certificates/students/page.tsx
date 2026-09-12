"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { CreditCard as IdCard, Printer, Download, Archive } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AcademicClass { id: string; name: string; }
interface TemplateItem  { id: string; name: string; category: string; }
interface CardData {
  html: string;
  canvas_json: Record<string, any>;
  template_width: number;
  template_height: number;
  student_name?: string;
  student_roll?: string;
}
interface GeneratedCard {
  index: number;
  name: string;
  roll: string;
  pngDataUrl: string;
  status: "pending" | "rendering" | "done" | "error";
}

const TRANSPARENT_1PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/** Pre-fetch every fabric Image object's src and replace it with a data URI.
 *  This sidesteps CORS issues entirely — util.enlivenObjects never touches the network. */
async function embedImages(canvasJson: Record<string, any>): Promise<Record<string, any>> {
  const json = JSON.parse(JSON.stringify(canvasJson));
  const objects: any[] = json.objects ?? [];
  await Promise.all(
    objects.map(async (obj: any) => {
      if ((obj.type ?? "").toLowerCase() !== "image") return;
      const src: string = (obj.src ?? "").trim();
      if (!src) { obj.src = TRANSPARENT_1PX; return; }
      if (src.startsWith("data:")) return;
      try {
        // Keep non-absolute srcs same-origin (root-relative /uploads/... is
        // proxied to the backend by next.config.js) — never a Docker-internal host.
        const fullUrl = src;
        // Include auth token if present
        const cookieMatch = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
        const headers: Record<string, string> = cookieMatch
          ? { Authorization: `Bearer ${decodeURIComponent(cookieMatch[1])}` }
          : {};
        const resp = await fetch(fullUrl, { headers, credentials: "include" });
        obj.src = resp.ok ? await blobToDataURL(await resp.blob()) : TRANSPARENT_1PX;
      } catch {
        obj.src = TRANSPARENT_1PX;
      }
    })
  );
  return json;
}

async function renderCardToPng(card: CardData, scale = 4): Promise<string> {
  const w = card.template_width  || 300;
  const h = card.template_height || 189;

  if (card.canvas_json && Object.keys(card.canvas_json).length > 0) {
    // Render directly onto a raw HTMLCanvasElement using fabric's util layer.
    // Avoids instantiating fabric.Canvas / StaticCanvas entirely — those require
    // special DOM mounting (upperCanvasEl etc.) that breaks in detached scenarios.
    const { util } = await import("fabric") as any;

    const raw = document.createElement("canvas");
    raw.width  = Math.round(w * scale);
    raw.height = Math.round(h * scale);
    const ctx = raw.getContext("2d")!;
    ctx.scale(scale, scale);

    // Background colour / image fill
    const bg = card.canvas_json.background ?? card.canvas_json.backgroundColor;
    if (typeof bg === "string" && bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    // Pre-fetch images as data URIs so util.enlivenObjects never hits the network
    const embeddedJson = await embedImages(card.canvas_json);

    // Decode fabric objects and render each one
    const objects: any[] = await util.enlivenObjects(embeddedJson.objects ?? []);
    for (const obj of objects) {
      ctx.save();
      obj.render(ctx);
      ctx.restore();
    }

    return raw.toDataURL("image/png");
  }

  if (card.html) {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-99999px;top:0;width:" + w + "px;height:" + h + "px;border:none;";
    document.body.appendChild(iframe);
    const idoc = iframe.contentDocument!;
    idoc.write("<html><body style=\"margin:0;padding:0;width:" + w + "px;height:" + h + "px;overflow:hidden\">" + card.html + "</body></html>");
    idoc.close();
    return new Promise<string>((resolve, reject) => {
      setTimeout(async () => {
        try {
          const { default: html2canvas } = await import("html2canvas");
          const c = await html2canvas(idoc.body as HTMLElement, { scale, width: w, height: h, useCORS: true, logging: false });
          document.body.removeChild(iframe);
          resolve(c.toDataURL("image/png"));
        } catch (err) { document.body.removeChild(iframe); reject(err); }
      }, 300);
    });
  }

  throw new Error("No renderable content");
}

export default function StudentIdCardsPage() {
  const [selectedClassId,    setSelectedClassId]    = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [cards,              setCards]              = useState<GeneratedCard[]>([]);
  const [renderPhase,        setRenderPhase]        = useState<"idle" | "rendering" | "done">("idle");
  const [renderProgress,     setRenderProgress]     = useState(0);
  const abortRef = useRef(false);

  const { data: classes, isLoading: isClassesLoading } = useQuery({
    queryKey: ["academic-classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AcademicClass[]>>("/academics/classes?limit=100");
      return res.data.data;
    },
  });

  const { data: idCardTemplates = [], isLoading: isTemplatesLoading } = useQuery({
    queryKey: ["design-templates", "id_cards"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TemplateItem[]>>("/design-studio/templates?category=id_cards");
      return res.data.data || [];
    },
  });

  useEffect(() => {
    if (selectedTemplateId || !idCardTemplates.length) return;
    setSelectedTemplateId(
      idCardTemplates.find((t) => t.id === "id_card_standard")?.id || idCardTemplates[0].id
    );
  }, [idCardTemplates, selectedTemplateId]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/design-studio/bulk/id-cards", {
        class_id: selectedClassId, template_id: selectedTemplateId,
      });
      return res.data;
    },
    onSuccess: async (data: any) => {
      const rawCards: CardData[] = (data.cards || data.data?.cards || [])
        .map((c: any) => {
          if (typeof c === "string")
            return { html: c, canvas_json: {}, template_width: 300, template_height: 189, student_name: "", student_roll: "" };
          return {
            html:            c?.html || "",
            canvas_json:     c?.canvas_json || {},
            template_width:  Number(c?.template_width)  || 300,
            template_height: Number(c?.template_height) || 189,
            student_name:    c?.student_name || ("Student " + (c?.index ?? "")),
            student_roll:    c?.student_roll || "",
          };
        })
        .filter((c: CardData) => c.html || Object.keys(c.canvas_json).length > 0);

      if (!rawCards.length) { toast.error("No cards generated"); return; }
      toast.success("Loaded " + rawCards.length + " cards \u2014 rendering PNGs\u2026");

      abortRef.current = false;
      setRenderPhase("rendering");
      setRenderProgress(0);
      const result: GeneratedCard[] = rawCards.map((c, i) => ({
        index: i,
        name: c.student_name || ("Student " + (i + 1)),
        roll: c.student_roll || String(i + 1),
        pngDataUrl: "",
        status: "pending" as const,
      }));
      setCards([...result]);

      for (let i = 0; i < rawCards.length; i++) {
        if (abortRef.current) break;
        result[i].status = "rendering";
        setCards([...result]);
        try {
          result[i].pngDataUrl = await renderCardToPng(rawCards[i]);
          result[i].status = "done";
        } catch {
          result[i].status = "error";
        }
        setRenderProgress(Math.round(((i + 1) / rawCards.length) * 100));
        setCards([...result]);
      }
      setRenderPhase("done");
      toast.success("All ID cards rendered!");
    },
    onError: () => toast.error("Failed to generate ID cards. Please try again."),
  });

  const downloadOne = useCallback((card: GeneratedCard) => {
    const a = document.createElement("a");
    a.href = card.pngDataUrl;
    a.download = "id-card-" + card.name.replace(/\s+/g, "_") + ".png";
    a.click();
  }, []);

  const downloadZip = useCallback(async () => {
    const done = cards.filter((c) => c.status === "done");
    if (!done.length) return;
    try {
      const JSZip  = (await import("jszip")).default;
      const zip    = new JSZip();
      const folder = zip.folder("id-cards")!;
      done.forEach((card) => {
        const b64 = card.pngDataUrl.split(",")[1];
        folder.file(
          "id-card-" + String(card.index + 1).padStart(3, "0") + "-" + card.name.replace(/\s+/g, "_") + ".png",
          b64, { base64: true },
        );
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "student-id-cards.zip"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("ZIP generation failed"); }
  }, [cards]);

  const printAll = useCallback(() => {
    const done = cards.filter((c) => c.status === "done");
    if (!done.length) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      "<html><head><title>Print ID Cards</title><style>" +
      "*{box-sizing:border-box}" +
      "body{margin:0;padding:16px;background:#f0f0f0;font-family:sans-serif}" +
      ".grid{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}" +
      ".card{width:300px;height:189px;overflow:hidden;break-inside:avoid;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.15)}" +
      ".card img{width:100%;height:100%;display:block}" +
      ".btn{position:fixed;top:12px;right:12px;padding:10px 20px;background:#000;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;z-index:999}" +
      "@media print{.btn{display:none}body{background:white;padding:0}}" +
      "</style></head><body>" +
      "<button class='btn' onclick='window.print()'>Print</button>" +
      "<div class='grid'>" +
      done.map((c) => "<div class='card'><img src='" + c.pngDataUrl + "' alt='" + c.name + "'/></div>").join("") +
      "</div></body></html>"
    );
    win.document.close();
  }, [cards]);

  const doneCount    = cards.filter((c) => c.status === "done").length;
  const errorCount   = cards.filter((c) => c.status === "error").length;
  const isGenerating = generateMutation.isPending || renderPhase === "rendering";

  if (isClassesLoading || isTemplatesLoading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IdCard className="h-6 w-6" /> Bulk Student ID Cards
          </h1>
          <p className="text-muted-foreground">Generate high-quality PNG ID cards for an entire class</p>
        </div>
        {renderPhase === "done" && doneCount > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={printAll}>
              <Printer className="h-4 w-4 mr-2" /> Print All
            </Button>
            <Button onClick={downloadZip}>
              <Archive className="h-4 w-4 mr-2" /> Download ZIP ({doneCount})
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Generation Options</CardTitle>
          <CardDescription>Select a class to generate ID cards for all active students</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <Label>Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isGenerating}>
                <SelectTrigger><SelectValue placeholder="Choose a class..." /></SelectTrigger>
                <SelectContent>
                  {(classes || []).map((c: AcademicClass) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={isGenerating}>
                <SelectTrigger><SelectValue placeholder="Choose a template..." /></SelectTrigger>
                <SelectContent>
                  {idCardTemplates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => { setCards([]); setRenderPhase("idle"); generateMutation.mutate(); }}
            disabled={!selectedClassId || !selectedTemplateId || isGenerating}
          >
            {isGenerating ? <Spinner size="sm" className="mr-2" /> : <IdCard className="h-4 w-4 mr-2" />}
            {isGenerating ? "Generating..." : renderPhase === "done" ? "Regenerate" : "Generate Bulk ID Cards"}
          </Button>

          {renderPhase === "rendering" && (
            <div className="space-y-1 max-w-md">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Rendering PNG {doneCount + errorCount} / {cards.length}</span>
                <span>{renderProgress}%</span>
              </div>
              <Progress value={renderProgress} className="h-2" />
            </div>
          )}
          {renderPhase === "done" && (
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="default">{doneCount} rendered</Badge>
              {errorCount > 0 && <Badge variant="destructive">{errorCount} failed</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {cards.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Generated ID Cards
            {renderPhase === "rendering" && (
              <span className="text-muted-foreground font-normal text-sm ml-2">rendering...</span>
            )}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {cards.map((card) => (
              <div
                key={card.index}
                className="group relative rounded-lg overflow-hidden border bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                {card.status === "done" ? (
                  <>
                    <img
                      src={card.pngDataUrl}
                      alt={card.name}
                      className="w-full block"
                      style={{ aspectRatio: "300/189" }}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button size="sm" variant="secondary" onClick={() => downloadOne(card)}>
                        <Download className="h-3 w-3 mr-1" /> PNG
                      </Button>
                    </div>
                    <div className="px-2 py-1.5 bg-white border-t">
                      <p className="text-xs font-medium truncate">{card.name}</p>
                      <p className="text-xs text-muted-foreground">Roll: {card.roll}</p>
                    </div>
                  </>
                ) : card.status === "error" ? (
                  <div
                    className="flex flex-col items-center justify-center p-4 text-destructive"
                    style={{ aspectRatio: "300/189" }}
                  >
                    <span className="text-xs text-center">Render failed</span>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center gap-1"
                    style={{ aspectRatio: "300/189" }}
                  >
                    <Spinner size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {card.status === "rendering" ? "Rendering..." : "Queued"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

