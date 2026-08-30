"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Megaphone, Plus, TrendingUp, Users, MousePointer, Pause, Play, Trash2 } from "lucide-react";

const EMPTY_FORM = {
  name: "",
  platform: "facebook",
  objective: "admission",
  budget: "",
  start_date: "",
  end_date: "",
  content: "",
  media_url: "",
  target_audience: "",
};

type ClassRow = { id: string; name: string; sections?: { id: string; name: string }[] };

function errMsg(e: unknown): string {
  const ax = e as { response?: { data?: { error?: string } } };
  return ax?.response?.data?.error || "Something went wrong";
}

export default function CampaignsPage() {
  return <PluginGate slug="social_ads"><CampaignsContent /></PluginGate>;
}

function CampaignsContent() {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [classIds, setClassIds] = useState<string[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [audience, setAudience] = useState("students_parents");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Real API: GET /social/campaigns → { items, stats } (E30 backend blueprint).
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["ad-campaigns"],
    queryFn: async () => {
      const r = await api.get("/social/campaigns");
      return r.data?.data ?? r.data;
    },
    retry: 1,
  });

  // Real school data for targeting: classes come with nested sections.
  const { data: classes = [] } = useQuery<ClassRow[]>({
    queryKey: ["ad-targeting-classes"],
    queryFn: async () => {
      const r = await api.get("/academics/classes");
      return (r.data?.data ?? r.data ?? []) as ClassRow[];
    },
    enabled: showDialog,
  });

  const campaigns: any[] = Array.isArray(data) ? data : data?.items ?? [];
  const stats = data?.stats ?? {};

  // Honest reach preview: live count of matched students + guardians from the
  // school's own database (NOT an impressions forecast).
  const previewKey = `${classIds.join(",")}|${sectionIds.join(",")}|${audience}`;
  const { data: preview, isFetching: previewLoading } = useQuery<any>({
    queryKey: ["ad-audience-preview", previewKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classIds.length) params.set("class_ids", classIds.join(","));
      if (sectionIds.length) params.set("section_ids", sectionIds.join(","));
      params.set("audience", audience);
      const r = await api.get(`/social/campaigns/preview?${params.toString()}`);
      return r.data?.data ?? r.data;
    },
    enabled: showDialog,
  });

  const selectedSections = useMemo(
    () =>
      classes
        .filter((c) => classIds.includes(c.id))
        .flatMap((c) => (c.sections ?? []).map((s) => ({ ...s, className: c.name }))),
    [classes, classIds]
  );

  const toggle = (list: string[], id: string, set: (v: string[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const toggleClass = (id: string) => {
    if (classIds.includes(id)) {
      // Dropping a class also drops its sections.
      const cls = classes.find((c) => c.id === id);
      const dropped = new Set((cls?.sections ?? []).map((s) => s.id));
      setClassIds(classIds.filter((x) => x !== id));
      setSectionIds(sectionIds.filter((sid) => !dropped.has(sid)));
    } else {
      setClassIds([...classIds, id]);
    }
  };

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post("/social/campaigns", {
          name: form.name,
          platform: form.platform,
          objective: form.objective,
          budget: form.budget || undefined,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
          content: form.content || undefined,
          media_url: form.media_url || undefined,
          target_audience: form.target_audience || undefined,
          class_ids: classIds,
          section_ids: sectionIds,
          audience,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ad-campaigns"] });
      setShowDialog(false);
      toast.success("Campaign created");
      setForm({ ...EMPTY_FORM });
      setClassIds([]);
      setSectionIds([]);
      setAudience("students_parents");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  // draft → active. The backend only allows pause on "active" and resume on
  // "paused" (400 otherwise), and create always yields "draft" — without this
  // action a fresh campaign could never be started and the pause/resume
  // buttons could never appear (E133).
  const activate = useMutation({
    mutationFn: async (id: string) =>
      (await api.patch(`/social/campaigns/${id}`, { status: "active" })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ad-campaigns"] });
      toast.success("Campaign started");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const statusAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "pause" | "resume" }) =>
      (await api.post(`/social/campaigns/${id}/${action}`)).data,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["ad-campaigns"] });
      toast.success(v.action === "pause" ? "Campaign paused" : "Campaign resumed");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/social/campaigns/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ad-campaigns"] });
      setDeleteId(null);
      toast.success("Campaign deleted");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <PageLoader />;

  if (isError)
    return (
      <div className="space-y-6">
        <Header />
        <Card><CardContent className="py-12 text-center">
          <p className="text-destructive mb-4">Failed to load ad campaigns.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );

  return (
    <div className="space-y-6">
      <Header />
      <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />New Campaign</Button>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Campaigns", value: stats.active ?? 0, icon: Megaphone },
          { label: "Estimated Audience", value: stats.estimated_audience ?? 0, icon: TrendingUp },
          { label: "Total Reach", value: stats.total_reach ?? 0, icon: Users },
          { label: "Clicks", value: stats.clicks ?? 0, icon: MousePointer },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-6 flex items-center gap-4">
            <s.icon className="h-6 w-6 text-pink-600" />
            <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{Number(s.value).toLocaleString()}</p></div>
          </CardContent></Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Reach/impressions/clicks are real delivery counters and stay 0 until a Meta Ads
        delivery integration is connected; &ldquo;Estimated Audience&rdquo; counts matched
        students + guardians from this school&apos;s own data.
      </p>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Objective</TableHead><TableHead>Budget</TableHead><TableHead>Period</TableHead><TableHead>Est. Audience</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No campaigns yet. Create your first admission campaign.</TableCell></TableRow>
            ) : campaigns.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="outline">{c.objective}</Badge></TableCell>
                <TableCell>Rs. {c.budget ? Number(c.budget).toLocaleString() : "—"}</TableCell>
                <TableCell className="text-sm">{c.start_date?.slice(0, 10) || "—"} – {c.end_date?.slice(0, 10) || "—"}</TableCell>
                <TableCell>{c.audience_estimate?.estimated_reach ?? "—"}</TableCell>
                <TableCell><Badge variant={c.status === "active" ? "default" : c.status === "completed" ? "secondary" : "outline"}>{c.status ?? "draft"}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {c.status === "draft" && (
                      <Button variant="ghost" size="sm" disabled={activate.isPending}
                        title="Start campaign"
                        onClick={() => activate.mutate(c.id)}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {c.status === "active" && (
                      <Button variant="ghost" size="sm" disabled={statusAction.isPending}
                        onClick={() => statusAction.mutate({ id: c.id, action: "pause" })}>
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {c.status === "paused" && (
                      <Button variant="ghost" size="sm" disabled={statusAction.isPending}
                        onClick={() => statusAction.mutate({ id: c.id, action: "resume" })}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" disabled={remove.isPending}
                      onClick={() => setDeleteId(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Ad Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Campaign Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grade 1 Admission 2082" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Platform</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                  <option value="facebook">Facebook</option><option value="instagram">Instagram</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Objective</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}>
                  <option value="admission">Admission</option><option value="awareness">Awareness</option><option value="engagement">Engagement</option><option value="traffic">Traffic</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Budget (Rs.)</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
              <div className="space-y-2"><Label>Audience</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="students_parents">Students + Parents</option>
                  <option value="students">Students only</option>
                  <option value="parents">Parents only</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Ad Content</Label><Textarea rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Ad copy shown on the boosted post" /></div>
            <div className="space-y-2"><Label>Media URL (https)</Label><Input value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="https://cdn.example.com/ad.jpg" /></div>

            <div className="space-y-2">
              <Label>Target Classes</Label>
              {classes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No classes found — campaign will target the whole school.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {classes.map((c) => (
                    <button key={c.id} type="button"
                      className={`px-2 py-1 text-xs rounded-full border ${classIds.includes(c.id) ? "bg-pink-600 text-white border-pink-600" : "hover:bg-muted"}`}
                      onClick={() => toggleClass(c.id)}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedSections.length > 0 && (
              <div className="space-y-2">
                <Label>Sections (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedSections.map((s) => (
                    <button key={s.id} type="button"
                      className={`px-2 py-1 text-xs rounded-full border ${sectionIds.includes(s.id) ? "bg-pink-600 text-white border-pink-600" : "hover:bg-muted"}`}
                      onClick={() => toggle(sectionIds, s.id, setSectionIds)}>
                      {s.name} · {s.className}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated in-school audience</span>
                {previewLoading ? <Spinner size="sm" /> : <span className="font-semibold">{preview?.estimated_reach ?? "—"}</span>}
              </div>
              {preview && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.students_count} students + {preview.guardians_count} guardians matched. Not a Meta impression forecast.
                </p>
              )}
            </div>

            <div className="space-y-2"><Label>Audience Note (optional)</Label><Input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="e.g. focus on admission-season parents" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name}>{create.isPending ? <Spinner /> : "Create Campaign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete campaign?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This soft-deletes the campaign. Delivery history is kept.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => deleteId && remove.mutate(deleteId)}>
              {remove.isPending ? <Spinner /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Megaphone className="h-6 w-6 text-pink-600" />
        <div><h1 className="text-2xl font-bold">Ad Campaigns</h1><p className="text-muted-foreground">Boost posts to your school&apos;s students and parents</p></div>
      </div>
    </div>
  );
}
