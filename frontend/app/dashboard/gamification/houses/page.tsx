"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Users, Plus } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";

const HOUSE_COLORS = ["red", "blue", "green", "yellow", "purple", "orange"];

export default function HousesPage() {
  return <PluginGate slug="gamification"><HousesContent /></PluginGate>;
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

  if (isLoading) return <PageLoader />;
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
            <p className="col-span-3 text-center py-12 text-[color:var(--w11-text-secondary)]">No houses created yet. Add your first house to get started.</p>
          ) : houses.map((h: any) => (
            <div key={h.id} className="win11-card" style={{ marginBottom: 0, borderLeft: `4px solid ${h.color}` }}>
              <div className="pt-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-full" style={{ backgroundColor: h.color }} />
                  <h3 className="font-semibold text-lg text-[color:var(--w11-text-primary)]">{h.name}</h3>
                </div>
                {h.motto && <p className="text-sm italic mb-2 text-[color:var(--w11-text-secondary)]">&ldquo;{h.motto}&rdquo;</p>}
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm text-[color:var(--w11-text-secondary)]">{h.member_count || 0} members</span>
                  <span className="win11-chip font-mono">{h.total_points?.toLocaleString() || 0} pts</span>
                </div>
              </div>
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
