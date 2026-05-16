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
import { ArrowLeft, Download, CreditCard, Award, FileText, Printer } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
  const type = searchParams.get("type") || "id_cards";
  const [classId, setClassId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [examId, setExamId] = useState("");

  const { data: classes } = useQuery<any>({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const { data: templates } = useQuery<any>({
    queryKey: ["design-templates-cat", type],
    queryFn: async () => {
      const res = await api.get(`/design-studio/templates?category=${type}`);
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

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const endpoint =
        type === "id_cards"
          ? "/design-studio/bulk/id-cards"
          : type === "marksheets"
          ? "/design-studio/bulk/marksheets"
          : type === "admit_cards"
          ? "/design-studio/bulk/admit-cards"
          : "/design-studio/bulk/certificates";

      const payload: Record<string, string> = {
        class_id: classId,
        template_id: templateId,
      };
      if (examId) payload.exam_id = examId;

      const res = await api.post(endpoint, payload);
      return res.data;
    },
    onSuccess: (data) => {
      const generated = data?.data?.cards || data?.data?.marksheets || [];
      if (generated?.length) {
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
            background: "#ffffff"
          };
        });
        const bulkSessionId = Date.now().toString();
        const payload = { version: "multi-page", pages: pagesData };
        (window as any).__bulkSessionData = payload; // Fast, reliable for soft navigations
        try {
          sessionStorage.setItem(`bulk_${bulkSessionId}`, JSON.stringify(payload));
        } catch (err: any) {
          console.warn("Storage quota exceeded. Relying on transient window state.");
        }
        router.push(`/dashboard/designer/editor?bulk_session=${bulkSessionId}`);
      } else if (data?.data?.download_url) {
        window.open(data.data.download_url, "_blank");
        toast.success("Bulk generation complete! Downloading...");
      } else {
        toast.success("Generation started. Check downloads when ready.");
      }
    },
    onError: () => toast.error("Bulk generation failed"),
  });

  const typeConfig: Record<string, { icon: React.ElementType; label: string; desc: string }> = {
    id_cards: { icon: CreditCard, label: "Bulk ID Cards", desc: "Generate ID cards for all students in a class" },
    marksheets: { icon: FileText, label: "Bulk Marksheets", desc: "Generate marksheets for every student in a class" },
    certificates: { icon: Award, label: "Bulk Certificates", desc: "Generate certificates for students" },
    admit_cards: { icon: FileText, label: "Bulk Admit Cards", desc: "Generate exam admit cards" },
  };

  const config = typeConfig[type] || typeConfig.id_cards;
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <Link href="/dashboard/designer">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{config.label}</h1>
          <p className="text-muted-foreground">{config.desc}</p>
        </div>
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
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>
                  {(classes || []).map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            {(type === "admit_cards" || type === "marksheets") && (
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

            <Button
              className="w-full"
              onClick={() => bulkMutation.mutate()}
              disabled={!classId || !templateId || bulkMutation.isPending || ((type === "marksheets" || type === "admit_cards") && !examId)}
            >
              <Download className="h-4 w-4 mr-2" />
              {bulkMutation.isPending ? "Generating..." : "Generate Batch"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Output Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-semibold">What gets generated:</h4>
              {type === "id_cards" && (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>- Student photo, name, class, section</li>
                  <li>- Student ID number & barcode</li>
                  <li>- School logo, name, address</li>
                  <li>- Guardian contact on back</li>
                  <li>- One generated page per student in preview</li>
                </ul>
              )}
              {type === "marksheets" && (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>- Subject marks, totals, percentage, and rank</li>
                  <li>- School branding and template styling</li>
                  <li>- One generated page per student</li>
                  <li>- Download All opens a print-ready batch</li>
                </ul>
              )}
              {type === "certificates" && (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>- Student name, class, section</li>
                  <li>- Certificate type & title</li>
                  <li>- School logo & branding</li>
                  <li>- Principal signature field</li>
                  <li>- 1 certificate per A4 page</li>
                </ul>
              )}
              {type === "admit_cards" && (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>- Student photo, name, roll number</li>
                  <li>- Exam schedule (subject, date, time)</li>
                  <li>- QR code for verification</li>
                  <li>- School stamp field</li>
                  <li>- 2 admit cards per A4 page</li>
                </ul>
              )}
            </div>
              <div className="text-sm text-muted-foreground mt-4">
                <Badge variant="secondary">Designer Output</Badge>
                <span className="ml-2">Opens in visual designer for multi-page export</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

  );
}
