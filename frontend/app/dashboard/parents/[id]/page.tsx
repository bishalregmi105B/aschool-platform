"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import {
  ArrowLeft,
  KeyRound,
  Link2,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
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
  full_name?: string;
  first_name?: string;
  last_name?: string;
  class_name?: string;
  section_name?: string;
}

export default function ParentDetailPage() {
  const params = useParams();
  const parentId = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const queryClient = useQueryClient();

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
    email: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [linkForm, setLinkForm] = useState({
    studentId: "",
    relation: "father",
  });

  const {
    data: parent,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["parent", parentId],
    enabled: Boolean(parentId),
    queryFn: async () => {
      const res = await api.get<ApiResponse<ParentUser>>(`/users/${parentId}`);
      return res.data.data;
    },
  });

  const { data: students } = useQuery({
    queryKey: ["parent-linkable-students", parentId],
    enabled: Boolean(parentId),
    queryFn: async () => {
      const res = await api.get<ApiResponse<StudentOption[]>>("/students?per_page=300");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  useEffect(() => {
    if (!parent) return;
    setProfileForm({
      full_name: parent.full_name || "",
      phone: parent.phone || "",
      email: parent.email || "",
    });
  }, [parent]);

  const linkedStudentIds = useMemo(() => {
    return new Set((parent?.children || []).map((child) => child.id));
  }, [parent?.children]);

  const availableStudents = useMemo(() => {
    return (students || []).filter((student) => !linkedStudentIds.has(student.id));
  }, [linkedStudentIds, students]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      return api.put(`/users/${parentId}`, {
        full_name: profileForm.full_name.trim(),
        phone: profileForm.phone.trim(),
        email: profileForm.email.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent", parentId] });
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      toast.success("Parent profile updated");
    },
    onError: () => toast.error("Failed to update profile"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async () => api.post(`/users/${parentId}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent", parentId] });
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      toast.success("Parent status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => api.put(`/users/${parentId}`, { password: newPassword }),
    onSuccess: () => {
      setNewPassword("");
      toast.success("Parent password reset successfully");
    },
    onError: () => toast.error("Failed to reset password"),
  });

  const linkStudentMutation = useMutation({
    mutationFn: async () => {
      if (!linkForm.studentId) {
        throw new Error("Please select a student");
      }

      await api.post(`/students/${linkForm.studentId}/guardians`, {
        user_id: parentId,
        full_name: profileForm.full_name.trim() || parent?.full_name,
        phone: profileForm.phone.trim() || parent?.phone,
        email: profileForm.email.trim() || parent?.email || undefined,
        relation: linkForm.relation,
        is_primary: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent", parentId] });
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setLinkForm({ studentId: "", relation: "father" });
      toast.success("Student linked to parent");
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error || error?.message || "Failed to link student";
      toast.error(msg);
    },
  });

  const unlinkStudentMutation = useMutation({
    mutationFn: async (studentId: string) => api.delete(`/users/${parentId}/children/${studentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent", parentId] });
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student unlinked from parent");
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error || "Failed to unlink student";
      toast.error(msg);
    },
  });

  if (isLoading) return <PageLoader />;

  if (isError || !parent) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/parents">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Parents
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Parent account not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/parents">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Parents
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserRound className="h-6 w-6" /> {parent.full_name}
            </h1>
            <Badge variant={parent.is_active ? "success" : "destructive"}>
              {parent.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-muted-foreground">Manage profile, security, and linked children from one place.</p>
        </div>

        <Button
          variant={parent.is_active ? "destructive" : "default"}
          onClick={() => toggleStatusMutation.mutate()}
          disabled={toggleStatusMutation.isPending}
        >
          {toggleStatusMutation.isPending
            ? "Updating..."
            : parent.is_active
              ? "Deactivate Parent"
              : "Activate Parent"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={profileForm.full_name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!profileForm.full_name.trim() || !profileForm.phone.trim()) {
                  toast.error("Full name and phone are required");
                  return;
                }
                updateProfileMutation.mutate();
              }}
              disabled={updateProfileMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Login ID</p>
              <p className="font-medium break-all">{parent.login_id || parent.email || parent.phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Default Password Hint</p>
              <p className="font-mono text-sm bg-muted rounded px-2 py-1 inline-block break-all">
                {parent.default_password_hint || "Custom"}
              </p>
            </div>

            <div className="pt-2 border-t space-y-2">
              <Label>Reset Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (newPassword.length < 8) {
                    toast.error("Password must be at least 8 characters");
                    return;
                  }
                  resetPasswordMutation.mutate();
                }}
                disabled={resetPasswordMutation.isPending}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Link Student</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select
                value={linkForm.studentId}
                onValueChange={(value) => setLinkForm((prev) => ({ ...prev, studentId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {availableStudents.map((student) => {
                    const studentName = student.full_name || `${student.first_name || ""} ${student.last_name || ""}`.trim();
                    const meta = [student.class_name, student.section_name].filter(Boolean).join(" • ");
                    return (
                      <SelectItem key={student.id} value={student.id}>
                        {studentName || "Unnamed student"}
                        {meta ? ` (${meta})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Relation</Label>
              <Select
                value={linkForm.relation}
                onValueChange={(value) => setLinkForm((prev) => ({ ...prev, relation: value }))}
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
          </div>

          <Button
            onClick={() => linkStudentMutation.mutate()}
            disabled={linkStudentMutation.isPending || !linkForm.studentId}
          >
            <Link2 className="h-4 w-4 mr-2" />
            {linkStudentMutation.isPending ? "Linking..." : "Link Student"}
          </Button>

          {availableStudents.length === 0 && (
            <p className="text-sm text-muted-foreground">All students are already linked to this parent.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked Children ({parent.children_count || (parent.children || []).length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {(parent.children || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked children yet.</p>
          ) : (
            <div className="space-y-3">
              {(parent.children || []).map((child) => (
                <div key={child.id} className="border rounded-md p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-medium">{child.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {child.class_name || "Class -"}
                      {child.section_name ? ` • ${child.section_name}` : ""}
                      {child.student_id ? ` • ${child.student_id}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/students/${child.id}`}>
                        <ShieldCheck className="h-4 w-4 mr-2" /> View Student
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={unlinkStudentMutation.isPending}
                      onClick={() => {
                        if (confirm(`Unlink ${child.name} from this parent?`)) {
                          unlinkStudentMutation.mutate(child.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Unlink
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
