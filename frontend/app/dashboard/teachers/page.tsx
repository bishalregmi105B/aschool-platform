"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTeacher,
  deleteTeacher,
  fetchTeachers,
  toggleTeacherActive,
  type TeacherDto,
  updateTeacher,
} from "@/lib/services/dashboard/teachers.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  StatGrid,
  KpiCard,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Plus, UserCog, Mail, Phone, Upload, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

type Teacher = TeacherDto;

export default function TeachersPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Teacher | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["teachers"],
    queryFn: fetchTeachers,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createTeacher(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher added successfully");
      setShowAdd(false);
    },
    onError: () => toast.error("Failed to add teacher"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateTeacher(editItem?.id || "", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher updated successfully");
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update teacher"),
  });

  const deleteMutation = useMutation({
    mutationFn: (teacherId: string) => deleteTeacher(teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher deleted successfully");
    },
    onError: () => toast.error("Failed to delete teacher"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (teacherId: string) => toggleTeacherActive(teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher status updated");
    },
    onError: () => toast.error("Failed to update teacher status"),
  });

  const teachers = (data || []).filter((t: Teacher) =>
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search)
  );

  const stats = {
    total: (data || []).length,
    active: (data || []).filter((t: Teacher) => t.is_active).length,
    inactive: (data || []).filter((t: Teacher) => !t.is_active).length,
    classSections: new Set(
      (data || []).flatMap((t: Teacher) => t.class_sections || []),
    ).size,
  };

  if (isLoading) return <AOSModuleLoadingState label="Loading teachers…" />;

  if (isError)
    return (
      <AOSPage>
        <AOSPageHeader title="Teachers" subtitle="Manage school teaching staff" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>
                Failed to load teachers. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );

  const TEACHER_COLUMNS: Column<Teacher>[] = [
    { key: "full_name", label: "Name", sortable: true, value: (t) => t.full_name ?? "", render: (t) => <span className="font-medium">{t.full_name}</span> },
    {
      key: "contact",
      label: "Contact",
      value: (t) => t.phone ?? t.email ?? "",
      render: (t) => (
        <div className="space-y-1">
          {t.phone && (
            <div className="flex items-center gap-1 text-sm">
              <Phone className="h-3 w-3" /> {t.phone}
            </div>
          )}
          {t.email && (
            <div className="flex items-center gap-1 text-sm" style={{ color: "var(--w11-text-secondary)" }}>
              <Mail className="h-3 w-3" /> {t.email}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "subjects",
      label: "Subjects",
      value: (t) => (t.subjects || []).join(", "),
      render: (t) => (
        <div className="flex flex-wrap gap-1">
          {(t.subjects || []).map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
          ))}
          {(!t.subjects || t.subjects.length === 0) && (
            <span className="text-sm" style={{ color: "var(--w11-text-tertiary)" }}>—</span>
          )}
        </div>
      ),
    },
    {
      key: "class_sections",
      label: "Class Sections",
      value: (t) => (t.class_sections || []).join(", "),
      render: (t) => (
        <div className="flex flex-wrap gap-1">
          {(t.class_sections || []).map((section) => (
            <StatusChip key={section} status="user" label={section} />
          ))}
          {(!t.class_sections || t.class_sections.length === 0) && (
            <span className="text-sm" style={{ color: "var(--w11-text-tertiary)" }}>—</span>
          )}
        </div>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      value: (t) => (t.is_active ? "active" : "inactive"),
      render: (t) => (
        <StatusChip status={t.is_active ? "active" : "inactive"} label={t.is_active ? "Active" : "Inactive"} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (t) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditItem(t); }}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); toggleActiveMutation.mutate(t.id); }}
            disabled={toggleActiveMutation.isPending}
          >
            {t.is_active ? "Disable" : "Enable"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#c42b1c]"
            onClick={(e) => {
              e.stopPropagation();
              void (async () => {
                const ok = await confirm({
                  title: `Delete teacher "${t.full_name}"?`,
                  body: "Their classes keep running — reassign a class teacher afterwards.",
                  confirmLabel: "Delete teacher",
                  tone: "danger",
                });
                if (ok) {
                  deleteMutation.mutate(t.id);
                }
              })();
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<UserCog className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Teachers"
        subtitle={`${stats.total} teachers · ${stats.active} active · Manage school teaching staff`}
        actions={
          <>
            <Link href="/dashboard/teachers/bulk-upload">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" /> Bulk Upload
              </Button>
            </Link>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Teacher
            </Button>
          </>
        }
      />
      <AOSPageBody>
        <StatGrid min={170}>
          <KpiCard label="Total Teachers" value={stats.total} />
          <KpiCard label="Active" value={stats.active} denominator={`/ ${stats.total}`} color="#107c10" />
          <KpiCard label="Inactive" value={stats.inactive} color="#d83b01" />
          <KpiCard label="Class Sections" value={stats.classSections} color="var(--w11-accent)" />
        </StatGrid>

        <DataPanel bodyClassName="p-0">
          <DataTable<Teacher>
            columns={TEACHER_COLUMNS}
            rows={teachers}
            rowKey={(t) => t.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name, email, or phone..."
            exportFileName="teachers"
            empty={{ icon: UserCog, title: "No teachers found", body: "Add teachers or bulk-upload your staff list.", action: { label: "Add Teacher", onClick: () => setShowAdd(true) } }}
          />
        </DataPanel>

        {/* Add Teacher Dialog */}
        <Dialog
          open={showAdd || !!editItem}
          onOpenChange={(open) => {
            if (!open) {
              setShowAdd(false);
              setEditItem(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? "Edit Teacher" : "Add Teacher"}</DialogTitle>
            </DialogHeader>
            <form
              key={editItem?.id || "new-teacher"}
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload = {
                  full_name: fd.get("full_name"),
                  email: fd.get("email") || undefined,
                  phone: fd.get("phone"),
                  is_active: fd.get("is_active") === "on",
                  password: fd.get("password") || undefined,
                };

                if (editItem) {
                  updateMutation.mutate(payload);
                } else {
                  createMutation.mutate(payload);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input name="full_name" required defaultValue={editItem?.full_name} placeholder="Teacher full name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input name="phone" required defaultValue={editItem?.phone} placeholder="+977..." />
                </div>
                <div className="space-y-2">
                  <Label>Email (optional)</Label>
                  <Input name="email" type="email" defaultValue={editItem?.email} placeholder="teacher@school.edu.np" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{editItem ? "Update Password" : "Password"}</Label>
                <Input
                  name="password"
                  type="password"
                  required={!editItem}
                  placeholder={editItem ? "Leave blank to keep current password" : "Initial password"}
                />
              </div>
              <FormCheckbox
                label="Active teacher account"
                name="is_active"
                defaultChecked={editItem ? editItem.is_active : true}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Spinner size="sm" /> : editItem ? "Save Changes" : "Add Teacher"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
