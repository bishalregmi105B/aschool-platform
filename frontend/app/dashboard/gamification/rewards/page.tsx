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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Gift, Plus, Star } from "lucide-react";

export default function RewardsPage() {
  return <PluginGate slug="gamification"><RewardsContent /></PluginGate>;
}

function RewardsContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", points_required: "100", quantity_available: "" });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["gamification-rewards"],
    queryFn: async () => (await api.get("/gamification/rewards")).data?.data || [],
    retry: 1,
  });

  const rewards: any[] = data || [];

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        points_required: parseInt(form.points_required) || 100,
        quantity_available: form.quantity_available ? parseInt(form.quantity_available) : null,
      };
      return (await api.post("/gamification/rewards", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-rewards"] });
      setShowDialog(false);
      toast.success("Reward created");
    },
    onError: () => toast.error("Failed to create reward"),
  });

  const REWARD_COLUMNS: Column<any>[] = [
    {
      key: "name",
      label: "Reward",
      sortable: true,
      value: (r) => r.name ?? "",
      render: (r) => (
        <div className="flex items-center gap-2 font-medium"><Gift className="h-4 w-4 text-muted-foreground" />{r.name}</div>
      ),
    },
    { key: "description", label: "Description", value: (r) => r.description ?? "", render: (r) => <span className="text-sm text-muted-foreground">{r.description || "—"}</span> },
    { key: "points_required", label: "Points Required", align: "right", sortable: true, value: (r) => r.points_required ?? 0, render: (r) => <Badge variant="outline"><Star className="h-3 w-3 mr-1" />{r.points_required?.toLocaleString()} XP</Badge> },
    { key: "quantity_available", label: "Available", align: "right", sortable: true, value: (r) => r.quantity_available ?? -1, render: (r) => (r.quantity_available != null ? r.quantity_available : "Unlimited") },
  ];

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load rewards. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gift className="h-6 w-6" /> Rewards</h1>
          <p className="text-muted-foreground">Rewards students can redeem with their XP points</p>
        </div>
        <Button onClick={() => { setForm({ name: "", description: "", points_required: "100", quantity_available: "" }); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Reward
        </Button>
      </div>

      <Card><CardContent className="pt-6">
        <DataTable
          columns={REWARD_COLUMNS}
          rows={rewards}
          rowKey={(r: any) => r.id}
          searchable
          searchPlaceholder="Search rewards…"
          exportFileName="rewards"
          empty={{ icon: Gift, title: "No rewards defined yet", body: "Rewards give students something to spend XP on." }}
        />
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Reward</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Reward Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Library free pass, School trip, etc." /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Points Required</Label><Input type="number" value={form.points_required} onChange={(e) => setForm({ ...form, points_required: e.target.value })} /></div>
              <div className="space-y-2"><Label>Qty Available (blank = unlimited)</Label><Input type="number" value={form.quantity_available} onChange={(e) => setForm({ ...form, quantity_available: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
              {create.isPending ? <Spinner className="mr-2" /> : null} Create Reward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
