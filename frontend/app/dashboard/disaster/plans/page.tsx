"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
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
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Map, Plus, ArrowRight } from "lucide-react";

export default function EvacuationPlansPage() {
  return <PluginGate slug="disaster_management"><PlansContent /></PluginGate>;
}

function PlansContent() {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: "", type: "earthquake", description: "", assembly_point: "", evacuation_route: "" });

  // Backend contract: GET/POST /emergency/plans (the old /emergency/evacuation-plans
  // route never existed). Plan rows: {name, emergency_type, instructions, assembly_points[]}.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["evacuation-plans"],
    queryFn: async () => { const r = await api.get("/emergency/plans"); return r.data?.data ?? r.data; },
  });

  const plans: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/emergency/plans", {
      name: form.title,
      emergency_type: form.type,
      instructions: [form.description, form.assembly_point ? `Assembly point: ${form.assembly_point}` : "", form.evacuation_route ? `Evacuation route: ${form.evacuation_route}` : ""].filter(Boolean).join("\n"),
      assembly_points: form.assembly_point ? [form.assembly_point] : [],
    })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evacuation-plans"] }); setShowDialog(false); toast.success("Plan created"); setForm({ title: "", type: "earthquake", description: "", assembly_point: "", evacuation_route: "" }); },
    onError: () => toast.error("Failed to create plan"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading evacuation plans…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Evacuation Plans" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load evacuation plans. Please try again.</p>
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
        icon={<Map className="h-5 w-5" style={{ color: "#d83b01" }} />}
        title="Evacuation Plans"
        subtitle={`${plans.length} emergency evacuation ${plans.length === 1 ? "procedure" : "procedures"} and assembly points`}
        actions={
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />Add Plan</Button>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.length === 0 ? (
            <DataPanel className="col-span-full">
              <AOSEmptyState
                icon={<Map className="h-12 w-12" />}
                title="No evacuation plans created yet"
              />
            </DataPanel>
          ) : plans.map((p: any) => (
            <div key={p.id} className="win11-card">
              <div className="flex flex-row items-center justify-between mb-2">
                <span className="text-base font-semibold" style={{ color: "var(--w11-text-primary)" }}>{p.name}</span>
                <span className="win11-chip subtle capitalize">{p.emergency_type}</span>
              </div>
              <div className="space-y-2">
                {p.instructions && <p className="text-sm whitespace-pre-line" style={{ color: "var(--w11-text-secondary)" }}>{p.instructions}</p>}
                {Array.isArray(p.assembly_points) && p.assembly_points.length > 0 && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--w11-text-primary)" }}><Map className="h-4 w-4" style={{ color: "#107c10" }} /><span className="font-medium">Assembly:</span>{p.assembly_points.join(", ")}</div>
                )}
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--w11-text-primary)" }}><ArrowRight className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /><span className="font-medium">Last drilled:</span>{p.last_drilled_at ? new Date(p.last_drilled_at).toLocaleDateString() : "never"}</div>
              </div>
            </div>
          ))}
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Evacuation Plan</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Plan Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Earthquake Evacuation Plan" /></div>
              <div className="space-y-2"><Label>Type</Label>
                <AdvancedSelect
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v })}
            options={[{ value: 'earthquake', label: 'Earthquake' }, { value: 'fire', label: 'Fire' }, { value: 'flood', label: 'Flood' }, { value: 'other', label: 'Other' }]}
          />
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
      </AOSPageBody>
    </AOSPage>
  );
}
