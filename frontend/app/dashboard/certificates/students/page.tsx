"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { CreditCard as IdCard, Printer, Users } from "lucide-react";
import { Label } from "@/components/ui/label";

interface AcademicClass {
  id: string;
  name: string;
}

interface TemplateItem {
  id: string;
  name: string;
  category: string;
}

export default function StudentIdCardsPage() {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const { data: classes, isLoading: isClassesLoading } = useQuery({
    queryKey: ["academic-classes"],
    queryFn: async () => {
      // Assuming a generic /classes endpoint exists for fetching academic classes
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
    const preferred = idCardTemplates.find((t) => t.id === "id_card_standard")?.id || idCardTemplates[0].id;
    setSelectedTemplateId(preferred);
  }, [idCardTemplates, selectedTemplateId]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/design-studio/bulk/id-cards", {
        class_id: selectedClassId,
        template_id: selectedTemplateId,
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      const rawCards = data.cards || data.data?.cards || [];
      const normalizedCards = Array.isArray(rawCards)
        ? rawCards
            .map((card: any) => {
              if (typeof card === "string") {
                return { html: card, template_width: 300, template_height: 189 };
              }
              return {
                html: card?.html || "",
                template_width: Number(card?.template_width) || 300,
                template_height: Number(card?.template_height) || 189,
              };
            })
            .filter((card: any) => card.html)
        : [];
      const cards = normalizedCards.map((card: any) => card.html);
      const firstCard = normalizedCards[0] || { template_width: 300, template_height: 189 };
      const templateWidth = firstCard.template_width;
      const templateHeight = firstCard.template_height;

      toast.success(`Successfully generated ${cards.length || data.count || data.data?.count || 0} ID Cards`);
      
      const newWin = window.open("", "_blank");
      if (newWin) {
        newWin.document.write(`
          <html>
            <head>
              <title>Student ID Cards Print Preview</title>
              <style>
                body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; }
                .grid-container { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; align-items: flex-start; }
                .id-card { width: ${templateWidth}px; height: ${templateHeight}px; background: white; border: 1px solid #ccc; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
                .id-card > * { width: ${templateWidth}px !important; height: ${templateHeight}px !important; }
                @media print { 
                  body { background: white; padding: 0; }
                  .no-print { display: none; } 
                }
              </style>
            </head>
            <body>
              <div class="no-print" style="margin-bottom: 20px; text-align: right; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 4px;">Print ID Cards</button>
              </div>
              <div class="grid-container">
                ${
                  cards.map((cardHtml: string) => `
                    <div class="id-card">${cardHtml}</div>
                  `).join("") || "<p>No ID cards were generated.</p>"
                }
              </div>
            </body>
          </html>
        `);
        newWin.document.close();
      }
    },
    onError: () => {
      toast.error("Failed to generate ID cards. Please try again.");
    }
  });

  if (isClassesLoading || isTemplatesLoading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IdCard className="h-6 w-6" /> Bulk Student ID Cards
          </h1>
          <p className="text-muted-foreground">Generate printable ID cards for an entire class</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Generation Options</CardTitle>
          <CardDescription>Select a class to instantly generate ID cards for all active students</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 max-w-md">
            <Label>Select Class</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an academic class..." />
              </SelectTrigger>
              <SelectContent>
                {(classes || []).map((c: AcademicClass) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 max-w-md">
            <Label>Select Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an ID card template..." />
              </SelectTrigger>
              <SelectContent>
                {idCardTemplates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-4">
            <Users className="h-8 w-8 text-primary mt-1" />
            <div>
              <h3 className="font-medium">How it works</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Selecting a class and template then clicking generate will compile student details for every active student in the selected class using your chosen designer template. A new tab will open with a print-ready grid.
              </p>
            </div>
          </div>

          <Button 
            className="w-full sm:w-auto"
            onClick={() => generateMutation.mutate()}
            disabled={!selectedClassId || !selectedTemplateId || generateMutation.isPending}
          >
            {generateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
            Generate Bulk ID Cards
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
