"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAOSRouterNavigate } from "@/lib/aos-window-route";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Avatar } from "@/components/ui/avatar";
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
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, type Column, type BulkAction } from "@/components/ui/data-table";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatGrid,
  KpiCard,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  Plus,
  Trash2,
  Pencil,
  Upload,
  ImagePlus,
  Users,
  UserCheck,
  BookOpen,
  Layers,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { ICON_MAP } from "@/lib/icon-map";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";

/** Module dashboard quick links — mirrors the students plugin manifest
 * (backend/app/plugins/manifests/students.yaml ui.nav.subitems). */
const QUICK_LINKS: Array<{ label: string; href: string; icon: string }> = [
  { label: "Add Student", href: "/dashboard/students/new", icon: "UserPlus" },
  { label: "Bulk Import", href: "/dashboard/students/bulk-import", icon: "Upload" },
  { label: "Parents & Guardians", href: "/dashboard/parents", icon: "Users" },
  { label: "Admission Inquiries", href: "/dashboard/admission", icon: "ClipboardList" },
  { label: "Assign Roll Numbers", href: "/dashboard/students/roll-numbers", icon: "ListOrdered" },
  { label: "Upload Profile Images", href: "/dashboard/students/profile-images", icon: "ImagePlus" },
  { label: "Transfer Student", href: "/dashboard/students/transfers", icon: "ArrowRightLeft" },
  { label: "Promote Students", href: "/dashboard/students/promote", icon: "TrendingUp" },
  { label: "Reset Password", href: "/dashboard/students/reset-password", icon: "KeyRound" },
];

const GRADES = [
  "ECD",
  "KG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  transferred_in: "Transferred In",
  transferred_out: "Transferred Out",
  dropped_out: "Dropped Out",
  graduated: "Graduated",
  on_leave: "On Leave",
};

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  enrollment_number: string;
  class_id?: string;
  section_id?: string;
  gender: string;
  status: string;
  dob_bs?: string;
  blood_group?: string;
  phone?: string;
  email?: string;
  photo_url?: string | null;
  class_name?: string;
  section_name?: string;
  guardians?: Array<{
    id: string;
    full_name: string;
    phone: string;
    relationship: string;
  }>;
}

interface StudentListResponse {
  items: Student[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export default function StudentsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterClassId, setFilterClassId] = useState("all");
  const [filterSectionId, setFilterSectionId] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  // Row drill-in drawer — replaces full-page navigation for a quick look.
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const router = useAOSRouterNavigate();

