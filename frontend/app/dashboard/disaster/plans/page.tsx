"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Map, Plus, ArrowRight } from "lucide-react";

export default function EvacuationPlansPage() {
  return <PluginGate slug="disaster_management"><PlansContent /></PluginGate>;
}

function PlansContent() {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: "", type: "earthquake", description: "", assembly_point: "", evacuation_route: "", capacity: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["evacuation-plans"],
    queryFn: async () => { const r = await api.get("/emergency/evacuation-plans"); return r.data?.data ?? r.data; },
  });

  const plans: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/emergency/evacuation-plans", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evacuation-plans"] }); setShowDialog(false); toast.success("Plan created"); setForm({ title: "", type: "earthquake", description: "", assembly_point: "", evacuation_route: "", capacity: "" }); },
    onError: () => toast.error("Failed to create plan"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Evacuation Plans</h1><p className="text-muted-foreground">Emergency evacuation procedures and assembly points</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />Add Plan</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.length === 0 ? (
          <Card className="col-span-full"><CardContent className="pt-6 text-center text-muted-foreground py-12">
            <Map className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No evacuation plans created yet.</p>
          </CardContent></Card>
        ) : plans.map((p: any) => (
          <Card key={p.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">{p.title}</CardTitle>
              <Badge variant="outline">{p.type}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
              <div className="flex items-center gap-2 text-sm"><Map className="h-4 w-4 text-green-600" /><span className="font-medium">Assembly:</span>{p.assembly_point ?? "—"}</div>
              <div className="flex items-center gap-2 text-sm"><ArrowRight className="h-4 w-4 text-blue-600" /><span className="font-medium">Route:</span>{p.evacuation_route ?? "—"}</div>
              {p.capacity && <div className="text-sm text-muted-foreground">Capacity: {p.capacity} persons</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Evacuation Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Plan Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Earthquake Evacuation Plan" /></div>
            <div className="space-y-2"><Label>Type</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="earthquake">Earthquake</option><option value="fire">Fire</option><option value="flood">Flood</option><option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Assembly Point</Label><Input value={form.assembly_point} onChange={(e) => setForm({ ...form, assembly_point: e.target.value })} placeholder="e.g. School Ground / Open Field" /></div>
            <div className="space-y-2"><Label>Evacuation Route</Label><Input value={form.evacuation_route} onChange={(e) => setForm({ ...form, evacuation_route: e.target.value })} placeholder="e.g. North Exit → Ground" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.title}>{create.isPending ? <Spinner /> : "Create Plan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
