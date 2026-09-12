"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Brain, Plus, Search, Route } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

const SOURCE_LABELS: Record<string, { label: string; chip: string }> = {
  ai: { label: "AI", chip: "accent" },
  rule_based_fallback: { label: "Rule-based fallback", chip: "warning" },
  manual: { label: "Manual", chip: "" },
};

export default function LearningPathsPage() {
  return <PluginGate slug="ai_suite"><LearningPathsContent /></PluginGate>;
}

function Header() {
  return (
    <AOSPageHeader
      icon={<Route className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
      title="Learning Paths"
      subtitle="AI-personalized learning paths per student"
    />
  );
}

function LearningPathsContent() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", class_name: "", difficulty: "medium", description: "" });
  const [genForm, setGenForm] = useState({ student_id: "", subject: "", difficulty: "adaptive" });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["learning-paths", search],
    queryFn: async () => { const r = await api.get("/lms/learning-paths", { params: { search: search || undefined } }); return r.data?.data ?? r.data; },
  });

  // Students for the AI-generation picker (backend generates per student).
  const { data: studentsData } = useQuery<any>({
    queryKey: ["students-for-paths"],
    queryFn: async () => { const r = await api.get("/students", { params: { per_page: 100 } }); return r.data?.data ?? r.data; },
  });
  const students: any[] = Array.isArray(studentsData) ? studentsData : studentsData?.items ?? [];

  const paths: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/lms/learning-paths", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["learning-paths"] }); setShowDialog(false); toast.success("Learning path created"); setForm({ title: "", subject: "", class_name: "", difficulty: "medium", description: "" }); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to create path"),
  });

  const generate = useMutation({
    mutationFn: async () => (await api.post("/lms/learning-paths/generate-ai", {
      student_id: genForm.student_id,
      subject: genForm.subject || undefined,
      difficulty: genForm.difficulty === "adaptive" ? undefined : genForm.difficulty,
    })).data,
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ["learning-paths"] });
      setShowGenerate(false);
      setGenForm({ student_id: "", subject: "", difficulty: "adaptive" });
      if (resp?.data?.source === "ai") {
        toast.success("AI learning path generated");
      } else {
        toast.warning("Generated rule-based path — no AI provider configured");
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "AI generation failed"),
  });

  if (isError) {
    return (
      <AOSPage>
        <Header />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load learning paths. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <Header
      />
      <AOSPageBody>
        <FilterCommandBar>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--w11-text-secondary)]" />
            <Input className="pl-9" placeholder="Search learning paths..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => setShowGenerate(true)}><Brain className="h-4 w-4 mr-2" />Generate with AI</Button>
          <Button variant="outline" onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />Create Path</Button>
        </FilterCommandBar>

        <DataPanel bodyClassName="p-0 pt-0">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Student</TableHead><TableHead>Subject</TableHead><TableHead>Class</TableHead><TableHead>Difficulty</TableHead><TableHead>Steps</TableHead><TableHead>Completion</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><PageLoader /></TableCell></TableRow>
              ) : paths.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-[color:var(--w11-text-secondary)]">No learning paths. Generate with AI or create manually.</TableCell></TableRow>
              ) : paths.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>{p.student_name ?? "Whole class"}</TableCell>
                  <TableCell>{p.subject ?? "—"}</TableCell>
                  <TableCell>{p.class_name ?? "—"}</TableCell>
                  <TableCell><span className="win11-chip">{p.difficulty ?? "adaptive"}</span></TableCell>
                  <TableCell>{p.steps?.length ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full overflow-hidden" style={{ background: "var(--w11-control-hover)" }}><div className="h-full rounded-full" style={{ width: `${p.completion_rate ?? 0}%`, background: "var(--w11-accent)" }} /></div>
                      <span className="text-sm">{p.completion_rate ?? 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell title={p.source_note ?? undefined}>
                    <span className={`win11-chip ${SOURCE_LABELS[p.source]?.chip ?? ""}`}>
                      {SOURCE_LABELS[p.source]?.label ?? p.source}
                    </span>
                  </TableCell>
                  <TableCell><StatusChip status={p.is_active ? "active" : "pending"} label={p.is_active ? "Active" : "Draft"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>

        <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate Learning Path with AI</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Student *</Label>
                <Select value={genForm.student_id} onValueChange={(v) => setGenForm({ ...genForm, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a student" /></SelectTrigger>
                  <SelectContent>
                    {students.length === 0 && <div className="px-3 py-2 text-sm text-[color:var(--w11-text-secondary)]">No students found</div>}
                    {students.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.class_name ? ` — ${s.class_name}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Subject (optional)</Label><Input value={genForm.subject} onChange={(e) => setGenForm({ ...genForm, subject: e.target.value })} placeholder="e.g. Mathematics" /></div>
              <div className="space-y-2"><Label>Difficulty</Label>
                <AdvancedSelect
          value={genForm.difficulty}
          onChange={(v) => setGenForm({ ...genForm, difficulty: v })}
          options={[{ value: 'adaptive', label: 'Adaptive (AI decides)' }, { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]}
        />
              </div>
              <p className="text-xs text-[color:var(--w11-text-secondary)]">The path is built from the student&apos;s real assessment data. If no AI provider is configured, a deterministic rule-based path is generated instead (labeled in the table).</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button onClick={() => generate.mutate()} disabled={generate.isPending || !genForm.student_id}>{generate.isPending ? <Spinner /> : <><Brain className="h-4 w-4 mr-2" />Generate</>}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Learning Path</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Fractions Mastery Path" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                <div className="space-y-2"><Label>Class</Label><Input value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} placeholder="e.g. Class 5" /></div>
              </div>
              <div className="space-y-2"><Label>Difficulty</Label>
                <AdvancedSelect
          value={form.difficulty}
          onChange={(v) => setForm({ ...form, difficulty: v })}
          options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }, { value: 'adaptive', label: 'Adaptive' }]}
        />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !form.title}>{create.isPending ? <Spinner /> : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
