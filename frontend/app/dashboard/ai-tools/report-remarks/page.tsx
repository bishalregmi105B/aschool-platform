"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Sparkles, Copy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function ReportRemarksPage() {
  return (
    <PluginGate slug="ai_tools"><RemarksContent /></PluginGate>
  );
}

function RemarksContent() {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [tone, setTone] = useState("encouraging");
  const [remarks, setRemarks] = useState<any[]>([]);

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => { const r = await api.get("/exams"); return r.data?.data || []; },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => { const r = await api.get("/academics/classes"); return r.data?.data || []; },
  });

  const gen = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai-tools/remarks", { exam_id: parseInt(examId), class_id: parseInt(classId), tone });
      return res.data;
    },
    onSuccess: (d) => { setRemarks(d?.data?.remarks || d?.data || []); toast.success("Remarks generated!"); },
    onError: () => toast.error("Generation failed"),
  });

  const copyAll = () => {
    const text = remarks.map((r: any) => `${r.student_name}: ${r.remark}`).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("All remarks copied!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">AI Report Remarks</h1><p className="text-muted-foreground">Generate personalized remarks for each student</p></div>
      </div>

      <Card>
        <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Exam</Label>
              <select className="w-full border rounded-md p-2" value={examId} onChange={(e) => setExamId(e.target.value)}>
                <option value="">Select Exam</option>
                {(exams || []).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <select className="w-full border rounded-md p-2" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select Class</option>
                {(classes || []).map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.section && `- ${c.section}`}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <select className="w-full border rounded-md p-2" value={tone} onChange={(e) => setTone(e.target.value)}>
                <option value="encouraging">Encouraging</option>
                <option value="professional">Professional</option>
                <option value="constructive">Constructive</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => gen.mutate()} disabled={!examId || !classId || gen.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Generating..." : "Generate Remarks"}
            </Button>
            {remarks.length > 0 && <Button variant="outline" onClick={copyAll}><Copy className="h-4 w-4 mr-2" /> Copy All</Button>}
          </div>
        </CardContent>
      </Card>

      {remarks.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Generated Remarks ({remarks.length} students)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Remark</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
              <TableBody>
                {remarks.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium whitespace-nowrap">{r.student_name || r.name}</TableCell>
                    <TableCell className="text-sm">{r.remark || r.comment}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(r.remark || r.comment); toast.success("Copied!"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : !gen.isPending && (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Select exam and class to generate personalized remarks</p></CardContent></Card>
      )}
    </div>
  );
}
