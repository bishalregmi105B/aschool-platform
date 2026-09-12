"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  FilterCommandBar,
  StatGrid,
  KpiCard,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

interface ParentChild {
  id: string;
  name: string;
  class_name?: string;
  section_name?: string;
  student_id?: string;
}

interface ParentUser {
  id: string;
  full_name: string;
  email?: string;
  phone: string;
  is_active: boolean;
  login_id?: string;
  children_count?: number;
  children?: ParentChild[];
}

interface StudentOption {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  class_name?: string;
  section_name?: string;
}

const PER_PAGE = 20;

export default function ParentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    password: "",
    relation: "father",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["parents", page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(PER_PAGE),
        role: "parent",
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter === "active") {
        params.set("is_active", "true");
      } else if (statusFilter === "inactive") {
        params.set("is_active", "false");
      }

      const res = await api.get<ApiResponse<ParentUser[]>>(`/users?${params.toString()}`);
      return res.data;
    },
  });

  const { data: students } = useQuery({
    queryKey: ["parents-linkable-students"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<StudentOption[]>>("/students?per_page=200");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: showAdd,
  });

  // Cheap count queries for the KPI row — per_page=1 on the same parent list
  // endpoint (role=parent), so only the pagination totals are read.
  const { data: parentTotal } = useQuery({
    queryKey: ["parents", "count"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/users?role=parent&per_page=1");
      return res.data?.meta?.pagination?.total as number | undefined;
    },
  });
  const { data: activeParentCount } = useQuery({
    queryKey: ["parents", "count", "active"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/users?role=parent&per_page=1&is_active=true");
      return res.data?.meta?.pagination?.total as number | undefined;
    },
  });

  const createParentMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        role: "parent",
        is_active: true,
      };

      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      const userRes = await api.post<ApiResponse<ParentUser>>("/users", payload);
      const parent = userRes.data?.data;

      if (!parent?.id) {
        throw new Error("Could not create parent account");
      }

      for (const studentId of selectedStudentIds) {
        await api.post(`/students/${studentId}/guardians`, {
          user_id: parent.id,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          relation: form.relation,
          is_primary: true,
        });
      }

      return parent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Parent account created");

      setShowAdd(false);
      setSelectedStudentIds([]);
      setForm({
        full_name: "",
        phone: "",
        email: "",
        password: "",
        relation: "father",
      });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error || "Failed to create parent";
      toast.error(msg);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (parentId: string) => api.post(`/users/${parentId}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({ queryKey: ["parent"] });
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      toast.success("Parent status updated");
    },
    onError: () => toast.error("Failed to update parent status"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading parents…" />;

  const parents = Array.isArray(data?.data) ? data.data : [];

  const PARENT_COLUMNS: Column<ParentUser>[] = [
    { key: "full_name", label: "Parent", sortable: true, value: (pr) => pr.full_name, render: (pr) => <span className="font-medium">{pr.full_name}</span> },
    {
      key: "contact",
      label: "Contact",
      value: (pr) => pr.phone ?? pr.email ?? "",
      render: (pr) => (
        <div>
          <div className="text-sm">{pr.phone || "-"}</div>
          {pr.email && <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{pr.email}</div>}
        </div>
      ),
    },
    {
      key: "children",
      label: "Children",
      align: "right",
      sortable: true,
      value: (pr) => pr.children_count || 0,
      render: (pr) => (
        <div>
          <Badge variant="secondary">{pr.children_count || 0} children</Badge>
          {(pr.children || []).slice(0, 2).map((child) => (
            <div key={child.id} className="text-xs mt-1" style={{ color: "var(--w11-text-secondary)" }}>
              {child.name}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      value: (pr) => (pr.is_active ? "active" : "inactive"),
      render: (pr) => (
        <StatusChip status={pr.is_active ? "active" : "inactive"} label={pr.is_active ? "Active" : "Inactive"} />
      ),
    },
    {
      key: "credentials",
      label: "Credentials",
      value: (pr) => pr.login_id ?? pr.email ?? pr.phone ?? "",
      render: (pr) => <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>ID: {pr.login_id || pr.email || pr.phone}</div>,
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (pr) => (
        <div className="flex justify-end gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/parents/${pr.id}`}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Manage
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); toggleStatusMutation.mutate(pr.id); }}
            disabled={toggleStatusMutation.isPending}
          >
            {pr.is_active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  const pagination = data?.meta?.pagination;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Parents"
        subtitle={
          pagination?.total != null
            ? `${pagination.total} parent accounts · Manage all parent accounts and child links`
            : "Manage all parent accounts and child links"
        }
        actions={
          <Dialog
            open={showAdd}
            onOpenChange={(open) => {
              setShowAdd(open);
              if (!open) {
                setSelectedStudentIds([]);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Parent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create Parent Account</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Parent full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="98XXXXXXXX"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email (Optional)</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="parent@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password (Optional)</Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Leave blank for default"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Relation</Label>
                    <Select
                      value={form.relation}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, relation: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="father">Father</SelectItem>
                        <SelectItem value="mother">Mother</SelectItem>
                        <SelectItem value="guardian">Guardian</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs self-end pb-2" style={{ color: "var(--w11-text-secondary)" }}>
                    If password is empty, backend sets default as EMIS_ID@Last4Phone.
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Link Students (Optional)</Label>
                  <div
                    className="max-h-56 overflow-y-auto border border-[color:var(--w11-border-subtle)] rounded-[var(--w11-radius-md)] p-3 space-y-2"
                  >
                    {(students || []).length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>No students found.</p>
                    ) : (
                      (students || []).map((student) => {
                        const studentName = student.full_name || `${student.first_name || ""} ${student.last_name || ""}`.trim();
                        const checked = selectedStudentIds.includes(student.id);



  return (
                          <label
                            key={student.id}
                            className="flex items-center justify-between gap-3 p-2 rounded-[var(--w11-radius-sm)] hover:bg-[color:var(--w11-control-hover)] cursor-pointer"
                          >
                            <div>
                              <p className="text-sm font-medium">{studentName || "Unnamed student"}</p>
                              <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                                {student.class_name || "Class -"}
                                {student.section_name ? ` • ${student.section_name}` : ""}
                              </p>
                            </div>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                if (value) {
                                  setSelectedStudentIds((prev) => (prev.includes(student.id) ? prev : [...prev, student.id]));
                                } else {
                                  setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
                                }
                              }}
                            />
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createParentMutation.mutate()}
                  disabled={createParentMutation.isPending || !form.full_name.trim() || !form.phone.trim()}
                >
                  {createParentMutation.isPending ? "Saving..." : "Create Parent"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <AOSPageBody>
        {/* Module dashboard — KPI row above the parent accounts table */}
        <StatGrid min={170}>
          <KpiCard
            label="Parent Accounts"
            value={parentTotal ?? pagination?.total ?? "—"}
            footnote={pagination ? `Page ${pagination.page} of ${pagination.pages}` : undefined}
            icon={<Users className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Active"
            value={activeParentCount ?? "—"}
            denominator={parentTotal != null ? `/ ${parentTotal}` : undefined}
            color="#107c10"
            icon={<UserCheck className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label="Inactive"
            value={parentTotal != null && activeParentCount != null ? parentTotal - activeParentCount : "—"}
            color="#d83b01"
            icon={<UserX className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
        </StatGrid>

        <FilterCommandBar>
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
              style={{ color: "var(--w11-text-tertiary)" }}
            />
            <Input
              placeholder="Search parent by name, phone, or email..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FilterCommandBar>

        <DataPanel title="Parent Accounts" bodyClassName="p-0">
          <DataTable<ParentUser>
            columns={PARENT_COLUMNS}
            rows={parents}
            rowKey={(pr) => pr.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search parents…"
            exportFileName="parents"
            pagination={pagination ? {
              page: pagination.page,
              pages: pagination.pages,
              total: pagination.total,
              per_page: pagination.per_page,
              has_next: pagination.has_next,
              has_prev: pagination.has_prev,
            } : undefined}
            onPageChange={setPage}
            empty={{ icon: ShieldCheck, title: "No parent accounts found", body: "Parent accounts are created from guardian records." }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
