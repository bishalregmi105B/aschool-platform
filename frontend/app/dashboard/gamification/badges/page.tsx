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
import { Award, Plus, Pencil } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";

export default function BadgesPage() {
  return <PluginGate slug="gamification"><BadgesContent /></PluginGate>;
}

function BadgesContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", criteria: "", points_value: "10", icon_url: "" });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["gamification-badges"],
    queryFn: async () => (await api.get("/gamification/badges")).data?.data || [],
    retry: 1,
  });

  const badges: any[] = data || [];

  const openAdd = () => { setForm({ name: "", description: "", criteria: "", points_value: "10", icon_url: "" }); setEditItem(null); setShowDialog(true); };
  const openEdit = (b: any) => { setForm({ name: b.name || "", description: b.description || "", criteria: b.criteria || "", points_value: String(b.points_value || 10), icon_url: b.icon_url || "" }); setEditItem(b); setShowDialog(true); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, points_value: parseInt(form.points_value) || 10 };
      if (editItem) return (await api.put(`/gamification/badges/${editItem.id}`, payload)).data;
      return (await api.post("/gamification/badges", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-badges"] });
      setShowDialog(false);
      toast.success(editItem ? "Badge updated" : "Badge created");
    },
    onError: () => toast.error("Failed to save badge"),
  });

  const BADGE_COLUMNS: Column<any>[] = [
    {
      key: "name",
      label: "Badge",
      sortable: true,
      value: (b) => b.name ?? "",
      render: (b) => (
        <div className="flex items-center gap-2">
          <span className="text-xl">{b.icon_url || "🏅"}</span>
          <span className="font-medium">{b.name}</span>
        </div>
      ),
    },
    { key: "description", label: "Description", value: (b) => b.description ?? "", render: (b) => <span className="text-sm text-[color:var(--w11-text-secondary)] max-w-xs truncate block">{b.description || "—"}</span> },
    { key: "criteria", label: "Criteria", value: (b) => b.criteria ?? "", render: (b) => <span className="text-sm">{b.criteria || "—"}</span> },
    { key: "points_value", label: "Points", align: "right", sortable: true, value: (b) => b.points_value ?? 0, render: (b) => <span className="win11-chip">{b.points_value} pts</span> },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (b) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(b); }}><Pencil className="h-4 w-4" /></Button>
      ),
    },
  ];

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<Award className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Badges"
          subtitle="Define achievement badges awarded to students"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load badges. Please try again.</p>
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
        icon={<Award className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Badges"
        subtitle="Define achievement badges awarded to students"
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> New Badge</Button>}
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0 pt-0">
          <DataTable
            columns={BADGE_COLUMNS}
            rows={badges}
            rowKey={(b: any) => b.id}
            searchable
            searchPlaceholder="Search badges…"
            exportFileName="badges"
            empty={{ icon: Award, title: "No badges created yet", body: "Badges motivate students — create your first one.", action: { label: "New Badge", onClick: openAdd } }}
          />
        </DataPanel>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Edit Badge" : "New Badge"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2"><Label>Badge Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Star Performer" /></div>
              <div className="space-y-2"><Label>Icon (emoji)</Label><Input value={form.icon_url} onChange={(e) => setForm({ ...form, icon_url: e.target.value })} placeholder="🌟" /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Criteria</Label><Input value={form.criteria} onChange={(e) => setForm({ ...form, criteria: e.target.value })} placeholder="e.g. Score 90%+ in 3 consecutive exams" /></div>
            <div className="space-y-2"><Label>Points Value</Label><Input type="number" value={form.points_value} onChange={(e) => setForm({ ...form, points_value: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
              {save.isPending ? <Spinner className="mr-2" /> : null} {editItem ? "Update" : "Create Badge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
