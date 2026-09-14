"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounced, useUrlFilters } from "@/components/ui/filter-bar";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
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
import { GraduationCap, CalendarDays, UserCheck, Building2, Plus, Mail, Phone, MapPin, Pencil, Search, Trash2 } from "lucide-react";
import { useConfirm, undoableDelete } from "@/components/ui/confirm-dialog";

export default function AlumniPage() {
  return <AppGate slug="alumni"><AlumniContent /></AppGate>;
}

function AlumniContent() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { values, setValues, clear, activeCount } = useUrlFilters(["q", "batch"]);
  const search = useDebounced(values.q || "", 300);
  const batch = values.batch || "";
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
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

  const toPayload = () => {
    const [first_name = "", ...rest] = form.name.trim().split(/\s+/);
    return {
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
  };

  const save = useMutation({
    mutationFn: async () =>
      editItem
        ? (await api.put(`/alumni/${editItem.id}`, toPayload())).data
        : (await api.post("/alumni", toPayload())).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumni"] });
      setShowDialog(false);
      setEditItem(null);
      setForm({ name: "", email: "", phone: "", batch_year: "", designation: "", organization: "", location: "" });
      toast.success(editItem ? "Alumni updated" : "Alumni added");
    },
    onError: () => toast.error("Failed to save alumni"),
  });

  const openEdit = (a: any) => {
    setEditItem(a);
    setForm({
      name: [a.first_name, a.last_name].filter(Boolean).join(" "),
      email: a.email || "",
      phone: a.phone || "",
      batch_year: String(a.batch || a.graduation_year || ""),
      designation: a.designation || "",
      organization: a.current_organization || "",
      location: a.location || "",
    });
    setShowDialog(true);
  };

  const removeAlumni = async (a: any) => {
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || "this alumnus";
    const ok = await confirm({
      title: "Remove alumni",
      body: `Remove ${name} from the directory?`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    undoableDelete({
      label: name,
      commit: async () => { await api.delete(`/alumni/${a.id}`); },
      optimistic: () => setHideIds((ids) => new Set(ids).add(a.id)),
      rollback: () => setHideIds((ids) => { const next = new Set(ids); next.delete(a.id); return next; }),
    });
    queryClient.invalidateQueries({ queryKey: ["alumni"] });
  };

  const [hideIds, setHideIds] = useState<Set<string>>(new Set());

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
          <Button onClick={() => { setEditItem(null); setForm({ name: "", email: "", phone: "", batch_year: "", designation: "", organization: "", location: "" }); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Alumni
          </Button>
        }
      />
      <AOSPageBody>
        <StatGrid>
          {([
            { label: "Total Alumni", val: stats.total || alumni.length, color: undefined as string | undefined, icon: <GraduationCap className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /> },
            { label: "This Year Batch", val: stats.this_year || 0, color: undefined as string | undefined, icon: <CalendarDays className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} /> },
            { label: "Active Network", val: stats.active || 0, color: "#107c10", icon: <UserCheck className="h-4 w-4" style={{ color: "#107c10" }} /> },
            { label: "Organizations", val: stats.organizations || 0, color: undefined as string | undefined, icon: <Building2 className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} /> },
          ]).map((s) => (
            <KpiCard key={s.label} label={s.label} value={s.val} color={s.color} icon={s.icon} />
          ))}
        </StatGrid>

        <FilterCommandBar>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--w11-text-tertiary)" }} />
            <Input
              className="win11-searchbox pl-8 h-9"
              placeholder="Search alumni…"
              value={values.q || ""}
              onChange={(e) => setValues({ q: e.target.value })}
              aria-label="Search alumni"
            />
          </div>
          <AdvancedSelect className="w-40" value={batch} onChange={(v) => setValues({ batch: v })} clearable placeholder="All Batches"
            options={batchYears.map((y) => ({ value: String(y), label: String(y) }))} />
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
          )}
        </FilterCommandBar>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(() => { const visible = alumni.filter((a: any) => !hideIds.has(a.id)); return visible.length === 0 ? (
            <DataPanel className="col-span-full">
              <AOSEmptyState
                title={alumni.length ? "No alumni match your filters" : "No alumni yet"}
                description={alumni.length ? "Clear the search or batch filter to see the whole network." : "Add your first graduate to start the network."}
                action={alumni.length
                  ? { label: "Clear filters", onClick: clear }
                  : { label: "Add Alumni", onClick: () => setShowDialog(true) }}
              />
            </DataPanel>
          ) : visible.map((a: any) => {
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
                <div className="mt-3 flex justify-end gap-1 border-t border-[var(--w11-border-subtle)] pt-2">
                  <Button size="sm" variant="ghost" aria-label="Edit alumni" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label="Remove alumni" onClick={() => removeAlumni(a)}><Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} /></Button>
                </div>
              </div>
            </div>
          </div>
          );
        }) })()}
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItem ? "Edit Alumni" : "Add Alumni"}</DialogTitle></DialogHeader>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDialog(false); setEditItem(null); }}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
                {save.isPending ? <Spinner className="mr-2" /> : null} {editItem ? "Save" : "Add Alumni"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
