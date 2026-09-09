"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import { ClipboardList, Plus } from "lucide-react";

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
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load surveys. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
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
          {sv.description && <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{sv.description}</p>}
        </div>
      ),
    },
    { key: "target_audience", label: "Target Group", sortable: true, value: (sv) => sv.target_audience ?? "", render: (sv) => <Badge variant="outline" className="capitalize">{sv.target_audience || "all"}</Badge> },
    { key: "is_anonymous", label: "Anonymous", sortable: true, value: (sv) => (sv.is_anonymous ? "anonymous" : "named"), render: (sv) => <Badge variant={sv.is_anonymous ? "secondary" : "outline"}>{sv.is_anonymous ? "Anonymous" : "Named"}</Badge> },
    { key: "response_count", label: "Responses", align: "right", sortable: true, value: (sv) => sv.response_count || 0 },
    { key: "created_at", label: "Created", sortable: true, value: (sv) => sv.created_at ?? "", render: (sv) => <span className="text-sm">{sv.created_at ? new Date(sv.created_at).toLocaleDateString() : "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6" /> Wellbeing Surveys</h1>
          <p className="text-muted-foreground">Create and manage student wellbeing surveys</p>
        </div>
        <Button onClick={() => { setForm({ title: "", is_anonymous: true }); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Survey
        </Button>
      </div>

      <Card><CardContent className="pt-6">
        <DataTable
          columns={SURVEY_COLUMNS}
          rows={surveys}
          rowKey={(sv: any) => sv.id}
          searchable
          searchPlaceholder="Search surveys…"
          exportFileName="wellbeing-surveys"
          empty={{ icon: ClipboardList, title: "No surveys created yet", body: "Create a survey to check in on student wellbeing.", action: { label: "New Survey", onClick: () => setShowDialog(true) } }}
        />
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Wellbeing Survey</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mid-term Wellbeing Check" /></div>
            <p className="text-xs text-muted-foreground">The survey targets all students. Questions can be added after the survey is created.</p>
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
    </div>
  );
}
