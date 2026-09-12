"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { TrendingUp, Brain, Search } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

export default function StudentProgressPage() {
  return <PluginGate slug="ai_suite"><ProgressContent /></PluginGate>;
}

function ProgressContent() {
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["adaptive-progress", classFilter, search],
    queryFn: async () => { const r = await api.get("/lms/adaptive-progress", { params: { class_name: classFilter || undefined, search: search || undefined } }); return r.data?.data ?? r.data; },
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => { const r = await api.get("/academics/classes"); return r.data?.data ?? r.data; },
  });

  const students: any[] = Array.isArray(data) ? data : data?.students ?? [];
  const classes: any[] = Array.isArray(classesData) ? classesData : classesData?.items ?? [];

  if (isError) {
    return (
      <AOSPage>
        <Header />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load student progress. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const levelTone = (level: string | null) =>
    level === "advanced" ? "success" : level === "intermediate" ? "subtle" : level === "beginner" ? "warning" : "subtle";

  return (
    <AOSPage>
      <Header />
      <AOSPageBody>
        <FilterCommandBar>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--w11-text-secondary)]" />
            <Input className="pl-9" placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={classFilter || "all"} onValueChange={(v) => setClassFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterCommandBar>

        <DataPanel bodyClassName="p-0 pt-0">
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Mastery Level</TableHead><TableHead>Paths Assigned</TableHead><TableHead>Paths Completed</TableHead><TableHead>Avg Score</TableHead><TableHead>AI Recommendation</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><PageLoader /></TableCell></TableRow>
              ) : students.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-[color:var(--w11-text-secondary)]">No student progress data available</TableCell></TableRow>
              ) : students.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.student_name ?? s.name}</TableCell>
                  <TableCell>{s.class_name ?? "—"}</TableCell>
                  <TableCell><StatusChip status={levelTone(s.level) === "subtle" ? "pending" : (s.level || "pending")} label={s.level ? s.level.replace("_", " ") : "no data"} /></TableCell>
                  <TableCell>{s.paths_assigned ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {s.paths_assigned > 0 && <div className="h-2 w-12 rounded-full overflow-hidden" style={{ background: "var(--w11-control-hover)" }}><div className="h-full rounded-full" style={{ width: `${Math.round(((s.paths_completed ?? 0) / s.paths_assigned) * 100)}%`, background: "var(--w11-accent)" }} /></div>}
                      {s.paths_completed ?? 0}
                    </div>
                  </TableCell>
                  <TableCell>{s.avg_score != null ? `${s.avg_score}%` : "—"}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate text-[color:var(--w11-text-secondary)]">
                    <span className="flex items-center gap-1"><Brain className="h-3 w-3" style={{ color: "var(--w11-accent)" }} />{s.ai_recommendation ?? "No recommendation yet"}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}

function Header() {
  return (
    <AOSPageHeader
      icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
      title="Student Progress"
      subtitle="AI-tracked adaptive learning progress per student"
    />
  );
}
