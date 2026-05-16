"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Brain, Plus, Search, TrendingUp } from "lucide-react";

export default function LearningPathsPage() {
  return <PluginGate slug="ai_adaptive_learning"><LearningPathsContent /></PluginGate>;
}

function LearningPathsContent() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", class_name: "", difficulty: "medium", description: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["learning-paths", search],
    queryFn: async () => { const r = await api.get("/lms/learning-paths", { params: { search: search || undefined } }); return r.data?.data ?? r.data; },
  });

  const paths: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/lms/learning-paths", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["learning-paths"] }); setShowDialog(false); toast.success("Learning path created"); setForm({ title: "", subject: "", class_name: "", difficulty: "medium", description: "" }); },
    onError: () => toast.error("Failed to create path"),
  });

  const generate = useMutation({
    mutationFn: async () => (await api.post("/lms/learning-paths/generate-ai")).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["learning-paths"] }); toast.success("AI generated learning paths"); },
    onError: () => toast.error("AI generation failed"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Brain className="h-6 w-6 text-violet-600" /><div><h1 className="text-2xl font-bold">Learning Paths</h1><p className="text-muted-foreground">AI-personalized learning paths per student</p></div></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>{generate.isPending ? <Spinner /> : <><Brain className="h-4 w-4 mr-2" />Generate with AI</>}</Button>
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />Create Path</Button>
        </div>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search learning paths..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Subject</TableHead><TableHead>Class</TableHead><TableHead>Difficulty</TableHead><TableHead>Students</TableHead><TableHead>Completion</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {paths.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No learning paths. Generate with AI or create manually.</TableCell></TableRow>
            ) : paths.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell>{p.subject ?? "—"}</TableCell>
                <TableCell>{p.class_name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{p.difficulty ?? "medium"}</Badge></TableCell>
                <TableCell>{p.enrolled_count ?? 0}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 bg-muted rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${p.completion_rate ?? 0}%` }} /></div>
                    <span className="text-sm">{p.completion_rate ?? 0}%</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Draft"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

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
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="adaptive">Adaptive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.title}>{create.isPending ? <Spinner /> : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
