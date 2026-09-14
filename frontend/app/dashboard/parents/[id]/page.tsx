"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAOSPathParam } from "@/lib/aos-window-route";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AOSModuleLoadingState, AOSPage, AOSPageHeader, AOSPageBody, DataPanel, FormSection, StatusChip } from "@/components/aos/kit/page-kit";
import { ObjectHeader } from "@/components/aos/kit/detail-kit";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  ArrowLeft,
  KeyRound,
  Link2,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

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
  full_name?: string;
  first_name?: string;
  last_name?: string;
  class_name?: string;
  section_name?: string;
}

export default function ParentDetailPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const params = useParams();
  const parentId = useAOSPathParam(2) || (Array.isArray(params.id) ? params.id[0] : (params.id as string));
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

  if (isLoading) return <AOSModuleLoadingState label="Loading parent account…" />;

  if (isError || !parent) {
    return (
      <AOSPage>
        <AOSPageHeader title="Parent" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>Parent account not found.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/parents">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Parents
                </Link>
              </Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const childrenList = parent.children || [];

  return (
    <AOSPage>
      <AOSPageHeader
        title="Parent Account"
        subtitle={t("Manage profile, security, and linked children", "प्रोफाइल, सुरक्षा र छोराछोरी")}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/parents">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Parents
            </Link>
          </Button>
        }
      />
      <AOSPageBody>
        <ObjectHeader
          className="mb-4"
          name={parent.full_name}
          code={parent.login_id || parent.email || parent.phone}
          codeLabel={t("Login", "लगइन")}
          status={parent.is_active ? "active" : "inactive"}
          meta={
            <span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
              {childrenList.length} {t("linked children", "जोडिएका सन्तान")}
            </span>
          }
          actions={
            <Button
              variant={parent.is_active ? "destructive" : "default"}
              size="sm"
              onClick={() => toggleStatusMutation.mutate()}
              disabled={toggleStatusMutation.isPending}
            >
              {parent.is_active ? "Deactivate" : "Activate"}
            </Button>
          }
        />

        <Tabs defaultValue="children">
          <TabsList>
            <TabsTrigger value="children" badge={childrenList.length}>{t("Children", "सन्तानहरू")}</TabsTrigger>
            <TabsTrigger value="profile">{t("Profile & access", "प्रोफाइल")}</TabsTrigger>
            <TabsTrigger value="link">{t("Link student", "विद्यार्थी जोड्ने")}</TabsTrigger>
          </TabsList>

          {/* ── Children ── */}
          <TabsContent value="children">
            {childrenList.length === 0 ? (
              <DataPanel>
                <p className="text-sm text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>
                  No linked children yet — use “Link student” to add one.
                </p>
              </DataPanel>
            ) : (
              <ul className="win11-listview">
                {childrenList.map((child) => (
                  <li key={child.id}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">{child.name}</div>
                      <div className="text-[11px] truncate" style={{ color: "var(--w11-text-tertiary)" }}>
                        {[child.class_name || "Class —", child.section_name, child.student_id].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/students/${child.id}`}>
                        <ShieldCheck className="h-4 w-4 mr-1" /> View
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={unlinkStudentMutation.isPending}
                      onClick={() => {
                        confirm({
                          title: "Unlink child",
                          body: `Unlink ${child.name} from this parent? The student keeps their own record.`,
                          tone: "danger",
                          confirmLabel: "Unlink",
                        }).then((ok) => {
                          if (ok) unlinkStudentMutation.mutate(child.id);
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Unlink
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* ── Profile & access ── */}
          <TabsContent value="profile" className="grid gap-4 lg:grid-cols-2">
            <FormSection title={t("Profile", "प्रोफाइल")}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("Full name", "पूरा नाम")}</Label>
                  <Input value={profileForm.full_name} onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t("Phone", "फोन")}</Label>
                  <Input value={profileForm.phone} onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t("Email (optional)", "इमेल (वैकल्पिक)")}</Label>
                  <Input type="email" value={profileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))} />
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
              </div>
            </FormSection>

            <FormSection title={t("Account access", "खाता पहुँच")}>
              <div className="space-y-4">
                <div>
                  <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{t("Login ID", "लगइन आईडी")}</p>
                  <p className="font-medium break-all">{parent.login_id || parent.email || parent.phone}</p>
                </div>
                <div className="pt-2 border-t space-y-2">
                  <Label>{t("Reset password", "पासवर्ड रिसेट")}</Label>
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
                      void (async () => {
                        const ok = await confirm({
                          title: `Reset ${parent.full_name}'s password?`,
                          body: "They will need the new password at next sign-in on web and mobile.",
                          tone: "danger",
                          confirmLabel: "Reset password",
                        });
                        if (ok) resetPasswordMutation.mutate();
                      })();
                    }}
                    disabled={resetPasswordMutation.isPending}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                  </Button>
                </div>
              </div>
            </FormSection>
          </TabsContent>

          {/* ── Link student ── */}
          <TabsContent value="link">
            <FormSection title={t("Link a student to this parent", "यो अभिभावकसँग विद्यार्थी जोड्ने")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("Student", "विद्यार्थी")}</Label>
                  <AdvancedSelect
                    value={linkForm.studentId}
                    onChange={(v) => setLinkForm((prev) => ({ ...prev, studentId: v }))}
                    searchable
                    clearable
                    placeholder={availableStudents.length ? "Search student…" : "All students already linked"}
                    options={availableStudents.map((student) => {
                      const studentName = student.full_name || `${student.first_name || ""} ${student.last_name || ""}`.trim();
                      const meta = [student.class_name, student.section_name].filter(Boolean).join(" • ");
                      return { value: student.id, label: studentName || "Unnamed student", ne: meta || undefined };
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Relation", "नाता")}</Label>
                  <AdvancedSelect
                    value={linkForm.relation}
                    onChange={(v) => setLinkForm((prev) => ({ ...prev, relation: v }))}
                    options={[
                      { value: "father", label: "Father" },
                      { value: "mother", label: "Mother" },
                      { value: "guardian", label: "Guardian" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </div>
              </div>
              <Button
                className="mt-4"
                onClick={() => linkStudentMutation.mutate()}
                disabled={linkStudentMutation.isPending || !linkForm.studentId}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {linkStudentMutation.isPending ? "Linking..." : "Link Student"}
              </Button>
            </FormSection>
          </TabsContent>
        </Tabs>
      </AOSPageBody>
    </AOSPage>
  );
}
