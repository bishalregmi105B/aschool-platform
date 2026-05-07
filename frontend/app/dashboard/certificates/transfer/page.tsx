"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { ArrowRightLeft, Search, Printer, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";

interface TemplateItem {
  id: string;
  name: string;
  category: string;
}

export default function TransferCertificatePage() {
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const { data: students, isLoading } = useQuery({
    queryKey: ["design-studio-students", search],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>(`/design-studio/data-sources/student/records?q=${search}&limit=50`);
      return res.data.data;
    },
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
    const preferred = certificateTemplates.find((t) => t.id === "transfer_certificate")?.id
      || certificateTemplates[0].id;
    setSelectedTemplateId(preferred);
  }, [certificateTemplates, selectedTemplateId]);

  const renderMutation = useMutation({
    mutationFn: async (studentData: any) => {
      const res = await api.post("/design-studio/render", {
        template_id: selectedTemplateId,
        data: studentData.fields,
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      toast.success("Certificate generated successfully");
      
      const newWin = window.open("", "_blank");
      if (newWin) {
        newWin.document.write(`
          <html>
            <head>
              <title>Transfer Certificate</title>
              <style>
                body { font-family: system-ui, sans-serif; margin: 0; padding: 40px; }
                .cert-container { border: 10px solid #double; padding: 40px; max-width: 800px; margin: 0 auto; text-align: center; }
                @media print { .no-print { display: none; } }
              </style>
            </head>
            <body>
              <div class="no-print" style="margin-bottom: 20px; text-align: right;">
                <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer;">Print Document</button>
              </div>
              ${data.data?.html || data.html || "<div class='cert-container'><h1>Transfer Certificate</h1><p>Template rendering fallback.</p></div>"}
            </body>
          </html>
        `);
        newWin.document.close();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6" /> Transfer Certificates
          </h1>
          <p className="text-muted-foreground">Generate official School Leaving / Transfer Certificates</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Search Student</CardTitle>
            <CardDescription>Find a student who is leaving the school</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="space-y-2 pt-4 max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : (
                (students || []).map((student) => (
                  <div 
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedStudentId === student.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium">{student.label}</div>
                    <div className="text-xs text-muted-foreground">{student.subtitle}</div>
                  </div>
                ))
              )}
              {students?.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">No students found</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Certificate Preview Options</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedStudentId ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p>Select a student from the list to preview and generate.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const student = students?.find(s => s.id === selectedStudentId);
                  if (!student) return null;
                  
                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                        <div>
                          <Label className="text-muted-foreground text-xs">Student Name</Label>
                          <div className="font-medium">{student.fields.name}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Admission No.</Label>
                          <div className="font-medium">{student.fields.admission_number || "—"}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Current Class</Label>
                          <div className="font-medium">{student.fields.class || "—"}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Father&apos;s Name</Label>
                          <div className="font-medium">{student.fields.father_name || "—"}</div>
                        </div>
                      </div>
                      
                      <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-medium">Leaving Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2 col-span-2">
                            <Label>Template</Label>
                            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                              <SelectTrigger><SelectValue placeholder="Choose certificate template" /></SelectTrigger>
                              <SelectContent>
                                {certificateTemplates.map((tpl) => (
                                  <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Reason for Leaving</Label>
                            <Select defaultValue="passed">
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="passed">Passed Final Exam</SelectItem>
                                <SelectItem value="transfer">Parent Transfer</SelectItem>
                                <SelectItem value="other">Other / Personal</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Date of Leaving</Label>
                            <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t flex justify-end gap-2">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
