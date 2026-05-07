"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Sparkles, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function TimetablePage() {
  return (
    <PluginGate slug="ai_tools"><TimetableContent /></PluginGate>
  );
}

function TimetableContent() {
  const [form, setForm] = useState({ academic_year: new Date().getFullYear().toString(), max_periods_per_day: "8", break_after_period: "4" });
  const [result, setResult] = useState<any>(null);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => { const r = await api.get("/academics/classes"); return r.data?.data || []; },
  });

  const gen = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai-tools/timetable", { ...form, max_periods_per_day: parseInt(form.max_periods_per_day), break_after_period: parseInt(form.break_after_period) });
      return res.data;
    },
    onSuccess: (d) => { setResult(d?.data); toast.success("Timetable generated!"); },
    onError: () => toast.error("Generation failed"),
  });

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const periods = Array.from({ length: parseInt(form.max_periods_per_day) || 8 }, (_, i) => i + 1);
  const timetable = result?.timetable || result?.schedule || {};
  const conflicts = result?.conflicts || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai-tools"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">AI Timetable Generator</h1><p className="text-muted-foreground">Generate clash-free timetables automatically</p></div>
      </div>

      <Card>
        <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Academic Year</Label><Input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} /></div>
            <div className="space-y-2"><Label>Max Periods Per Day</Label><Input type="number" value={form.max_periods_per_day} onChange={(e) => setForm({ ...form, max_periods_per_day: e.target.value })} /></div>
            <div className="space-y-2"><Label>Break After Period</Label><Input type="number" value={form.break_after_period} onChange={(e) => setForm({ ...form, break_after_period: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => gen.mutate()} disabled={gen.isPending}><Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Generating..." : "Generate Timetable"}</Button>
            {result && <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Export PDF</Button>}
          </div>
        </CardContent>
      </Card>

      {conflicts.length > 0 && (
        <Card className="border-yellow-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-600 mb-2"><AlertTriangle className="h-5 w-5" /><span className="font-semibold">Conflicts Detected</span></div>
            <ul className="list-disc list-inside text-sm space-y-1">{conflicts.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      {result && Object.keys(timetable).length > 0 ? (
        Object.entries(timetable).map(([className, schedule]: [string, any]) => (
          <Card key={className}>
            <CardHeader><CardTitle>{className}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="border-b"><th className="text-left p-2 font-medium">Day</th>{periods.map(p => <th key={p} className="text-center p-2 font-medium">P{p}</th>)}</tr></thead>
                  <tbody>
                    {days.map(day => (
                      <tr key={day} className="border-b">
                        <td className="p-2 font-medium">{day}</td>
                        {periods.map(p => {
                          const slot = schedule?.[day]?.[p] || schedule?.[day]?.[`period_${p}`];
                          return (
                            <td key={p} className="text-center p-2">
                              {p === parseInt(form.break_after_period) + 1 ? (
                                <Badge variant="secondary">Break</Badge>
                              ) : slot ? (
                                <div className="text-xs"><div className="font-medium">{slot.subject || slot}</div>{slot.teacher && <div className="text-muted-foreground">{slot.teacher}</div>}</div>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      ) : !gen.isPending && (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Configure settings and generate a clash-free timetable</p></CardContent></Card>
      )}
    </div>
  );
}
