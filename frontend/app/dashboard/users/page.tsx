"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Plus, Users } from "lucide-react";

interface User {
  id: string;
  full_name: string;
  email?: string;
  phone: string;
  role: string;
  is_active: boolean;
  created_at: string;
  login_id?: string;
  default_password_hint?: string;
}

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["users", page, search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search) params.set("search", search);
      if (roleFilter !== "all") params.set("role", roleFilter);
      const res = await api.get<ApiResponse>(`/users?${params}`);
      return res.data;
    },
    retry: 1,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User status updated");
    },
    onError: () => toast.error("Failed to update user status"),
  });

  const users: User[] = Array.isArray(data?.data) ? data.data : [];
  const pagination = data?.meta?.pagination;

  const USER_COLUMNS: Column<User>[] = [
    { key: "full_name", label: "Name", sortable: true, value: (u) => u.full_name, render: (u) => <span className="font-medium">{u.full_name}</span> },
    {
      key: "contact",
      label: "Contact",
      value: (u) => u.phone ?? "",
      render: (u) => (
        <div>
          <div className="text-sm">{u.phone}</div>
          {u.email && <div className="text-xs text-muted-foreground">{u.email}</div>}
          <div className="mt-2 text-[11px] text-muted-foreground bg-muted/50 p-1.5 rounded">
            <span className="font-semibold block mb-0.5">Login Credentials:</span>
            ID: <span className="font-mono text-primary">{u.login_id || u.email || u.phone}</span>
          </div>
        </div>
      ),
    },
    { key: "role", label: "Role", sortable: true, value: (u) => u.role, render: (u) => <Badge variant="outline" className="capitalize">{u.role.replace("_", " ")}</Badge> },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      value: (u) => (u.is_active ? "active" : "inactive"),
      render: (u) => (
        <Badge variant={u.is_active ? "success" : "destructive"}>
          {u.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (u) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(u.id); }}
        >
          {u.is_active ? "Deactivate" : "Activate"}
        </Button>
      ),
    },
  ];

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load users. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage school staff and user accounts</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable<User>
            columns={USER_COLUMNS}
            rows={users}
            rowKey={(u) => u.id}
            loading={false}
            searchable
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search by name, email, or phone..."
            exportFileName="users"
            toolbar={
              <AdvancedSelect
                className="w-44"
                value={roleFilter}
                onChange={(v) => { setRoleFilter(v || "all"); setPage(1); }}
                clearable
                placeholder="All Roles"
                options={[
                  { value: "school_admin", label: "School Admin" },
                  { value: "teacher", label: "Teacher" },
                  { value: "accountant", label: "Accountant" },
                  { value: "staff", label: "Staff" },
                ]}
              />
            }
            pagination={pagination ? {
              page: pagination.page,
              pages: pagination.pages,
              total: pagination.total,
              per_page: pagination.per_page,
              has_next: pagination.has_next,
              has_prev: pagination.has_prev,
            } : undefined}
            onPageChange={setPage}
            empty={{ icon: Users, title: "No users found", body: "Add staff accounts so people can sign in.", action: { label: "Add User", onClick: () => setShowAdd(true) } }}
          />
        </CardContent>
      </Card>

      <AddUserDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}

function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/users", {
        full_name: fd.get("full_name"),
        phone: fd.get("phone"),
        email: fd.get("email") || undefined,
        role: fd.get("role"),
        password: fd.get("password"),
      });
      toast.success("User created");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    } catch {
      toast.error("Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input name="full_name" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input name="phone" required placeholder="98XXXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label>Email (optional)</Label>
              <Input name="email" type="email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <AdvancedSelect
                name="role"
                defaultValue="teacher"
                options={[
                  { value: "teacher", label: "Teacher" },
                  { value: "accountant", label: "Accountant" },
                  { value: "staff", label: "Staff" },
                  { value: "school_admin", label: "School Admin" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input name="password" type="password" placeholder="Leave empty for auto-generation" minLength={6} />
              <p className="text-xs text-muted-foreground">Default: {"{first}.{last4}"} (e.g. sita.4821)</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
