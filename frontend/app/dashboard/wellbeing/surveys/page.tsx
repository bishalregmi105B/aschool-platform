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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import { ClipboardList, Plus } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";

export default function SurveysPage() {
  return <PluginGate slug="wellbeing"><SurveysContent /></PluginGate>;
}

function SurveysContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  // Backend contract (POST /wellbeing/surveys): {title, questions, target_class_ids,
  // is_anonymous} — there is no description column and no cohort selector, so the
  // old dead "Description"/"Target Group" inputs were removed (they were silently
  // discarded; an empty target_class_ids targets all students).
  const [form, setForm] = useState({ title: "", is_anonymous: true });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["wellbeing-surveys"],
    queryFn: async () => (await api.get("/wellbeing/surveys")).data?.data || [],
    retry: 1,
  });

  const surveys: any[] = Array.isArray(data) ? data : [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/wellbeing/surveys", {
      title: form.title,
      questions: [],
      target_class_ids: [],
      is_anonymous: form.is_anonymous,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellbeing-surveys"] });
      setShowDialog(false);
      toast.success("Survey created");
    },
    onError: () => toast.error("Failed to create survey"),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<ClipboardList className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Wellbeing Surveys"
          subtitle="Create and manage student wellbeing surveys"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load surveys. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const SURVEY_COLUMNS: Column<any>[] = [
    {
      key: "title",
      label: "Survey",
      sortable: true,
      value: (sv) => sv.title ?? "",
      render: (sv) => (
        <div>
          <p className="font-medium">{sv.title}</p>
          {sv.description && <p className="text-xs mt-0.5 max-w-xs truncate text-[color:var(--w11-text-secondary)]">{sv.description}</p>}
        </div>
      ),
    },
    { key: "target_audience", label: "Target Group", sortable: true, value: (sv) => sv.target_audience ?? "", render: (sv) => <span className="win11-chip capitalize">{sv.target_audience || "all"}</span> },
    { key: "is_anonymous", label: "Anonymous", sortable: true, value: (sv) => (sv.is_anonymous ? "anonymous" : "named"), render: (sv) => <span className={`win11-chip ${sv.is_anonymous ? "accent" : ""}`}>{sv.is_anonymous ? "Anonymous" : "Named"}</span> },
    { key: "response_count", label: "Responses", align: "right", sortable: true, value: (sv) => sv.response_count || 0 },
    { key: "created_at", label: "Created", sortable: true, value: (sv) => sv.created_at ?? "", render: (sv) => <span className="text-sm">{sv.created_at ? new Date(sv.created_at).toLocaleDateString() : "—"}</span> },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ClipboardList className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Wellbeing Surveys"
        subtitle="Create and manage student wellbeing surveys"
        actions={
          <Button onClick={() => { setForm({ title: "", is_anonymous: true }); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Survey
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0 pt-0">
          <DataTable
            columns={SURVEY_COLUMNS}
            rows={surveys}
            rowKey={(sv: any) => sv.id}
            searchable
            searchPlaceholder="Search surveys…"
            exportFileName="wellbeing-surveys"
            empty={{ icon: ClipboardList, title: "No surveys created yet", body: "Create a survey to check in on student wellbeing.", action: { label: "New Survey", onClick: () => setShowDialog(true) } }}
          />
        </DataPanel>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Wellbeing Survey</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mid-term Wellbeing Check" /></div>
            <p className="text-xs text-[color:var(--w11-text-secondary)]">The survey targets all students. Questions can be added after the survey is created.</p>
            <div className="space-y-2">
              <Label>Anonymity</Label>
              <div className="flex items-center gap-2 h-10">
                <FormCheckbox id="anon" label="Anonymous responses" checked={form.is_anonymous} onCheckedChange={(v) => setForm({ ...form, is_anonymous: v })} />
                <label htmlFor="anon" className="text-sm">Anonymous responses</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>
              {create.isPending ? <Spinner className="mr-2" /> : null} Create Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
