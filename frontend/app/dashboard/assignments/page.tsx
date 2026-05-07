"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, FileText, Brain } from "lucide-react";

interface Assignment {
  id: string;
  title: string;
  description: string;
  class_id: string;
  subject_id: string;
  due_date: string;
  due_date_bs?: string;
  total_marks: number;
  status: string;
}

function displayDueDate(bsDate?: string, adDate?: string) {
  return bsDate || adDate || "—";
}

export default function AssignmentsPage() {
  return (
    <PluginGate slug="assignments">
      <AssignmentsContent />
    </PluginGate>
  );
}

function AssignmentsContent() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/assignments");
      return (res.data.data as Assignment[]) || [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (data: Partial<Assignment>) => {
      const res = await api.post<ApiResponse>("/assignments", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setShowCreate(false);
      toast.success("Assignment created");
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-muted-foreground">Create, distribute, and grade assignments</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="h-4 w-4 mr-2" /> New Assignment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Assignment</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createMut.mutate({
                title: fd.get("title") as string,
                description: fd.get("description") as string,
                total_marks: parseInt(fd.get("total_marks") as string) || 10,
                due_date: fd.get("due_date") as string,
              });
            }} className="space-y-4">
              <Input name="title" placeholder="Assignment title" required />
              <Textarea name="description" placeholder="Description / Instructions" rows={4} />
              <div className="grid grid-cols-2 gap-4">
                <Input name="total_marks" placeholder="Total Marks" type="number" defaultValue={10} />
                <Input name="due_date" type="date" required />
              </div>
              <Button type="submit" disabled={createMut.isPending} className="w-full">
                {createMut.isPending ? "Creating..." : "Create Assignment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{assignments?.length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{assignments?.filter(a => a.status === "active").length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Closed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{assignments?.filter(a => a.status === "closed").length || 0}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{displayDueDate(a.due_date_bs, a.due_date)}</TableCell>
                  <TableCell>{a.total_marks}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost"><FileText className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost"><Brain className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
