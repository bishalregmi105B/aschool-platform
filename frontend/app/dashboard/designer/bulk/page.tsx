"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Download, CreditCard, Award, FileText, Printer, Layers, FileOutput, ClipboardList } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type BulkType = "id_cards" | "marksheets" | "certificates" | "admit_cards" | "attendance_ledger";
type OutputMode = "editor" | "pdf" | "zip";

const TYPES: Array<{ id: BulkType; label: string; icon: React.ElementType }> = [
  { id: "id_cards", label: "ID Cards", icon: CreditCard },
  { id: "marksheets", label: "Marksheets", icon: FileText },
  { id: "admit_cards", label: "Admit Cards", icon: FileText },
  { id: "certificates", label: "Certificates", icon: Award },
  { id: "attendance_ledger", label: "Registers", icon: ClipboardList },
];

const TEMPLATE_CATEGORY: Record<BulkType, string> = {
  id_cards: "id_cards",
  marksheets: "marksheets",
  certificates: "certificates",
  admit_cards: "admit_cards",
  attendance_ledger: "registers",
};

const BS_MONTHS = [
  "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadau", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

function currentBsYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() + 57 : now.getFullYear() + 56;
}

function currentBsMonth(): number {
  return new Date().getMonth() + 1; // close enough for a default pick
}

export default function BulkPage() {
  return (
    <PluginGate slug="design_studio">
      <BulkContent />
    </PluginGate>
  );
}

function BulkContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [type, setType] = useState<BulkType>((searchParams.get("type") as BulkType) || "id_cards");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [examId, setExamId] = useState("");
  const [certType, setCertType] = useState("character");
  const [ledgerYear, setLedgerYear] = useState(String(currentBsYear()));
  const [ledgerMonth, setLedgerMonth] = useState(String(currentBsMonth()));
  const [output, setOutput] = useState<OutputMode>("pdf");
  const [progress, setProgress] = useState<string | null>(null);

  const { data: classes } = useQuery<any>({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const selectedClass = (classes || []).find((c: any) => c.id === classId);

  const { data: templates } = useQuery<any>({
    queryKey: ["design-templates-cat", type],
    queryFn: async () => {
      const res = await api.get(`/design-studio/templates?category=${TEMPLATE_CATEGORY[type]}`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const { data: exams } = useQuery<any>({
    queryKey: ["exams-list"],
    queryFn: async () => {
      const res = await api.get("/exams");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: type === "admit_cards" || type === "marksheets",
  });

  const needsExam = type === "admit_cards" || type === "marksheets";

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const endpoint =
        type === "id_cards" ? "/design-studio/bulk/id-cards"
        : type === "marksheets" ? "/design-studio/bulk/marksheets"
        : type === "admit_cards" ? "/design-studio/bulk/admit-cards"
        : type === "attendance_ledger" ? "/design-studio/bulk/attendance-ledger"
        : "/design-studio/bulk/certificates";

      const payload: Record<string, string> = { class_id: classId };
      if (type !== "attendance_ledger") payload.template_id = templateId;
      if (sectionId) payload.section_id = sectionId;
      if (examId) payload.exam_id = examId;
      if (type === "certificates") payload.certificate_type = certType;
      if (type === "attendance_ledger") {
        payload.month_bs = `${ledgerYear}-${String(Number(ledgerMonth)).padStart(2, "0")}`;
        payload.year_bs = ledgerYear;
      }

      setProgress("Generating records on the server…");
      const res = await api.post(endpoint, payload);
      return res.data;
    },
    onSuccess: async (data) => {
      const generated = data?.data?.cards || data?.data?.marksheets || data?.data?.certificates || data?.data?.pages || [];
      if (!generated?.length && !data?.data?.download_url) {
        toast.error("No records generated for this selection");
        setProgress(null);
        return;
      }

      if (output === "editor") {
        toast.success(`Generated ${generated.length} pages. Opening designer...`);
        const pagesData = generated.map((item: any, idx: number) => {
          const w = item.template_width || 794;
          const h = item.template_height || 1123;
          return {
            id: `bulk_${idx}_${Date.now()}`,
            json: item.canvas_json || {},
            width: w,
            height: h,
            orientation: w > h ? "landscape" : "portrait",
            margins: { top: 0, right: 0, bottom: 0, left: 0 },
            background: "#ffffff",
          };
        });
        const bulkSessionId = Date.now().toString();
        const payloadData = { version: "multi-page", pages: pagesData };
        (window as any).__bulkSessionData = payloadData;
        try {
          sessionStorage.setItem(`bulk_${bulkSessionId}`, JSON.stringify(payloadData));
        } catch (err: any) {
          console.warn("Storage quota exceeded. Relying on transient window state.");
        }
        setProgress(null);
        router.push(`/dashboard/designer/editor?bulk_session=${bulkSessionId}`);
        return;
      }

      if (output === "pdf") {
        // Server-side print-ready PDF (WeasyPrint) — Nepali-safe, one page per record
        setProgress("Building print-ready PDF…");
        try {
          const tplType = type === "id_cards" ? "id_cards" : type; // backend maps template ids
          const isCard = (generated[0]?.template_width ?? 794) < 500;
          const res = await api.post(
            "/design-studio/export/bulk-pdf",
            {
              template_id: templateId,
              items: generated.map((g: any) => ({
                data: g.data ?? g.fields ?? {},
                html: g.html ?? null,
              })),
              page_size: generated[0]?.template_width > generated[0]?.template_height ? "landscape" : "portrait",
              // card-sized documents (ID/admit cards) impose N-up onto A4
              // sheets with crop marks — what print shops actually print
              ...(isCard ? {
                layout: "sheet",
                card_width: generated[0]?.template_width ?? 300,
                card_height: generated[0]?.template_height ?? 189,
                columns: 2,
                rows: 5,
              } : {}),
            },
            { responseType: "blob" },
          );
          const url = URL.createObjectURL(res.data as Blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `bulk_${type}_${Date.now()}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(`PDF with ${generated.length} pages downloaded`);
        } catch {
          toast.error("Server PDF failed — falling back to designer export");
          // fall through to editor flow
          const pagesData = generated.map((item: any, idx: number) => ({
            id: `bulk_${idx}_${Date.now()}`,
            json: item.canvas_json || {},
            width: item.template_width || 794,
            height: item.template_height || 1123,
            orientation: (item.template_width || 794) > (item.template_height || 1123) ? "landscape" : "portrait",
            margins: { top: 0, right: 0, bottom: 0, left: 0 },
            background: "#ffffff",
          }));
          const bulkSessionId = Date.now().toString();
          (window as any).__bulkSessionData = { version: "multi-page", pages: pagesData };
          router.push(`/dashboard/designer/editor?bulk_session=${bulkSessionId}`);
        }
        setProgress(null);
        return;
      }

      // ZIP of per-record PNGs, client-rendered from canvas_json
      setProgress("Rendering PNGs…");
      try {
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        for (let i = 0; i < generated.length; i++) {
          const item = generated[i];
          setProgress(`Rendering ${i + 1} / ${generated.length}…`);
          const w = item.template_width || 794;
          const h = item.template_height || 1123;
          const dataUrl = await renderCanvasJson(item.canvas_json, w, h, item.student_name ?? "");
          if (dataUrl) {
            const label = (item.student_name ?? item.label ?? `page_${i + 1}`).replace(/\s+/g, "_");
            zip.file(`${String(i + 1).padStart(3, "0")}_${label}.png`, dataUrl.split(",")[1], { base64: true });
          }
        }
        setProgress("Zipping…");
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bulk_${type}_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`ZIP with ${generated.length} images downloaded`);
      } catch {
        toast.error("ZIP render failed — try the PDF output instead");
      }
      setProgress(null);
    },
    onError: () => {
      toast.error("Bulk generation failed");
      setProgress(null);
    },
  });

  const typeIcon = TYPES.find((t) => t.id === type)?.icon ?? CreditCard;
  const Icon = typeIcon;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/designer">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Bulk Generation</h1>
            <p className="text-muted-foreground">Generate documents for a whole class in one go</p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1"><Layers className="h-3 w-3" /> Designer</Badge>
      </div>

      {/* Type tabs */}
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button key={t.id} onClick={() => { setType(t.id); setTemplateId(""); setProgress(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all
              ${type === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" /> Generation Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
                <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>
                  {(classes || []).map((c: { id: string; name: string; sections?: { id: string; name: string }[] }) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type !== "attendance_ledger" && selectedClass?.sections?.length > 0 && (
              <div className="space-y-2">
                <Label>Section (optional)</Label>
                <Select value={sectionId} onValueChange={setSectionId}>
                  <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sections</SelectItem>
                    {selectedClass.sections.map((s: { id: string; name: string }) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type === "attendance_ledger" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>BS Year</Label>
                  <Select value={ledgerYear} onValueChange={setLedgerYear}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 4 }, (_, i) => String(currentBsYear() - 2 + i)).map((y) => (
                        <SelectItem key={y} value={y}>{y} BS</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>BS Month</Label>
                  <Select value={ledgerMonth} onValueChange={setLedgerMonth}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BS_MONTHS.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
            <div className="space-y-2">
              <Label>Select Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                <SelectContent>
                  {(templates || []).map((t: { id: string; name: string }) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            {needsExam && (
              <div className="space-y-2">
                <Label>Select Exam</Label>
                <Select value={examId} onValueChange={setExamId}>
                  <SelectTrigger><SelectValue placeholder="Choose an exam" /></SelectTrigger>
                  <SelectContent>
                    {(exams || []).map((e: { id: string; name: string }) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type === "certificates" && (
              <div className="space-y-2">
                <Label>Certificate Type</Label>
                <Select value={certType} onValueChange={setCertType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="character">Character Certificate</SelectItem>
                    <SelectItem value="transfer">Transfer Certificate</SelectItem>
                    <SelectItem value="merit">Merit Certificate</SelectItem>
                    <SelectItem value="participation">Participation Certificate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Output</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "pdf" as OutputMode, label: "Print PDF", icon: FileOutput, hint: "Best for print shops" },
                  { id: "editor" as OutputMode, label: "Designer", icon: Layers, hint: "Preview & export in editor" },
                  { id: "zip" as OutputMode, label: "PNG ZIP", icon: Download, hint: "One image per record" },
                ]).map((o) => (
                  <button key={o.id} onClick={() => setOutput(o.id)} title={o.hint}
                    className={`flex flex-col items-center gap-1 border rounded-lg p-2.5 text-xs transition-all
                      ${output === o.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}>
                    <o.icon className="h-4 w-4" />
                    {o.label}
                  </button>
                ))}
              </div>
              {output === "pdf" && (
                <p className="text-[10px] text-muted-foreground">
                  Print-ready server PDF — correct Nepali text, selectable, one page per record.
                </p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => bulkMutation.mutate()}
              disabled={!classId || bulkMutation.isPending || (needsExam && !examId) || (type !== "attendance_ledger" && !templateId)}
            >
              <Download className="h-4 w-4 mr-2" />
              {bulkMutation.isPending ? (progress || "Working…") : "Generate Batch"}
            </Button>
            {bulkMutation.isPending && progress && (
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full animate-pulse w-2/3 rounded-full" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>What gets generated</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              {type === "id_cards" && (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>- Student photo, name, class, section</li>
                  <li>- Student ID number & verification QR</li>
                  <li>- School logo, name, address</li>
                  <li>- One page per student</li>
                </ul>
              )}
              {type === "marksheets" && (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>- Subject marks, totals, percentage, and rank</li>
                  <li>- School branding and template styling</li>
                  <li>- One page per student</li>
                </ul>
              )}
              {type === "certificates" && (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>- Student name, class, section</li>
                  <li>- Selected certificate type & title</li>
                  <li>- Principal signature field</li>
                </ul>
              )}
              {type === "admit_cards" && (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>- Student photo, name, roll number</li>
                  <li>- Exam name, type & academic year</li>
                  <li>- QR code for verification</li>
                </ul>
              )}
              {type === "attendance_ledger" && (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>- 20 roll-wise rows × day columns 1..31</li>
                  <li>- P / A / L / H / Lv marks from real attendance</li>
                  <li>- Per-student present &amp; absent totals</li>
                  <li>- One A4 page per 20 students</li>
                </ul>
              )}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {output === "pdf" ? <Printer className="h-4 w-4" /> : <Badge variant="secondary">{output.toUpperCase()}</Badge>}
              {output === "pdf"
                ? "Single print-ready PDF — hand it straight to the print shop."
                : output === "editor"
                ? "Opens in the visual designer for multi-page preview and export."
                : "One PNG per record, named per student, zipped."}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Offscreen fabric render of a canvas_json → PNG data URL. */
async function renderCanvasJson(json: any, width: number, height: number, fallbackName = ""): Promise<string | null> {
  try {
    const { Canvas } = await import("fabric");
    const { preloadCanvasImages } = await import("@/lib/designer/canvasImages");
    const offscreen = document.createElement("canvas");
    const canvas = new Canvas(offscreen, {
      backgroundColor: "#ffffff",
      width, height,
      preserveObjectStacking: true,
      selection: false,
    });
    await new Promise<void>((resolve) => {
      if (json && Object.keys(json).length > 0) {
        // preload converts every image src to a data-URI (initials avatar
        // fallback for missing photos) — no more blank-white exports when a
        // single image 404s, and no canvas tainting
        preloadCanvasImages(JSON.parse(JSON.stringify(json)), { fallbackName })
          .then((safe) => canvas.loadFromJSON(safe, () => { canvas.renderAll(); resolve(); }))
          .catch(() => { canvas.renderAll(); resolve(); });
      } else resolve();
    });
    // one beat for async image decode, then rasterize at 300-DPI-class quality
    await new Promise((r) => setTimeout(r, 80));
    const url = canvas.toDataURL({ format: "png", multiplier: 3 });
    canvas.dispose();
    return url;
  } catch {
    return null;
  }
}
