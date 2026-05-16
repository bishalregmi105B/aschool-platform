"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { TrendingUp, Brain, Search } from "lucide-react";

export default function StudentProgressPage() {
  return <PluginGate slug="ai_adaptive_learning"><ProgressContent /></PluginGate>;
}

function ProgressContent() {
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["adaptive-progress", classFilter, search],
    queryFn: async () => { const r = await api.get("/lms/adaptive-progress", { params: { class_name: classFilter || undefined, search: search || undefined } }); return r.data?.data ?? r.data; },
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => { const r = await api.get("/academics/classes"); return r.data?.data ?? r.data; },
  });

  const students: any[] = Array.isArray(data) ? data : data?.students ?? [];
  const classes: any[] = Array.isArray(classesData) ? classesData : classesData?.items ?? [];

  if (isLoading) return <PageLoader />;

  const levelColor = (level: string) =>
    level === "advanced" ? "default" : level === "on_track" ? "secondary" : "destructive";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-violet-600" />
        <div><h1 className="text-2xl font-bold">Student Progress</h1><p className="text-muted-foreground">AI-tracked adaptive learning progress per student</p></div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Classes</SelectItem>
            {classes.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Learning Level</TableHead><TableHead>Paths Assigned</TableHead><TableHead>Paths Completed</TableHead><TableHead>Avg Score</TableHead><TableHead>AI Recommendation</TableHead></TableRow></TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No student progress data available</TableCell></TableRow>
            ) : students.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.student_name ?? s.name}</TableCell>
                <TableCell>{s.class_name ?? "—"}</TableCell>
                <TableCell><Badge variant={levelColor(s.level ?? "on_track")}>{s.level?.replace("_", " ") ?? "on track"}</Badge></TableCell>
                <TableCell>{s.paths_assigned ?? 0}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {s.paths_assigned > 0 && <div className="h-2 w-12 bg-muted rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round(((s.paths_completed ?? 0) / s.paths_assigned) * 100)}%` }} /></div>}
                    {s.paths_completed ?? 0}
                  </div>
                </TableCell>
                <TableCell>{s.avg_score != null ? `${s.avg_score}%` : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  <span className="flex items-center gap-1"><Brain className="h-3 w-3 text-violet-500" />{s.ai_recommendation ?? "No recommendation yet"}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
