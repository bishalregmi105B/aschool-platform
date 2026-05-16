"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Building2, Plus, Search } from "lucide-react";

export default function BranchesPage() {
  return <PluginGate slug="multi_branch"><BranchesContent /></PluginGate>;
}

function BranchesContent() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "", email: "", principal_name: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["branches", search],
    queryFn: async () => { const r = await api.get("/schools/branches", { params: { search: search || undefined } }); return r.data?.data ?? r.data; },
  });

  const branches: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/schools/branches", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branches"] }); setShowDialog(false); toast.success("Branch created"); setForm({ name: "", code: "", address: "", phone: "", email: "", principal_name: "" }); },
    onError: () => toast.error("Failed to create branch"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Branches</h1><p className="text-muted-foreground">Manage all school chain branches</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />Add Branch</Button>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search branches..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead>Principal</TableHead><TableHead>Contact</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {branches.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No branches found</TableCell></TableRow>
            ) : branches.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell><Badge variant="outline">{b.code}</Badge></TableCell>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{b.address ?? "—"}</TableCell>
                <TableCell>{b.principal_name ?? "—"}</TableCell>
                <TableCell>{b.phone ?? b.email ?? "—"}</TableCell>
                <TableCell><Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Inactive"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Branch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Branch Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kathmandu Branch" /></div>
              <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. KTM01" /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Branch address" /></div>
            <div className="space-y-2"><Label>Principal Name</Label><Input value={form.principal_name} onChange={(e) => setForm({ ...form, principal_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name}>{create.isPending ? <Spinner /> : "Create Branch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
