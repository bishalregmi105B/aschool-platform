"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Users, Plus } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { MetricCard } from "@/components/ui/metric-card";

const HOUSE_COLORS = ["red", "blue", "green", "yellow", "purple", "orange"];

export default function HousesPage() {
  return <AppGate slug="gamification"><HousesContent /></AppGate>;
}

function HousesContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", color: "red", motto: "" });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["gamification-houses"],
    queryFn: async () => (await api.get("/gamification/houses")).data?.data || [],
    retry: 1,
  });

  const houses: any[] = data || [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/gamification/houses", form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-houses"] });
      setShowDialog(false);
      toast.success("House created");
    },
    onError: () => toast.error("Failed to create house"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading houses…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Houses"
          subtitle="Manage school houses for inter-house competitions"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load houses. Please try again.</p>
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
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Houses"
        subtitle="Manage school houses for inter-house competitions"
        actions={
          <Button onClick={() => { setForm({ name: "", color: "red", motto: "" }); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New House
          </Button>
        }
      />
      <AOSPageBody>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {houses.length === 0 ? (
            <DataPanel className="col-span-3">
              <p className="text-center py-12 text-[color:var(--w11-text-secondary)]">
                No houses created yet. Add your first house to get started.
              </p>
            </DataPanel>
          ) : houses.map((h: any) => (
            /* House scores as MetricCards — per spec 34#45. */
            <div key={h.id} style={{ borderTop: `3px solid ${h.color || "var(--w11-accent)"}` }}>
              <MetricCard
                label={h.name}
                value={h.total_points?.toLocaleString() || 0}
                denominator="pts"
                footnote={`“${h.motto || "—"}” · ${h.member_count || 0} members`}
              />
            </div>
          ))}
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>New House</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>House Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lions, Eagles, etc." /></div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {HOUSE_COLORS.map((c) => (
                    <button key={c} onClick={() => setForm({ ...form, color: c })}
                      className="h-8 w-8 rounded-full border-2"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? "var(--w11-accent)" : "transparent",
                        transform: form.color === c ? "scale(1.1)" : undefined,
                      }} />
                  ))}
                </div>
              </div>
              <div className="space-y-2"><Label>Motto (optional)</Label><Input value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} placeholder="Strength, Unity, Excellence" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
                {create.isPending ? <Spinner className="mr-2" /> : null} Create House
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
