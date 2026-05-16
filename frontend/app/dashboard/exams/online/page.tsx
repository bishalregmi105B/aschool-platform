"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Monitor, Plus, Play, Clock, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";

interface OnlineExam {
  id: string;
  title: string;
  class_id: string | null;
  subject_id: string | null;
  subject_name: string | null;
  duration_minutes: number;
  total_questions: number;
  total_marks: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  instructions: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  draft: "bg-yellow-100 text-yellow-800",
};

const EMPTY_FORM = {
  title: "", class_id: "", subject_id: "",
  duration_minutes: "30", total_marks: "100",
  start_at: "", end_at: "", instructions: "",
};

export default function OnlineExamPage() {
  return (
    <PluginGate slug="exams">
      <OnlineExamContent />
    </PluginGate>
  );
}

function OnlineExamContent() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: exams = [], isLoading } = useQuery<OnlineExam[]>({
    queryKey: ["online-exams"],
    queryFn: () => api.get("/exams/online").then(r => r.data?.data ?? r.data ?? []),
  });

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then(r => r.data?.data ?? []),
    enabled: createOpen,
  });

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ["subjects-for-online", form.class_id],
    queryFn: () => api.get(`/academics/subjects?class_id=${form.class_id}`).then(r => r.data?.data ?? []),
    enabled: !!form.class_id && createOpen,
  });

  const createMut = useMutation({
    mutationFn: (payload: any) => api.post("/exams/online", payload),
    onSuccess: () => {
      toast.success("Online exam created");
      qc.invalidateQueries({ queryKey: ["online-exams"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error("Failed to create exam"),
  });

  const upcoming = exams.filter(e => e.status === "upcoming").length;
  const active = exams.filter(e => e.status === "active").length;
  const completed = exams.filter(e => e.status === "completed").length;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      title: form.title,
      class_id: form.class_id || undefined,
      subject_id: form.subject_id || undefined,
      duration_minutes: parseInt(form.duration_minutes) || 30,
      total_marks: parseInt(form.total_marks) || 100,
      start_at: form.start_at || undefined,
      end_at: form.end_at || undefined,
      instructions: form.instructions || undefined,
      status: "upcoming",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6" /> Online Exams
          </h1>
          <p className="text-muted-foreground">Create and manage online examinations with auto-grading</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/exams/online/questions">
              <Sparkles className="h-4 w-4 mr-2 text-purple-600" /> AI Question Generator
            </Link>
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Create Online Exam</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Online Exam</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    required
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Chapter 3 Quiz"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Class</Label>
                    <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v, subject_id: "" }))}>
                      <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Duration (mins)</Label>
                    <Input type="number" min="5" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Total Marks</Label>
                    <Input type="number" min="1" value={form.total_marks} onChange={e => setForm(f => ({ ...f, total_marks: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Date/Time</Label>
                    <Input type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} />
                  </div>
                  <div>
                    <Label>End Date/Time</Label>
                    <Input type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Instructions</Label>
                  <Textarea
                    value={form.instructions}
                    onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                    placeholder="Shown to students before they start..."
                    rows={2}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending ? <Spinner /> : "Create Exam"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            {isLoading ? <div className="h-8 bg-muted rounded animate-pulse mx-auto w-12 mb-1" /> : <p className="text-2xl font-bold">{upcoming}</p>}
            <p className="text-sm text-muted-foreground">Upcoming</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Play className="h-6 w-6 text-green-600" />
            </div>
            {isLoading ? <div className="h-8 bg-muted rounded animate-pulse mx-auto w-12 mb-1" /> : <p className="text-2xl font-bold">{active}</p>}
            <p className="text-sm text-muted-foreground">Active Now</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6 text-purple-600" />
            </div>
            {isLoading ? <div className="h-8 bg-muted rounded animate-pulse mx-auto w-12 mb-1" /> : <p className="text-2xl font-bold">{completed}</p>}
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Online Exams</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : exams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No online exams yet</p>
              <p className="text-sm mt-1">Create your first online exam to get started with auto-grading</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map(exam => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell>{exam.subject_name ?? "—"}</TableCell>
                    <TableCell>{exam.duration_minutes} min</TableCell>
                    <TableCell>{exam.total_marks}</TableCell>
                    <TableCell>{exam.total_questions ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {exam.start_date ? new Date(exam.start_date).toLocaleString() : "—"}
                      {exam.end_date ? ` → ${new Date(exam.end_date).toLocaleString()}` : ""}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[exam.status] ?? "bg-gray-100 text-gray-800"}`}>
                        {exam.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
