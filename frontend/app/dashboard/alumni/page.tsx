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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { GraduationCap, Search, Plus, Mail, Phone, MapPin } from "lucide-react";

export default function AlumniPage() {
  return <PluginGate slug="alumni"><AlumniContent /></PluginGate>;
}

function AlumniContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", batch_year: "", current_occupation: "", organization: "", address: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["alumni", search, batch],
    queryFn: async () => { const r = await api.get("/alumni", { params: { search: search || undefined, batch_year: batch || undefined } }); return r.data; },
  });

  const alumni = data?.data || [];
  const stats = data?.stats || {};

  const create = useMutation({
    mutationFn: async () => (await api.post("/alumni", { ...form, batch_year: parseInt(form.batch_year) || undefined })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["alumni"] }); setShowDialog(false); toast.success("Alumni added"); },
    onError: () => toast.error("Failed to add alumni"),
  });

  if (isLoading) return <PageLoader />;

  const currentYear = new Date().getFullYear();
  const batchYears = Array.from({ length: 30 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Alumni Network</h1><p className="text-muted-foreground">Stay connected with our alumni community</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Alumni</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[{ label: "Total Alumni", val: stats.total || alumni.length }, { label: "This Year Batch", val: stats.this_year || 0 }, { label: "Active Network", val: stats.active || 0 }, { label: "Organizations", val: stats.organizations || 0 }].map((s) => (
          <Card key={s.label}><CardContent className="py-4"><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.val}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search alumni..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="border rounded-md px-3" value={batch} onChange={(e) => setBatch(e.target.value)}>
          <option value="">All Batches</option>
          {batchYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alumni.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">No alumni found</div>
        ) : alumni.map((a: any) => (
          <Card key={a.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar
                  name={a.name || "Alumni"}
                  size="lg"
                  className="h-12 w-12"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{a.name}</h3>
                  <p className="text-sm text-muted-foreground">{a.current_occupation || "—"}{a.organization ? ` at ${a.organization}` : ""}</p>
                  <Badge variant="outline" className="mt-1"><GraduationCap className="h-3 w-3 mr-1" />Batch {a.batch_year}</Badge>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {a.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{a.email}</div>}
                    {a.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.phone}</div>}
                    {a.address && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.address}</div>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Alumni</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Batch Year</Label><Input type="number" value={form.batch_year} onChange={(e) => setForm({ ...form, batch_year: e.target.value })} /></div>
              <div className="space-y-2"><Label>Current Occupation</Label><Input value={form.current_occupation} onChange={(e) => setForm({ ...form, current_occupation: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Organization</Label><Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Add Alumni</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
