"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner, PageLoader } from "@/components/ui/spinner";
import { CreditCard as IdCard, Printer, Search, Users, CheckSquare, Square } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface StaffRecord {
  id: string;
  label: string;
  subtitle: string;
  fields: Record<string, any>;
}

interface TemplateItem {
  id: string;
  name: string;
  category: string;
}

export default function StaffIdCardsPage() {
  const [search, setSearch] = useState("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const { data: staffList, isLoading: isStaffLoading, isError: isStaffError, refetch: refetchStaff } = useQuery({
    queryKey: ["design-studio-staff", search],
    queryFn: async () => {
      const res = await api.get<ApiResponse<StaffRecord[]>>(`/design-studio/data-sources/teacher/records?q=${search}&limit=100`);
      return res.data.data;
    },
    retry: 1,
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
    const preferred = idCardTemplates.find((t) => t.id === "id_card_staff")?.id
      || idCardTemplates.find((t) => t.id === "id_card_standard")?.id
      || idCardTemplates[0].id;
    setSelectedTemplateId(preferred);
  }, [idCardTemplates, selectedTemplateId]);

  const renderMutation = useMutation({
    mutationFn: async () => {
      const selected = (staffList || []).filter((s: any) => selectedStaffIds.has(s.id));
      if (selected.length === 0) throw new Error("No staff selected");
      if (!selectedTemplateId) throw new Error("No template selected");

      // We'll generate them one by one in parallel using the generic render endpoint
      const promises = selected.map((staff: any) => 
        api.post("/design-studio/render", {
          template_id: selectedTemplateId,
          data: staff.fields,
        }).then(res => {
          const payload = res.data?.data || res.data || {};
          return {
            html: payload.html || "",
            template_width: Number(payload.template_width) || 300,
            template_height: Number(payload.template_height) || 189,
          };
        })
      );

      return Promise.all(promises);
    },
    onSuccess: (cards) => {
      const firstCard = cards?.[0] || { template_width: 300, template_height: 189 };
      toast.success(`Successfully generated ${cards.length} ID Cards`);
      
      const newWin = window.open("", "_blank");
      if (newWin) {
        newWin.document.write(`
          <html>
            <head>
              <title>Staff ID Cards Print Preview</title>
              <style>
                body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; }
                .grid-container { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; align-items: flex-start; }
                .id-card { width: ${firstCard.template_width}px; height: ${firstCard.template_height}px; background: white; border: 1px solid #ccc; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
                .id-card > * { width: ${firstCard.template_width}px !important; height: ${firstCard.template_height}px !important; }
                @media print { 
                  body { background: white; padding: 0; }
                  .no-print { display: none; } 
                }
              </style>
            </head>
            <body>
              <div class="no-print" style="margin-bottom: 20px; text-align: right; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <button id="print-btn" style="padding: 10px 20px; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 4px;">Print ID Cards</button>
              </div>
              <div class="grid-container">
                ${cards.map((card: any) => `<div class="id-card">${card?.html || '<div style="padding:20px;text-align:center;">Template Error</div>'}</div>`).join("")}
              </div>
            </body>
          </html>
        `);
        newWin.document.close();
        newWin.document.getElementById("print-btn")?.addEventListener("click", () => {
          newWin.focus();
          newWin.print();
        });
      }
    },
    onError: () => {
      toast.error("Failed to generate ID cards. Please check selected template.");
    }
  });

  const toggleStaff = (id: string) => {
    setSelectedStaffIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleAll = () => {
    if (!staffList) return;
    if (selectedStaffIds.size === staffList.length) {
      setSelectedStaffIds(new Set());
    } else {
      setSelectedStaffIds(new Set(staffList.map((s: any) => s.id)));
    }
  };

  if (isStaffLoading || isTemplatesLoading) return <PageLoader />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<IdCard className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Staff ID Cards"
        subtitle="Select teachers and staff to generate printable ID cards"
        actions={
          <div className="flex items-end gap-2">
          <div className="space-y-1 min-w-[220px]">
            <Label className="text-xs">Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose template" />
              </SelectTrigger>
              <SelectContent>
                {idCardTemplates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={() => renderMutation.mutate()}
            disabled={selectedStaffIds.size === 0 || !selectedTemplateId || renderMutation.isPending}
          >
            {renderMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
            Generate ({selectedStaffIds.size}) Cards
          </Button>
          </div>
        }
      />
      <AOSPageBody>
        <div className="grid md:grid-cols-3 gap-4">
        <DataPanel
          className="md:col-span-1 h-fit"
          title={
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4" /> Instructions
            </span>
          }
        >
          <div className="text-sm space-y-4" style={{ color: "var(--w11-text-secondary)" }}>
            <p>1. Search for specific staff members or select them from the list.</p>
            <p>2. You can select multiple staff members to batch print their ID cards simultaneously.</p>
            <p>3. Once selected, click the &quot;Generate&quot; button. A new tab will open with a print-ready grid containing the standard vertical ID cards (54x86mm).</p>
          </div>
        </DataPanel>

        <DataPanel
          className="md:col-span-2"
          title="Staff List"
          actions={
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--w11-text-tertiary)" }} />
              <Input
                placeholder="Search staff..."
                className="pl-10 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          }
        >
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[var(--w11-border-subtle)]">
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {staffList && selectedStaffIds.size === staffList.length ? (
                  <><CheckSquare className="h-4 w-4 mr-2 text-primary" /> Deselect All</>
                ) : (
                  <><Square className="h-4 w-4 mr-2" /> Select All</>
                )}
              </Button>
              <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                {selectedStaffIds.size} / {staffList?.length || 0} selected
              </span>
            </div>

            {isStaffError ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>Failed to load staff list. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetchStaff()}>Retry</Button>
              </div>
            ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
              {(staffList || []).map((staff) => {
                const isSelected = selectedStaffIds.has(staff.id);
                return (
                  <div
                    key={staff.id}
                    onClick={() => toggleStaff(staff.id)}
                    className="p-3 border rounded-lg cursor-pointer transition-colors flex items-center gap-3"
                    style={
                      isSelected
                        ? { background: "var(--w11-accent-light)", borderColor: "var(--w11-accent)" }
                        : { borderColor: "var(--w11-border-default)" }
                    }
                  >
                    {isSelected
                      ? <CheckSquare className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />
                      : <Square className="h-5 w-5" style={{ color: "var(--w11-text-tertiary)" }} />}
                    <div>
                      <div className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{staff.label}</div>
                      <div className="text-xs capitalize" style={{ color: "var(--w11-text-secondary)" }}>{staff.subtitle.replace("_", " ")}</div>
                    </div>
                  </div>
                );
              })}
              {staffList?.length === 0 && (
                <div className="col-span-2 text-center text-sm py-8" style={{ color: "var(--w11-text-secondary)" }}>
                  No staff members found matching your search.
                </div>
              )}
            </div>
            </>
            )}
          </div>
        </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
