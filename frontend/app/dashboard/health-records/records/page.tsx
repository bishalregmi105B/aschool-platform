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
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Stethoscope, Plus } from "lucide-react";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { displayBS } from "@/lib/nepali_date";

export default function HealthRecordsPage() {
  return <PluginGate slug="health_records"><RecordsContent /></PluginGate>;
}

function RecordsContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ student_id: "", visit_date: "", reason: "", diagnosis: "", treatment: "" });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["health-visits"],
    queryFn: async () => (await api.get("/health-records/visits")).data?.data || [],
    retry: 1,
  });

  const visits: any[] = (Array.isArray(data) ? data : []).filter((v: any) =>
    v.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.reason?.toLowerCase().includes(search.toLowerCase())
  );

  const create = useMutation({
    mutationFn: async () => (await api.post("/health-records/visits", form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-visits"] });
      setShowDialog(false);
      toast.success("Visit recorded");
    },
    onError: () => toast.error("Failed to save visit"),
  });

  const VISIT_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (v) => v.student_name ?? "", render: (v) => <span className="font-medium">{v.student_name || v.student_id}</span> },
    { key: "visit_date", label: "Visit Date", sortable: true, value: (v) => v.visit_date ?? "", render: (v) => <span className="text-sm">{v.visit_date ? displayBS(v.visit_date) : "—"}</span> },
    { key: "reason", label: "Reason", value: (v) => v.reason ?? "", render: (v) => <span className="text-sm">{v.reason || "—"}</span> },
    { key: "diagnosis", label: "Diagnosis", value: (v) => v.diagnosis ?? "", render: (v) => <span className="text-sm">{v.diagnosis || "—"}</span> },
    { key: "treatment", label: "Treatment", value: (v) => v.treatment ?? "", render: (v) => <span className="text-sm">{v.treatment || "—"}</span> },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading medical visits…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Medical Visits" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load medical visits. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Stethoscope className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Medical Visits"
        subtitle={`${visits.length} student health ${visits.length === 1 ? "visit" : "visits"}`}
        actions={
          <Button onClick={() => { setForm({ student_id: "", visit_date: "", reason: "", diagnosis: "", treatment: "" }); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Record Visit
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={VISIT_COLUMNS}
            rows={visits}
            rowKey={(v: any) => v.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by student or reason..."
            exportFileName="health-visits"
            empty={{ icon: Stethoscope, title: "No visit records found", body: "Record a visit to start the health history.", action: { label: "Record Visit", onClick: () => setShowDialog(true) } }}
          />
        </DataPanel>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Medical Visit</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Student ID</Label><Input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} /></div>
                <div className="space-y-2"><Label>Visit Date</Label><BSDateInput value={form.visit_date} onChange={(v) => setForm({ ...form, visit_date: v })} /></div>
              </div>
              <div className="space-y-2"><Label>Reason for Visit</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              <div className="space-y-2"><Label>Diagnosis</Label><Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} rows={2} /></div>
              <div className="space-y-2"><Label>Treatment Given</Label><Textarea value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!form.student_id || !form.visit_date || create.isPending}>
                {create.isPending ? <Spinner className="mr-2" /> : null} Save Record
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
