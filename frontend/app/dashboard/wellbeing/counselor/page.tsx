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
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Brain, Plus } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";

export default function CounselorPage() {
  return <PluginGate slug="wellbeing"><CounselorContent /></PluginGate>;
}

function CounselorContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ student_id: "", note: "", session_type: "individual", action_taken: "" });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["counselor-notes"],
    queryFn: async () => (await api.get("/wellbeing/counselor-notes")).data?.data || [],
    retry: 1,
  });

  const notes: any[] = Array.isArray(data) ? data : [];

  const create = useMutation({
    // Backend contract (POST /wellbeing/counselor-notes): {student_id, type,
    // content, is_confidential} — the old `note`/`session_type`/`action_taken`
    // keys are not read by the backend, so notes were saved with empty content.
    mutationFn: async () => (await api.post("/wellbeing/counselor-notes", {
      student_id: form.student_id.trim(),
      type: form.session_type,
      content: form.note,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counselor-notes"] });
      setShowDialog(false);
      toast.success("Note saved");
    },
    onError: () => toast.error("Failed to save note"),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<Brain className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Counselor Notes"
          subtitle="Record counseling sessions and follow-ups"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load counselor notes. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const NOTE_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (n) => n.student_name ?? "", render: (n) => <span className="font-medium">{n.student_name || n.student_id}</span> },
    { key: "note_type", label: "Type", sortable: true, value: (n) => n.note_type ?? "", render: (n) => <span className="win11-chip capitalize">{n.note_type || "general"}</span> },
    { key: "content", label: "Note", value: (n) => n.content ?? "", render: (n) => <span className="text-sm max-w-xs truncate block">{n.content || "—"}</span> },
    { key: "created_at", label: "Date", sortable: true, value: (n) => n.created_at ?? "", render: (n) => <span className="text-sm">{n.created_at ? new Date(n.created_at).toLocaleDateString() : "—"}</span> },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Brain className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Counselor Notes"
        subtitle="Record counseling sessions and follow-ups"
        actions={
          <Button onClick={() => { setForm({ student_id: "", note: "", session_type: "individual", action_taken: "" }); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Note
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0 pt-0">
          <DataTable
            columns={NOTE_COLUMNS}
            rows={notes}
            rowKey={(n: any) => n.id}
            searchable
            searchPlaceholder="Search notes…"
            exportFileName="counselor-notes"
            empty={{ icon: Brain, title: "No counselor notes yet", body: "Record a session to start the counseling log.", action: { label: "New Note", onClick: () => setShowDialog(true) } }}
          />
        </DataPanel>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Counselor Note</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Student ID</Label><Input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} placeholder="STU-2023-001" /></div>
              <div className="space-y-2">
                <Label>Session Type</Label>
                <AdvancedSelect
          value={form.session_type}
          onChange={(v) => setForm({ ...form, session_type: v })}
          options={[{ value: 'individual', label: 'Individual' }, { value: 'group', label: 'Group' }, { value: 'parent', label: 'Parent Meeting' }, { value: 'referral', label: 'External Referral' }]}
        />
              </div>
            </div>
            <div className="space-y-2"><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Action Taken</Label><Textarea value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.student_id || !form.note || create.isPending}>
              {create.isPending ? <Spinner className="mr-2" /> : null} Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
