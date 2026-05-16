"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Users, Plus } from "lucide-react";

const HOUSE_COLORS = ["red", "blue", "green", "yellow", "purple", "orange"];

export default function HousesPage() {
  return <PluginGate slug="gamification"><HousesContent /></PluginGate>;
}

function HousesContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", color: "red", motto: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["gamification-houses"],
    queryFn: async () => (await api.get("/gamification/houses")).data?.data || [],
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Houses</h1>
          <p className="text-muted-foreground">Manage school houses for inter-house competitions</p>
        </div>
        <Button onClick={() => { setForm({ name: "", color: "red", motto: "" }); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New House
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {houses.length === 0 ? (
          <p className="col-span-3 text-center text-muted-foreground py-12">No houses created yet. Add your first house to get started.</p>
        ) : houses.map((h: any) => (
          <Card key={h.id} className="border-l-4" style={{ borderLeftColor: h.color }}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-full" style={{ backgroundColor: h.color }} />
                <h3 className="font-semibold text-lg">{h.name}</h3>
              </div>
              {h.motto && <p className="text-sm text-muted-foreground italic mb-2">&ldquo;{h.motto}&rdquo;</p>}
              <div className="flex justify-between items-center mt-3">
                <span className="text-sm text-muted-foreground">{h.member_count || 0} members</span>
                <Badge variant="outline" className="font-mono">{h.total_points?.toLocaleString() || 0} pts</Badge>
              </div>
            </CardContent>
          </Card>
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
                    className={`h-8 w-8 rounded-full border-2 ${form.color === c ? "border-primary scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
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
    </div>
  );
}
