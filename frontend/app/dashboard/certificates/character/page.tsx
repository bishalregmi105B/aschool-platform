"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { GraduationCap, Search, Printer, FileText } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

interface TemplateItem {
  id: string;
  name: string;
  category: string;
}

export default function CharacterCertificatePage() {
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const { data: students, isLoading, isError: studentsError, refetch: refetchStudents } = useQuery({
    queryKey: ["design-studio-students", search],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>(`/design-studio/data-sources/student/records?q=${search}&limit=50`);
      return res.data.data;
    },
    retry: 1,
  });

  const { data: certificateTemplates = [] } = useQuery({
    queryKey: ["design-templates", "certificates"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TemplateItem[]>>("/design-studio/templates?category=certificates");
      return res.data.data || [];
    },
  });

  useEffect(() => {
    if (selectedTemplateId || !certificateTemplates.length) return;
    const preferred = certificateTemplates.find((t) => t.id === "character_certificate")?.id
      || certificateTemplates[0].id;
    setSelectedTemplateId(preferred);
  }, [certificateTemplates, selectedTemplateId]);

  const renderMutation = useMutation({
    mutationFn: async (studentData: any) => {
      const res = await api.post("/design-studio/render", {
        template_id: selectedTemplateId,
        data: {
          ...studentData.fields,
          date: new Date().toISOString().slice(0, 10),
        },
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      toast.success("Certificate generated successfully");

      // Open in new tab for printing
      const newWin = window.open("", "_blank");
      if (newWin) {
        newWin.document.write(`
          <html>
            <head>
              <title>Character Certificate</title>
              <style>
                body { font-family: system-ui, sans-serif; margin: 0; padding: 40px; }
                .cert-container { border: 10px double #1e40af; padding: 40px; max-width: 800px; margin: 0 auto; text-align: center; }
                @media print { .no-print { display: none; } }
              </style>
            </head>
            <body>
              <div class="no-print" style="margin-bottom: 20px; text-align: right;">
                <button id="print-btn" style="padding: 10px 20px; cursor: pointer;">Print Document</button>
              </div>
              ${data.data?.html || data.html || "<div class='cert-container'><h1>Character Certificate</h1><p>Template rendering fallback.</p></div>"}
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
      toast.error("Failed to render certificate. Ensure template exists.");
    }
  });

  const handleGenerate = (student: any) => {
    if (!selectedTemplateId) {
      toast.error("Please select a template");
      return;
    }
    renderMutation.mutate(student);
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Character Certificates"
        subtitle="Generate official character certificates for students"
      />
      <AOSPageBody>
        <div className="grid md:grid-cols-3 gap-4">
        <DataPanel className="md:col-span-1 h-fit" title="Search Student">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>Find a student to generate their certificate</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--w11-text-tertiary)" }} />
              <Input
                placeholder="Search by name or ID..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            {studentsError ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>Failed to load students. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetchStudents()}>Retry</Button>
              </div>
            ) : (
            <div className="space-y-2 pt-4 max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : (
                (students || []).map((student) => (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className="p-3 border rounded-lg cursor-pointer transition-colors"
                    style={
                      selectedStudentId === student.id
                        ? { background: "var(--w11-accent-light)", borderColor: "var(--w11-accent)" }
                        : { borderColor: "var(--w11-border-default)" }
                    }
                  >
                    <div className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{student.label}</div>
                    <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{student.subtitle}</div>
                  </div>
                ))
              )}
              {students?.length === 0 && (
                <div className="text-center text-sm py-4" style={{ color: "var(--w11-text-secondary)" }}>No students found</div>
              )}
            </div>
            )}
          </div>
        </DataPanel>

        <DataPanel className="md:col-span-2" title="Certificate Preview Options">
          <div>
            {!selectedStudentId ? (
              <AOSEmptyState
                icon={<FileText className="h-12 w-12" />}
                title="Select a student from the list to preview and generate."
              />
            ) : (
              <div className="space-y-6">
                {(() => {
                  const student = students?.find((s: any) => s.id === selectedStudentId);
                  if (!student) return null;
                  
                  return (
                    <div className="space-y-6">
                      <div
                        className="grid grid-cols-2 gap-4 p-4 rounded-lg border"
                        style={{ background: "var(--w11-control-hover)", borderColor: "var(--w11-border-default)" }}
                      >
                        <div>
                          <Label className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Student Name</Label>
                          <div className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{student.fields.name}</div>
                        </div>
                        <div>
                          <Label className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Admission No.</Label>
                          <div className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{student.fields.admission_number || "—"}</div>
                        </div>
                        <div>
                          <Label className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Date of Birth</Label>
                          <div className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{student.fields.dob || "—"}</div>
                        </div>
                        <div>
                          <Label className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Father&apos;s Name</Label>
                          <div className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{student.fields.father_name || "—"}</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Template</Label>
                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose certificate template" />
                          </SelectTrigger>
                          <SelectContent>
                            {certificateTemplates.map((tpl) => (
                              <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="pt-4 border-t border-[var(--w11-border-subtle)] flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setSelectedStudentId("")}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => handleGenerate(student)}
                          disabled={!selectedTemplateId || renderMutation.isPending}
                        >
                          {renderMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                          Generate & Print
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
