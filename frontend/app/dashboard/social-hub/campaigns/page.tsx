"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Megaphone, Plus, TrendingUp, Users, Eye, MousePointer } from "lucide-react";

export default function CampaignsPage() {
  return <PluginGate slug="social_ads"><CampaignsContent /></PluginGate>;
}

function CampaignsContent() {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", objective: "admission", budget: "", start_date: "", end_date: "", target_audience: "", post_id: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["ad-campaigns"],
    queryFn: async () => { const r = await api.get("/social/campaigns"); return r.data?.data ?? r.data; },
  });

  const campaigns: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const stats = data?.stats ?? {};

  const create = useMutation({
    mutationFn: async () => (await api.post("/social/campaigns", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ad-campaigns"] }); setShowDialog(false); toast.success("Campaign created"); setForm({ name: "", objective: "admission", budget: "", start_date: "", end_date: "", target_audience: "", post_id: "" }); },
    onError: () => toast.error("Failed to create campaign"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-pink-600" />
          <div><h1 className="text-2xl font-bold">Ad Campaigns</h1><p className="text-muted-foreground">Meta Ads API post boosting for admission campaigns</p></div>
        </div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Campaigns", value: stats.active ?? "—", icon: Megaphone },
          { label: "Total Reach", value: stats.total_reach ? `${(stats.total_reach / 1000).toFixed(1)}K` : "—", icon: Users },
          { label: "Impressions", value: stats.impressions ? `${(stats.impressions / 1000).toFixed(1)}K` : "—", icon: Eye },
          { label: "Clicks", value: stats.clicks ?? "—", icon: MousePointer },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-6 flex items-center gap-4">
            <s.icon className="h-6 w-6 text-pink-600" />
            <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Objective</TableHead><TableHead>Budget</TableHead><TableHead>Period</TableHead><TableHead>Reach</TableHead><TableHead>Clicks</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No campaigns yet. Create your first Meta Ads campaign.</TableCell></TableRow>
            ) : campaigns.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="outline">{c.objective}</Badge></TableCell>
                <TableCell>Rs. {c.budget ? Number(c.budget).toLocaleString() : "—"}</TableCell>
                <TableCell className="text-sm">{c.start_date} – {c.end_date}</TableCell>
                <TableCell>{c.reach ? `${(c.reach / 1000).toFixed(1)}K` : "—"}</TableCell>
                <TableCell>{c.clicks ?? "—"}</TableCell>
                <TableCell><Badge variant={c.status === "active" ? "default" : c.status === "completed" ? "secondary" : "outline"}>{c.status ?? "draft"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Ad Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Campaign Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grade 1 Admission 2082" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Objective</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}>
                  <option value="admission">Admission</option><option value="awareness">Awareness</option><option value="engagement">Engagement</option><option value="traffic">Traffic</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Budget (Rs.)</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Target Audience</Label><Input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="e.g. Parents, Age 25-45, Kathmandu" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name}>{create.isPending ? <Spinner /> : "Create Campaign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
