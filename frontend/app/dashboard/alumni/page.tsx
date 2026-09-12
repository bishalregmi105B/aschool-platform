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
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { GraduationCap, Plus, Mail, Phone, MapPin } from "lucide-react";

export default function AlumniPage() {
  return <PluginGate slug="alumni"><AlumniContent /></PluginGate>;
}

function AlumniContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  // Backend contract (POST /alumni): first_name + last_name required,
  // graduation_year/batch (strings), designation, current_organization, location.
  const [form, setForm] = useState({ name: "", email: "", phone: "", batch_year: "", designation: "", organization: "", location: "" });

  // Backend filter param is `batch` (Alumni.batch) — the old `batch_year`
  // param was silently ignored, so the batch filter never filtered.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["alumni", search, batch],
    queryFn: async () => { const r = await api.get("/alumni", { params: { search: search || undefined, batch: batch || undefined } }); return r.data; },
    retry: 1,
  });

  const alumni = data?.data || [];
  const stats = data?.meta?.stats || {};

  const create = useMutation({
    mutationFn: async () => {
      const [first_name = "", ...rest] = form.name.trim().split(/\s+/);
      const payload = {
        first_name,
        last_name: rest.join(" ") || first_name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        graduation_year: form.batch_year || undefined,
        batch: form.batch_year || undefined,
        designation: form.designation || undefined,
        current_organization: form.organization || undefined,
        location: form.location || undefined,
      };
      return (await api.post("/alumni", payload)).data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["alumni"] }); setShowDialog(false); setForm({ name: "", email: "", phone: "", batch_year: "", designation: "", organization: "", location: "" }); toast.success("Alumni added"); },
    onError: () => toast.error("Failed to add alumni"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading alumni…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Alumni Network" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load alumni directory. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const currentYear = new Date().getFullYear();
  const batchYears = Array.from({ length: 30 }, (_, i) => currentYear - i);

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Alumni Network"
        subtitle={`${stats.total || alumni.length} alumni · ${stats.organizations || 0} organizations`}
        actions={
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Alumni</Button>
        }
      />
      <AOSPageBody>
        <StatGrid>
          {[{ label: "Total Alumni", val: stats.total || alumni.length }, { label: "This Year Batch", val: stats.this_year || 0 }, { label: "Active Network", val: stats.active || 0, color: "#107c10" }, { label: "Organizations", val: stats.organizations || 0 }].map((s) => (
            <KpiCard key={s.label} label={s.label} value={s.val} color={s.color} />
          ))}
        </StatGrid>

        <FilterCommandBar>
          <AdvancedSelect className="w-40" value={batch} onChange={(v) => setBatch(v)} clearable placeholder="All Batches"
            options={batchYears.map((y) => ({ value: String(y), label: String(y) }))} />
        </FilterCommandBar>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alumni.length === 0 ? (
            <DataPanel className="col-span-full">
              <AOSEmptyState title="No alumni found" />
            </DataPanel>
          ) : alumni.map((a: any) => {
          const fullName = [a.first_name, a.last_name].filter(Boolean).join(" ") || "Alumni";
          return (
          <div key={a.id} className="win11-card hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <Avatar
                name={fullName}
                size="lg"
                className="h-12 w-12"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate" style={{ color: "var(--w11-text-primary)" }}>{fullName}</h3>
                <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{a.designation || "—"}{a.current_organization ? ` at ${a.current_organization}` : ""}</p>
                <span className="win11-chip subtle mt-1 inline-flex items-center gap-1"><GraduationCap className="h-3 w-3" />Batch {a.batch || a.graduation_year || "—"}</span>
                <div className="mt-3 space-y-1 text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                  {a.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{a.email}</div>}
                  {a.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.phone}</div>}
                  {a.location && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</div>}
                </div>
              </div>
            </div>
          </div>
          );
        })}
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
                <div className="space-y-2"><Label>Current Role</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Organization</Label><Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></div>
              <div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Add Alumni</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
