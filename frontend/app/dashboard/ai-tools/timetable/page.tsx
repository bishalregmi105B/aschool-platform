"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface SolverSlot {
  day: string;
  period: number;
  subject_name: string;
  teacher_name: string | null;
}

interface SolverClass {
  class_id: string;
  class_name: string;
  section_id: string | null;
  section_name: string | null;
  slots: SolverSlot[];
}

interface SolverResult {
  classes: SolverClass[];
  conflicts: string[];
  periods_per_day: number;
  days: string[];
}

export default function TimetablePage() {
  return (
    <PluginGate slug="ai_tools"><TimetableContent /></PluginGate>
  );
}

function TimetableContent() {
  const [academicYearId, setAcademicYearId] = useState("");
  const [periodsPerDay, setPeriodsPerDay] = useState("8");
  const [result, setResult] = useState<SolverResult | null>(null);

  const { data: years } = useQuery({
    queryKey: ["academic-years-timetable"],
    queryFn: async () => {
      const r = await api.get("/academics/years?per_page=200");
      return Array.isArray(r.data?.data) ? r.data.data : [];
    },
  });

  const gen = useMutation({
    mutationFn: async () => {
      const res = await api.post("/ai-tools/timetable", {
        academic_year_id: academicYearId,
        periods_per_day: parseInt(periodsPerDay) || 8,
      });
      return res.data;
    },
    onSuccess: (d) => { setResult(d?.data); toast.success("Timetable generated!"); },
    onError: () => toast.error("Generation failed"),
  });

  const days: string[] = result?.days || ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const periods = Array.from({ length: result?.periods_per_day || parseInt(periodsPerDay) || 8 }, (_, i) => i + 1);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Academic Session</Label>
              <Select value={academicYearId} onValueChange={setAcademicYearId}>
                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>
                  {(years || []).map((y: { id: string; name: string; is_current?: boolean }) => (
                    <SelectItem key={y.id} value={y.id}>{y.name}{y.is_current ? " (Current)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Periods Per Day</Label>
              <Select value={periodsPerDay} onValueChange={setPeriodsPerDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} periods</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={() => gen.mutate()} disabled={gen.isPending || !academicYearId}>
              <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Generating..." : "Generate Timetable"}
            </Button>
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

      {result && (result.classes || []).length > 0 ? (
        result.classes.map((cls) => {
          // day × period lookup for this class section
          const grid: Record<string, Record<number, SolverSlot>> = {};
          for (const slot of cls.slots || []) {
            grid[slot.day] = grid[slot.day] || {};
            grid[slot.day][slot.period] = slot;
          }
          return (
            <Card key={`${cls.class_id}-${cls.section_id ?? ""}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {cls.class_name}
                  {cls.section_name && <Badge variant="outline">{cls.section_name}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="border-b"><th className="text-left p-2 font-medium">Day</th>{periods.map((p) => <th key={p} className="text-center p-2 font-medium">P{p}</th>)}</tr></thead>
                    <tbody>
                      {days.map((day) => (
                        <tr key={day} className="border-b">
                          <td className="p-2 font-medium">{day}</td>
                          {periods.map((p) => {
                            const slot = grid[day]?.[p];
                            return (
                              <td key={p} className="text-center p-2">
                                {slot ? (
                                  <div className="text-xs"><div className="font-medium">{slot.subject_name}</div>{slot.teacher_name && <div className="text-muted-foreground">{slot.teacher_name}</div>}</div>
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
          );
        })
      ) : !gen.isPending && (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Select a session and generate a clash-free timetable</p></CardContent></Card>
      )}
    </div>
  );
}
