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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { ArrowLeft, Star, Plus } from "lucide-react";
import Link from "next/link";

export default function AppraisalPage() {
  return <PluginGate slug="hr"><AppraisalContent /></PluginGate>;
}

function AppraisalContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ staff_id: "", period: new Date().getFullYear().toString(), teaching_score: "5", attendance_score: "5", teamwork_score: "5", comments: "" });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["appraisals"],
    queryFn: async () => { const r = await api.get("/hr/appraisals"); return r.data; },
  });

  const { data: staffData } = useQuery<any>({
    queryKey: ["staff-options"],
    queryFn: async () => {
      const r = await api.get("/staff");
      return r.data?.data || [];
    },
  });

  const appraisals = data?.data || [];
  const staffOptions = staffData || [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/hr/appraisals", {
      ...form,
      staff_id: form.staff_id,
      teaching_score: Number(form.teaching_score),
      attendance_score: Number(form.attendance_score),
      teamwork_score: Number(form.teamwork_score),
    })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["appraisals"] }); setShowDialog(false); toast.success("Appraisal saved!"); },
    onError: () => toast.error("Failed to save"),
  });

  if (isLoading) return <PageLoader />;

  const renderStars = (score: number) => (
    <div className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-4 w-4 ${i < score ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />)}</div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hr"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1"><h1 className="text-2xl font-bold">Staff Appraisal</h1><p className="text-muted-foreground">Performance evaluation and reviews</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> New Appraisal</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Period</TableHead><TableHead>Teaching</TableHead><TableHead>Attendance</TableHead><TableHead>Teamwork</TableHead><TableHead>Overall</TableHead><TableHead>Comments</TableHead></TableRow></TableHeader>
            <TableBody>
              {appraisals.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No appraisals found</TableCell></TableRow>
              ) : appraisals.map((a: any) => {
                const avg = ((a.teaching_score || 0) + (a.attendance_score || 0) + (a.teamwork_score || 0)) / 3;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.staff_name}</TableCell>
                    <TableCell>{a.period}</TableCell>
                    <TableCell>{renderStars(a.teaching_score || 0)}</TableCell>
                    <TableCell>{renderStars(a.attendance_score || 0)}</TableCell>
                    <TableCell>{renderStars(a.teamwork_score || 0)}</TableCell>
                    <TableCell><Badge variant={avg >= 4 ? "default" : avg >= 3 ? "secondary" : "destructive"}>{avg.toFixed(1)}/5</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate">{a.comments || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Appraisal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Staff Member</Label>
                <select className="w-full border rounded-md p-2" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
                  <option value="">Select staff</option>
                  {staffOptions.map((staff: any) => (
                    <option key={staff.id} value={staff.id}>{staff.full_name} ({staff.role})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2"><Label>Period</Label><Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="e.g. 2024" /></div>
            </div>
            {[
              { key: "teaching_score", label: "Teaching Quality (1-5)" },
              { key: "attendance_score", label: "Attendance & Punctuality (1-5)" },
              { key: "teamwork_score", label: "Teamwork & Communication (1-5)" },
            ].map((s: any) => (
              <div key={s.key} className="space-y-2">
                <Label>{s.label}</Label>
                <Input type="number" min="1" max="5" value={(form as any)[s.key]} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} />
              </div>
            ))}
            <div className="space-y-2"><Label>Comments</Label><Textarea value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.staff_id || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Save Appraisal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
