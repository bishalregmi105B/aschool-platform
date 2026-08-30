"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Sparkles, Copy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface RemarkRow {
  student_name: string;
  remark: string | null;
}

export default function ReportRemarksPage() {
  return (
    <PluginGate slug="ai_tools"><RemarksContent /></PluginGate>
  );
}

function RemarksContent() {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [tone, setTone] = useState("encouraging");
  const [remarks, setRemarks] = useState<RemarkRow[]>([]);
  const [generating, setGenerating] = useState(false);

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => { const r = await api.get("/exams"); return r.data?.data || []; },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => { const r = await api.get("/academics/classes"); return r.data?.data || []; },
  });

  // The remarks endpoint generates one remark per call (per-student contract:
  // {student_name, marks, total, percentage} → {remark}), so this pulls the
  // exam results for the class and generates a remark for each student from
  // their real marks. Failures (quota/provider) leave that remark empty —
  // never a fabricated comment.
  const gen = async () => {
    setGenerating(true);
    try {
      const res = await api.get(`/exams/${examId}/results?class_id=${classId}`);
      const results = Array.isArray(res.data?.data) ? res.data.data : [];
      if (results.length === 0) {
        toast.error("No results found for this exam and class — enter marks first");
        return;
      }
      const rows: RemarkRow[] = [];
      for (const r of results) {
        let remark: string | null = null;
        try {
          const ms = await api.get(`/exams/${examId}/marksheet/${r.student_id}`);
          const subjects = ms.data?.data?.subjects || [];
          const marks: Record<string, { obtained: number; full: number }> = {};
          for (const s of subjects) {
            marks[s.subject_name] = { obtained: s.obtained_marks, full: s.full_marks };
          }
          const resp = await api.post("/ai-tools/remarks", {
            student_name: r.student_name,
            marks,
            total: r.total_obtained,
            percentage: r.percentage,
            tone,
          });
          remark = resp.data?.data?.remark || null;
        } catch {
          remark = null;
        }
        rows.push({ student_name: r.student_name, remark });
      }
      setRemarks(rows);
      const ok = rows.filter((x) => x.remark).length;
      if (ok === rows.length) toast.success(`Remarks generated for ${ok} students!`);
      else if (ok > 0) toast.warning(`${ok}/${rows.length} remarks generated — the rest failed (quota or AI provider)`);
      else toast.error("No remarks generated — AI quota or provider unavailable");
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copyAll = () => {
    const text = remarks
      .filter((r) => r.remark)
      .map((r) => `${r.student_name}: ${r.remark}`)
      .join("\n\n");
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
                {(classes || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.section && ` - ${c.section}`}</option>)}
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
            <Button onClick={gen} disabled={!examId || !classId || generating}>
              <Sparkles className="h-4 w-4 mr-2" /> {generating ? "Generating..." : "Generate Remarks"}
            </Button>
            {remarks.some((r) => r.remark) && <Button variant="outline" onClick={copyAll}><Copy className="h-4 w-4 mr-2" /> Copy All</Button>}
          </div>
        </CardContent>
      </Card>

      {remarks.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Generated Remarks ({remarks.filter((r) => r.remark).length}/{remarks.length} students)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Remark</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
              <TableBody>
                {remarks.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium whitespace-nowrap">{r.student_name}</TableCell>
                    <TableCell className="text-sm">{r.remark || <span className="text-muted-foreground">— not generated (quota or AI provider unavailable)</span>}</TableCell>
                    <TableCell>
                      {r.remark && (
                        <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(r.remark || ""); toast.success("Copied!"); }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : !generating && (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Select exam and class to generate personalized remarks</p></CardContent></Card>
      )}
    </div>
  );
}
