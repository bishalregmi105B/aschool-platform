"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, Search, Users, Mail, Phone, Pencil, Trash2, Upload, Shield } from "lucide-react";
import Link from "next/link";

type StaffRole = "teacher" | "staff" | "accountant" | "school_admin";

interface Staff {
  id: string;
  full_name: string;
  email?: string;
  phone: string;
  role: StaffRole;
  is_active: boolean;
  login_id?: string;
}

interface StaffForm {
  full_name: string;
  email: string;
  phone: string;
  role: StaffRole;
}

const EMPTY_FORM: StaffForm = {
  full_name: "",
  email: "",
  phone: "",
  role: "teacher",
};

const STAFF_ROLE_OPTIONS: Array<{ value: StaffRole; label: string }> = [
  { value: "teacher", label: "Teacher" },
  { value: "staff", label: "Staff" },
  { value: "accountant", label: "Accountant" },
  { value: "school_admin", label: "School Admin" },
];

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["staff", search],
    queryFn: async () => { const r = await api.get("/staff", { params: { search: search || undefined } }); return r.data; },
    retry: 1,
  });

  const staff: Staff[] = data?.data || [];
  const stats = {
    total: staff.length,
    teachers: staff.filter((s: any) => s.role === "teacher").length,
    support: staff.filter((s: any) => s.role !== "teacher").length,
    active: staff.filter((s: any) => s.is_active).length,
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim(),
        role: form.role,
      };

      if (editingStaff) {
        const r = await api.put(`/users/${editingStaff.id}`, payload);
        return r.data;
      }

      const r = await api.post("/staff", payload);
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setShowDialog(false);
      setEditingStaff(null);
      setForm(EMPTY_FORM);
      toast.success(editingStaff ? "Staff member updated!" : "Staff member added!");
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || "Failed to save staff member"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/users/${id}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff status updated");
    },
    onError: () => toast.error("Failed to update staff status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff member deleted");
    },
    onError: () => toast.error("Failed to delete staff member"),
  });

  function openCreateDialog() {
    setEditingStaff(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  }

  function openEditDialog(member: Staff) {
    setEditingStaff(member);
    setForm({
      full_name: member.full_name || "",
      email: member.email || "",
      phone: member.phone || "",
      role: member.role,
    });
    setShowDialog(true);
  }

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load staff. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h1 className="text-2xl font-bold">Staff Management</h1><p className="text-muted-foreground">Manage staff records, jump to roles, and handle bulk onboarding from one page.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings/roles"><Shield className="h-4 w-4 mr-2" /> Roles & Permissions</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/staff/bulk-upload"><Upload className="h-4 w-4 mr-2" /> Bulk Upload</Link>
          </Button>
          <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" /> Add Staff</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Staff", value: stats.total, icon: Users },
          { label: "Teachers", value: stats.teachers, icon: Users },
          { label: "Support Staff", value: stats.support, icon: Users },
          { label: "Active", value: stats.active, icon: Users },
        ].map((s, i) => (
          <Card key={i}><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div><s.icon className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Contact</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No staff found</TableCell></TableRow>
              ) : staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell><Badge variant="outline">{s.role}</Badge></TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {s.email || "—"}
                      </div>
                      {s.phone ? <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {s.phone}</div> : null}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={s.is_active ? "success" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(s)}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatusMutation.mutate(s.id)}
                        disabled={toggleStatusMutation.isPending}
                      >
                        {s.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete ${s.full_name}?`)) {
                            deleteMutation.mutate(s.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          setEditingStaff(null);
          setForm(EMPTY_FORM);
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v: StaffRole) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAFF_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingStaff ? (
              <p className="text-xs text-muted-foreground">
                New staff accounts get a default password automatically if you do not create them through the dedicated teacher flow.
              </p>
            ) : null}
          </div>
          <DialogFooter><Button onClick={() => saveMutation.mutate()} disabled={!form.full_name || !form.phone || saveMutation.isPending}>{saveMutation.isPending ? <Spinner className="mr-2" /> : null} {editingStaff ? "Update Staff" : "Add Staff"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
