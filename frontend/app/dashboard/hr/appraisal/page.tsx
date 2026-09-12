"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Star, Plus } from "lucide-react";

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

  const renderStars = (score: number) => (
    <div className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-4 w-4 ${i < score ? "fill-current" : ""}`} style={{ color: i < score ? "#d83b01" : "var(--w11-text-disabled)" }} />)}</div>
  );

  const APPRAISAL_COLUMNS: Column<any>[] = [
    { key: "staff_name", label: "Staff", sortable: true, value: (a) => a.staff_name ?? "", render: (a) => <span className="font-medium">{a.staff_name}</span> },
    { key: "period", label: "Period", sortable: true, value: (a) => a.period ?? "" },
    { key: "teaching_score", label: "Teaching", align: "center", sortable: true, value: (a) => a.teaching_score ?? 0, render: (a) => renderStars(a.teaching_score || 0) },
    { key: "attendance_score", label: "Attendance", align: "center", sortable: true, value: (a) => a.attendance_score ?? 0, render: (a) => renderStars(a.attendance_score || 0) },
    { key: "teamwork_score", label: "Teamwork", align: "center", sortable: true, value: (a) => a.teamwork_score ?? 0, render: (a) => renderStars(a.teamwork_score || 0) },
    {
      key: "overall",
      label: "Overall",
      align: "right",
      sortable: true,
      value: (a) => ((a.teaching_score || 0) + (a.attendance_score || 0) + (a.teamwork_score || 0)) / 3,
      render: (a) => {
        const avg = ((a.teaching_score || 0) + (a.attendance_score || 0) + (a.teamwork_score || 0)) / 3;
        return <StatusChip status={avg >= 4 ? "pass" : avg >= 3 ? "pending" : "fail"} label={`${avg.toFixed(1)}/5`} />;
      },
    },
    { key: "comments", label: "Comments", value: (a) => a.comments ?? "", render: (a) => <span className="max-w-[200px] truncate block">{a.comments || "—"}</span> },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading appraisals…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Star className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Staff Appraisal"
        subtitle={`${appraisals.length} performance ${appraisals.length === 1 ? "review" : "reviews"}`}
        actions={
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Appraisal
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={APPRAISAL_COLUMNS}
            rows={appraisals}
            rowKey={(a: any) => a.id}
            searchable
            searchPlaceholder="Search appraisals…"
            exportFileName="appraisals"
            empty={{ icon: Plus, title: "No appraisals found", body: "Record performance reviews per staff member.", action: { label: "New Appraisal", onClick: () => setShowDialog(true) } }}
          />
        </DataPanel>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Appraisal</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Staff Member</Label>
                  <AdvancedSelect value={form.staff_id} onChange={(v) => setForm({ ...form, staff_id: v })}
                    clearable searchable placeholder="Select staff"
                    options={(staffOptions || []).map((staff: any) => ({ value: staff.id, label: `${staff.full_name} (${staff.role})` }))} />
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
      </AOSPageBody>
    </AOSPage>
  );
}