  // Fetch classes for proper class/section filter
  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const r = await api.get("/academics/classes");
      return r.data?.data || [];
    },
  });
  const classes: Array<{
    id: string;
    name: string;
    sections?: Array<{ id: string; name: string }>;
  }> = classesData || [];
  const selectedClass = classes.find((c) => c.id === filterClassId);
  const sections = selectedClass?.sections || [];

  // Cheap count queries for the KPI row — per_page=1 so only the pagination
  // totals are read, never the rows.
  const { data: totalCount } = useQuery({
    queryKey: ["students", "count"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/students?per_page=1");
      return res.data?.meta?.pagination?.total as number | undefined;
    },
  });
  const { data: activeCount } = useQuery({
    queryKey: ["students", "count", "active"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/students?per_page=1&status=active");
      return res.data?.meta?.pagination?.total as number | undefined;
    },
  });

  const {
    data,
    isLoading,
    isError: listError,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: [
      "students",
      page,
      search,
      filterGender,
      filterStatus,
      filterGrade,
      filterClassId,
      filterSectionId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(pageSize),
      });
      if (search) params.set("search", search);
      if (filterGender !== "all") params.set("gender", filterGender);
      if (filterStatus !== "all") params.set("status", filterStatus);
      // Prefer class_id over grade
      if (filterClassId !== "all") {
        params.set("class_id", filterClassId);
        if (filterSectionId !== "all")
          params.set("section_id", filterSectionId);
      } else if (filterGrade !== "all") {
        params.set("grade", filterGrade);
      }
      const res = await api.get<ApiResponse<StudentListResponse>>(
        `/students?${params}`,
      );
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/students/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student deleted");
    },
    onError: () => toast.error("Failed to delete student"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post("/students/bulk-delete", { ids }),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setSelected(new Set());
      toast.success(`${ids.length} student(s) deleted`);
    },
    onError: () => toast.error("Bulk delete failed"),
  });

  const students = Array.isArray(data?.data) ? data.data : [];
  const pagination = data?.meta?.pagination;

  const allSelected =
    students.length > 0 && students.every((s) => selected.has(s.id));
  const someSelected = selected.size > 0;
  const hasFilters =
    filterGender !== "all" || filterStatus !== "all" || filterGrade !== "all";

  function clearFilters() {
    setFilterGender("all");
    setFilterStatus("all");
    setFilterGrade("all");
    setPage(1);
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(students.map((s) => s.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ok = await confirm({
      title: `Delete ${selected.size} selected student(s)?`,
      body: "This cannot be undone — their login and guardian links are removed too.",
      confirmLabel: "Delete students",
      tone: "danger",
    });
    if (!ok) return;
    bulkDeleteMutation.mutate(Array.from(selected));
  }

  if (isLoading) return <AOSModuleLoadingState label="Loading students…" />;

  if (listError)
    return (
      <AOSPage>
        <AOSPageHeader title="Students" subtitle={`${pagination?.total || 0} students enrolled`} />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>
                Failed to load students. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchStudents()}>
                Retry
              </Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );

  // ── DataTable wiring ──────────────────────────────────────────────────
  const COLUMNS: Column<Student>[] = [
    {
      key: "student",
      label: "Student",
      sortable: true,
      value: (s) => `${s.first_name} ${s.last_name}`,
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar
            src={s.photo_url}
            name={`${s.first_name} ${s.last_name}`}
            size="sm"
          />
          <span className="font-medium">
            {s.first_name} {s.last_name}
          </span>
        </div>
      ),
    },
    { key: "enrollment_number", label: "Enrollment No.", sortable: true, value: (s) => s.enrollment_number },
    {
      key: "class_name",
      label: "Class",
      sortable: true,
      value: (s) => s.class_name ?? "",
      render: (s) =>
        // E204: class names can already carry the "Class " prefix (legacy
        // rows store "Class 10") — strip before prepending.
        s.class_name
          ? `Class ${s.class_name.replace(/^\s*class\s+/i, "")}${s.section_name ? ` - ${s.section_name}` : ""}`
          : "-",
    },
    { key: "gender", label: "Gender", sortable: true, value: (s) => s.gender ?? "", render: (s) => <span className="capitalize">{s.gender || "-"}</span> },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (s) => s.status,
      render: (s) => (
        <StatusChip status={s.status} label={STATUS_LABELS[s.status] ?? s.status} />
      ),
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (s) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditStudent(s)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#c42b1c]"
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: "Delete this student?",
                  body: "Their login and guardian links are removed. This cannot be undone.",
                  confirmLabel: "Delete student",
                  tone: "danger",
                });
                if (ok) deleteMutation.mutate(s.id);
              })();
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const BULK_ACTIONS: BulkAction<Student>[] = [
    {
      key: "delete",
      label: "Delete selected",
      tone: "danger",
      onClick: (rows) => {
        setSelected(new Set(rows.map((r) => r.id)));
        void handleBulkDelete();
      },
    },
    {
      key: "promote",
      label: "Promote…",
      onClick: () => router("/dashboard/students/promote"),
    },
    {
      key: "reset-pw",
      label: "Reset passwords…",
      onClick: () => router("/dashboard/students/reset-password"),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Students"
        subtitle={`${pagination?.total || 0} students enrolled`}
        actions={
          <Button onClick={() => router("/dashboard/students/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
        }
      />
      <AOSPageBody>
        {/* Module dashboard — KPIs + quick links before the list */}
        <StatGrid min={170}>
          <KpiCard
            label="Total Students"
            value={totalCount ?? "—"}
            icon={<Users className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Active"
            value={activeCount ?? "—"}
            denominator={totalCount != null ? `/ ${totalCount}` : undefined}
            color="#107c10"
            icon={<UserCheck className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label="Classes"
            value={classes.length}
            icon={<BookOpen className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            color="var(--w11-text-primary)"
          />
          <KpiCard
            label="Sections"
            value={classes.reduce((sum, c) => sum + (c.sections?.length ?? 0), 0)}
            icon={<Layers className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            color="var(--w11-text-primary)"
          />
        </StatGrid>

        <DataPanel title="Students Quick Links" bodyClassName="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {QUICK_LINKS.map((l) => {
              const Icon = ICON_MAP[l.icon] ?? ChevronRight;
              return (
                <Link key={l.href} href={l.href} className="block h-full">
                  <div
                    className="win11-card flex items-center gap-3 p-3 h-full transition-colors hover:border-[var(--w11-accent)]"
                    style={{ cursor: "pointer", margin: 0 }}
                  >
                    <div
                      className="flex items-center justify-center text-white shrink-0"
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        background: SECTION_GRADIENTS.Core,
                        boxShadow: "0 8px 16px -4px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.35)",
                      }}
                    >
                      <Icon size={22} strokeWidth={2.2} />
                    </div>
                    <span
                      className="text-[13px] font-semibold leading-tight"
                      style={{ color: "var(--w11-text-primary)" }}
                    >
                      {l.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </DataPanel>

        {/* Students table — one component for selection, sort, pagination,
            export; row click opens the detail drawer (no full-page hop). */}
        <DataPanel bodyClassName="p-0">
          <DataTable<Student>
            columns={COLUMNS}
            rows={students}
            rowKey={(s) => s.id}
            loading={false}
            searchable
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="Search by name or enrollment number..."
            selectable
            bulkActions={BULK_ACTIONS}
            onRowClick={(s) => setViewStudent(s)}
            activeRowKey={viewStudent?.id ?? null}
            pagination={pagination ? {
              page: pagination.page,
              pages: pagination.pages,
              total: pagination.total,
              per_page: pagination.per_page,
              has_next: pagination.has_next ?? pagination.page < pagination.pages,
              has_prev: pagination.has_prev ?? pagination.page > 1,
            } : undefined}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            exportFileName="students"
            empty={{
              icon: Users,
              title: "No students found",
              body: hasFilters ? "Try clearing the filters — or enroll your first student." : "Enroll your first student to get started.",
              action: { label: "Add Student", href: "/dashboard/students/new" },
            }}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <AdvancedSelect
                  className="w-36"
                  value={filterClassId}
                  onChange={(v) => {
                    setFilterClassId(v || "all");
                    setFilterSectionId("all");
                    setFilterGrade("all");
                    setPage(1);
                  }}
                  clearable
                  placeholder="All Classes"
                  options={classes.map((c) => ({ value: c.id, label: c.name }))}
                />
                {filterClassId !== "all" && sections.length > 0 && (
                  <AdvancedSelect
                    className="w-32"
                    value={filterSectionId}
                    onChange={(v) => {
                      setFilterSectionId(v || "all");
                      setPage(1);
                    }}
                    clearable
                    placeholder="All Sections"
                    options={sections.map((sec) => ({ value: sec.id, label: sec.name }))}
                  />
                )}
                <AdvancedSelect
                  className="w-32"
                  value={filterGender}
                  onChange={(v) => {
                    setFilterGender(v || "all");
                    setPage(1);
                  }}
                  clearable
                  placeholder="All Genders"
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ]}
                />
                <AdvancedSelect
                  className="w-36"
                  value={filterStatus}
                  onChange={(v) => {
                    setFilterStatus(v || "all");
                    setPage(1);
                  }}
                  clearable
                  placeholder="All Statuses"
                  options={Object.entries(STATUS_LABELS).map(([val, label]) => ({ value: val, label }))}
                />
                <Button variant="outline" size="sm" onClick={() => router("/dashboard/students/bulk-import")}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Import
                </Button>
                <Button variant="outline" size="sm" onClick={() => router("/dashboard/students/profile-images")}>
                  <ImagePlus className="h-3.5 w-3.5 mr-1" /> Photos
                </Button>
                <Button onClick={() => router("/dashboard/students/new")}>
                  <Plus className="h-4 w-4 mr-1" /> Add Student
                </Button>
              </div>
            }
          />
        </DataPanel>

        {/* Detail drawer — the quick view without leaving the list */}
        <Sheet open={!!viewStudent} onOpenChange={(open) => !open && setViewStudent(null)}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <div className="border-b border-[color:var(--w11-border-subtle)] px-4 py-3">
              <SheetTitle className="text-[15px] font-semibold">Student Details</SheetTitle>
            </div>
            {viewStudent && (
              <div className="space-y-5 px-4 pb-6">
                <div className="flex items-center gap-4">
                  <Avatar
                    src={viewStudent.photo_url}
                    name={`${viewStudent.first_name} ${viewStudent.last_name}`}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="text-base font-semibold truncate">
                      {viewStudent.first_name} {viewStudent.last_name}
                    </p>
                    <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                      {viewStudent.enrollment_number || "No enrollment no."}
                    </p>
                    <StatusChip
                      status={viewStudent.status}
                      label={STATUS_LABELS[viewStudent.status] ?? viewStudent.status}
                      className="mt-1"
                    />
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                  {[
                    ["Class", viewStudent.class_name ? `Class ${viewStudent.class_name.replace(/^\s*class\s+/i, "")}${viewStudent.section_name ? ` - ${viewStudent.section_name}` : ""}` : "—"],
                    ["Gender", viewStudent.gender ? viewStudent.gender.charAt(0).toUpperCase() + viewStudent.gender.slice(1) : "—"],
                    ["Guardian", viewStudent.guardians?.[0]?.full_name || "—"],
                    ["Guardian Phone", viewStudent.guardians?.[0]?.phone || "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt
                        className="text-[10px] font-medium uppercase tracking-wide"
                        style={{ color: "var(--w11-text-secondary)" }}
                      >
                        {k}
                      </dt>
                      <dd className="mt-0.5 font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex gap-2 border-t border-[color:var(--w11-border-subtle)] pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setEditStudent(viewStudent);
                      setViewStudent(null);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => router(`/dashboard/students/${viewStudent.id}`)}
                  >
                    Full Profile
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c42b1c]"
                    onClick={() => {
                      const target = viewStudent;
                      setViewStudent(null);
                      void (async () => {
                        const ok = await confirm({
                          title: "Delete this student?",
                          body: "Their login and guardian links are removed. This cannot be undone.",
                          confirmLabel: "Delete student",
                          tone: "danger",
                        });
                        if (ok) deleteMutation.mutate(target.id);
                      })();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <AddStudentDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
        {editStudent && (
          <EditStudentDialog
            student={editStudent}
            onOpenChange={(open) => {
              if (!open) setEditStudent(null);
            }}
          />
        )}
      </AOSPageBody>
    </AOSPage>
  );
}

function AddStudentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedRelation, setSelectedRelation] = useState("father");
  const [selectedRelation2, setSelectedRelation2] = useState("mother");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const selectedClass = (classes || []).find(
    (c: any) => c.id === selectedClassId,
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const guardians = [];
    const guardianName = formData.get("guardian_name")?.toString().trim();
    const guardianPhone = formData.get("guardian_phone")?.toString().trim();
    const guardian2Name = formData.get("guardian2_name")?.toString().trim();
    const guardian2Phone = formData.get("guardian2_phone")?.toString().trim();

    if (guardianName || guardianPhone) {
      guardians.push({
        full_name: guardianName,
        phone: guardianPhone,
        relation: selectedRelation,
      });
    }
    if (guardian2Name || guardian2Phone) {
      guardians.push({
        full_name: guardian2Name,
        phone: guardian2Phone,
        relation: selectedRelation2,
      });
    }

    const payload: any = {
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
      student_id: formData.get("enrollment_number"),
      class_id: selectedClassId || undefined,
      section_id: selectedSectionId || undefined,
      roll_number: formData.get("roll_number")
        ? parseInt(formData.get("roll_number") as string)
        : undefined,
      gender: selectedGender || undefined,
      dob_bs: formData.get("dob_bs") || undefined,
      guardians,
      password: formData.get("password") || undefined,
    };
    try {
      await api.post("/students", payload);
      toast.success("Student added successfully");
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
    } catch {
      toast.error("Failed to add student");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[60vh] overflow-y-auto pr-1"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input id="first_name" name="first_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input id="last_name" name="last_name" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select
                value={selectedClassId}
                onValueChange={(v) => {
                  setSelectedClassId(v);
                  setSelectedSectionId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {(classes || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={selectedSectionId}
                onValueChange={setSelectedSectionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedClass?.sections || []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="enrollment_number">Student ID</Label>
              <Input id="enrollment_number" name="enrollment_number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll_number">Roll No.</Label>
              <Input id="roll_number" name="roll_number" type="number" />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={selectedGender} onValueChange={setSelectedGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Login Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Leave empty for auto-generation"
              />
              <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                Default: {"{class}{section}{roll}.{first}"} (e.g. 7a12.ram)
              </p>
            </div>
          </div>
          <div className="space-y-4 pt-4 border-t border-[color:var(--w11-border-subtle)]">
            <Label htmlFor="dob_bs">Date of Birth (BS)</Label>
            <BSDateInput name="dob_bs" emit="bs" />
          </div>
          <div className="border-t border-[color:var(--w11-border-subtle)] pt-4">
            <p className="text-sm font-medium mb-3">Guardian Information</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardian_name">Guardian Name *</Label>
                <Input id="guardian_name" name="guardian_name" required />
                <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                  Creates the parent login
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian_phone">Phone</Label>
                <Input
                  id="guardian_phone"
                  name="guardian_phone"
                  placeholder="98XXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Relation</Label>
                <Select
                  value={selectedRelation}
                  onValueChange={setSelectedRelation}
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

            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="space-y-2">
                <Label htmlFor="guardian2_name">
                  Second Guardian Name (Optional)
                </Label>
                <Input id="guardian2_name" name="guardian2_name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian2_phone">Phone</Label>
                <Input
                  id="guardian2_phone"
                  name="guardian2_phone"
                  placeholder="98XXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Relation</Label>
                <Select
                  value={selectedRelation2}
                  onValueChange={setSelectedRelation2}
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
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !selectedClassId}>
              {saving ? <Spinner size="sm" /> : "Add Student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditStudentDialog({
  student,
  onOpenChange,
}: {
  student: Student;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState(student.first_name);
  const [lastName, setLastName] = useState(student.last_name);
  const [gender, setGender] = useState(student.gender || "unknown");
  const [status, setStatus] = useState(student.status || "active");
  const [classId, setClassId] = useState(student.class_id || "none");
  const [sectionId, setSectionId] = useState(student.section_id || "none");
  const [phone, setPhone] = useState(student.phone || "");
  const [email, setEmail] = useState(student.email || "");
  const [dobBs, setDobBs] = useState(student.dob_bs || "");
  const [bloodGroup, setBloodGroup] = useState(student.blood_group || "");
  const [password, setPassword] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const selectedClass = (classes || []).find((c: any) => c.id === classId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/students/${student.id}`, {
        first_name: firstName,
        last_name: lastName,
        gender: gender === "unknown" ? null : gender,
        status,
        class_id: classId === "none" ? null : classId,
        section_id: sectionId === "none" ? null : sectionId,
        phone: phone || null,
        email: email || null,
        dob_bs: dobBs || null,
        blood_group: bloodGroup || null,
        password: password || undefined,
      });
      toast.success("Student updated");
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", student.id] });
      onOpenChange(false);
    } catch {
      toast.error("Failed to update student");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class / Grade</Label>
              <Select
                value={classId}
                onValueChange={(value) => {
                  setClassId(value);
                  setSectionId("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {(classes || []).map((klass: any) => (
                    <SelectItem key={klass.id} value={klass.id}>
                      {klass.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {(selectedClass?.sections || []).map((section: any) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Not specified</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98XXXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@email.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date of Birth (BS)</Label>
              <BSDateInput
                value={dobBs}
                onChange={(v) => setDobBs(v)}
                emit="bs"
              />
            </div>
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Input
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                placeholder="e.g. A+"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_password">Update Password</Label>
            <Input
              id="edit_password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
