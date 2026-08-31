"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import { FileText, Download, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

interface ReportCard {
  id: string;
  student_name: string;
  student_id: string;
  roll_number: number;
  total_percentage: number;
  overall_grade: string;
  overall_gpa: number;
  rank_in_class: number;
  ai_remarks: string;
  pdf_url: string;
  generated_at: string;
}

export default function ReportCardsPage() {
  return (
    <PluginGate slug="exams">
      <ReportCardsContent />
    </PluginGate>
  );
}

function ReportCardsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "school_admin";
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const res = await api.get("/exams");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const { data: reportCards, isLoading, isError, refetch } = useQuery({
    queryKey: ["report-cards", examId, classId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}/report-cards?class_id=${classId}`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!examId && !!classId,
    retry: 1,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/exams/${examId}/report-cards`, { class_id: classId });
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.data?.download_url) {
        window.open(data.data.download_url, "_blank");
      }
      toast.success("Report cards generated with AI remarks!");
    },
    onError: () => toast.error("Failed to generate report cards"),
  });

  const bulkDownloadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get(`/exams/${examId}/report-cards/bulk-pdf?class_id=${classId}`, {
        responseType: "blob",
      });
      return res.data;
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_cards_${examId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Downloading bulk report cards");
    },
    onError: () => toast.error("Failed to download"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Report Cards</h1>
          <p className="text-muted-foreground">Generate AI-powered report cards with personalized remarks</p>
        </div>
        <Button
          variant="outline"
          onClick={() => bulkDownloadMutation.mutate()}
          disabled={!examId || !classId || bulkDownloadMutation.isPending}
        >
          <Download className="h-4 w-4 mr-2" /> Download All
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label>Select Exam</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger><SelectValue placeholder="Choose exam" /></SelectTrigger>
              <SelectContent>
                {(exams || []).map((e: { id: string; name: string }) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Select Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
              <SelectContent>
                {(classes || []).map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
          {isAdmin ? (
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!examId || !classId || generateMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {generateMutation.isPending ? "Generating..." : "Generate with AI"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Only admins can generate report cards</p>
          )}
          </div>
        </CardContent>
      </Card>

      {examId && classId && (
        <Card>
          <CardContent className="p-0">
            {isError ? (
              <div className="flex flex-col items-center py-12 space-y-3">
                <p className="text-sm text-destructive">Failed to load report cards. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : isLoading ? (
              <PageLoader />
            ) : (reportCards || []).length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No report cards generated yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click &quot;Generate with AI&quot; to create report cards with personalized remarks.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>GPA</TableHead>
                    <TableHead>AI Remarks</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportCards.map((rc: ReportCard) => (
                    <TableRow key={rc.id}>
                      <TableCell>#{rc.rank_in_class}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{rc.student_name}</span>
                          <br />
                          <span className="text-xs text-muted-foreground">Roll: {rc.roll_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>{rc.total_percentage?.toFixed(1)}%</TableCell>
                      <TableCell><Badge variant="outline">{rc.overall_grade}</Badge></TableCell>
                      <TableCell>{rc.overall_gpa?.toFixed(1)}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {rc.ai_remarks || "—"}
                      </TableCell>
                      <TableCell>
                        {rc.pdf_url ? (
                          <Button variant="ghost" size="sm" onClick={() => window.open(rc.pdf_url, "_blank")}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
