"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { PageLoader } from "@/components/ui/spinner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  ShieldCheck,
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
  default_password_hint?: string;
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

  if (isLoading) return <PageLoader />;

  const parents = Array.isArray(data?.data) ? data.data : [];
  const pagination = data?.meta?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Parents
          </h1>
          <p className="text-muted-foreground">Manage all parent accounts and child links</p>
        </div>

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
                <div className="text-xs text-muted-foreground self-end pb-2">
                  If password is empty, backend sets default as EMIS_ID@Last4Phone.
                </div>
              </div>

              <div className="space-y-2">
                <Label>Link Students (Optional)</Label>
                <div className="max-h-56 overflow-y-auto border rounded-md p-3 space-y-2">
                  {(students || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No students found.</p>
                  ) : (
                    (students || []).map((student) => {
                      const studentName = student.full_name || `${student.first_name || ""} ${student.last_name || ""}`.trim();
                      const checked = selectedStudentIds.includes(student.id);

                      return (
                        <label
                          key={student.id}
                          className="flex items-center justify-between gap-3 p-2 rounded hover:bg-muted/40 cursor-pointer"
                        >
                          <div>
                            <p className="text-sm font-medium">{studentName || "Unnamed student"}</p>
                            <p className="text-xs text-muted-foreground">
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
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parent Accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parent</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Children</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credentials</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No parent accounts found.
                  </TableCell>
                </TableRow>
              ) : (
                parents.map((parent) => (
                  <TableRow key={parent.id}>
                    <TableCell className="font-medium">{parent.full_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">{parent.phone || "-"}</div>
                      {parent.email && (
                        <div className="text-xs text-muted-foreground">{parent.email}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{parent.children_count || 0} children</Badge>
                      {(parent.children || []).slice(0, 2).map((child) => (
                        <div key={child.id} className="text-xs text-muted-foreground mt-1">
                          {child.name}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={parent.is_active ? "success" : "destructive"}>
                        {parent.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">ID: {parent.login_id || parent.email || parent.phone}</div>
                      <div className="text-xs text-muted-foreground">
                        PW: {parent.default_password_hint || "Custom"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/parents/${parent.id}`}>
                            <ShieldCheck className="h-4 w-4 mr-1" /> Manage
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleStatusMutation.mutate(parent.id)}
                          disabled={toggleStatusMutation.isPending}
                        >
                          {parent.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_prev}
                onClick={() => setPage((prev) => prev - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_next}
                onClick={() => setPage((prev) => prev + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
