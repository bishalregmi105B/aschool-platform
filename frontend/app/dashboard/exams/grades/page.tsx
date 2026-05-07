"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Star, Plus } from "lucide-react";

interface Grade {
  id: string;
  name: string;
  min_percentage: number;
  max_percentage: number;
  grade_point: number;
  description?: string;
}

export default function ExamGradesPage() {
  return (
    <PluginGate slug="exams">
      <ExamGradesContent />
    </PluginGate>
  );
}

function ExamGradesContent() {
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["exam-grades"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Grade[]>>("/exams/grade-table");
      return res.data.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post("/exams/grade-table", payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["exam-grades"] }); toast.success("Grade created"); setShowAdd(false); },
    onError: () => toast.error("Failed"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="h-6 w-6" /> Exam Grades</h1>
          <p className="text-muted-foreground">Define grading scale and grade points</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Add Grade</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Grade</TableHead><TableHead>Min %</TableHead><TableHead>Max %</TableHead><TableHead>Grade Point</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data || []).map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-bold text-lg">{g.name}</TableCell>
                  <TableCell>{g.min_percentage}%</TableCell>
                  <TableCell>{g.max_percentage}%</TableCell>
                  <TableCell><Badge>{g.grade_point}</Badge></TableCell>
                  <TableCell>{g.description || "—"}</TableCell>
                </TableRow>
              ))}
              {(!data || data.length === 0) && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No grades defined. Add default Nepal grading (A+, A, B+, B, C+, C, D, E).</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Grade</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createMutation.mutate({ name: fd.get("name"), min_percentage: Number(fd.get("min")), max_percentage: Number(fd.get("max")), grade_point: Number(fd.get("gp")), description: fd.get("desc") }); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Grade Name</Label><Input name="name" required placeholder="A+" /></div>
              <div className="space-y-2"><Label>Grade Point</Label><Input name="gp" type="number" step="0.1" required placeholder="4.0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Min %</Label><Input name="min" type="number" required placeholder="90" /></div>
              <div className="space-y-2"><Label>Max %</Label><Input name="max" type="number" required placeholder="100" /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input name="desc" placeholder="Distinction" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? <Spinner size="sm" /> : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
