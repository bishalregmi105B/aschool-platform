"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import {
  assignSubjectToClass,
  createAcademicYear,
  createClass,
  createSection,
  createSubject,
  deleteAcademicYear,
  deleteClass,
  deleteSection,
  deleteSubject,
  fetchAcademicYears,
  fetchClasses,
  fetchSubjects,
  updateAcademicYear,
  updateClass,
  updateSection,
  updateSubject,
} from "@/lib/services/dashboard/academics.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { displayBS } from "@/lib/nepali_date";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FormSection,
} from "@/components/aos/kit/page-kit";
import {
  BookMarked,
  BookOpen,
  Link2,
  Pencil,
  Plus,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";

type AcademicsTab = "years" | "classes" | "subjects";

interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface SectionItem {
  id: string;
  name: string;
  capacity: number | null;
  class_teacher_id?: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  name_nepali?: string;
  numeric_grade: number | null;
  sections: SectionItem[];
}

interface Subject {
  id: string;
  name: string;
  name_nepali?: string;
  code: string;
  credit_hours: number;
  is_optional: boolean;
  full_marks?: number | null;
  pass_marks?: number | null;
  has_practical?: boolean;
  practical_full_marks?: number | null;
  practical_pass_marks?: number | null;
}

const ACADEMIC_TOOLS = [
  {
    href: "/dashboard/academics/class-subjects",
    label: "Class Subjects",
    description: "Map subjects to classes without leaving academics.",
    icon: Link2,
  },
  {
    href: "/dashboard/academics/class-teachers",
    label: "Teacher Assignments",
    description: "Assign class teachers and subject teachers from one place.",
    icon: UserCog,
  },
] as const;

function getDefaultTab(pathname: string): AcademicsTab {
  if (pathname.includes("class-sections") || pathname.includes("class-teachers")) {
    return "classes";
  }
  if (pathname.includes("class-subjects") || pathname.endsWith("/subjects")) {
    return "subjects";
  }
  return "years";
}

function getDateInputValue(value?: string | null) {
  if (!value) return "";
  const trimmed = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function RowActions({
  onEdit,
  onDelete,
  deleteLabel,
  deleting = false,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel: string;
  deleting?: boolean;
}) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit item">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={deleting}
          onClick={() => setShowDelete(true)}
          aria-label="Delete item"
        >
          <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
        </Button>
      </div>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-sm text-[color:var(--w11-text-secondary)]">{deleteLabel}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete();
                setShowDelete(false);
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AcademicsPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<AcademicsTab>(() => getDefaultTab(pathname));

  useEffect(() => {
    setTab(getDefaultTab(pathname));
  }, [pathname]);

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Academics"
        subtitle="Manage academic years, classes, sections, subjects, and assignments"
      />
      <AOSPageBody>
        {/* Fluent pivot tabs */}
        <div className="flex gap-1 mb-4 border-b border-[var(--w11-border-subtle)]">
          {[
            { key: "years" as const, label: "Academic Years", icon: BookOpen },
            { key: "classes" as const, label: "Classes & Sections", icon: Users },
            { key: "subjects" as const, label: "Subjects", icon: BookMarked },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                tab === item.key
                  ? "border-[var(--w11-accent)] text-[color:var(--w11-text-primary)]"
                  : "border-transparent text-[color:var(--w11-text-secondary)] hover:text-[color:var(--w11-text-primary)]"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 mb-4 md:grid-cols-2">
          {ACADEMIC_TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href} className="group">
              <div className="win11-card flex items-start gap-3 p-4 transition-colors hover:border-[var(--w11-accent)]">
                <div
                  className="rounded-[var(--w11-radius-md)] p-2"
                  style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}
                >
                  <tool.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold group-hover:text-[color:var(--w11-accent)]">
                    {tool.label}
                  </div>
                  <p className="text-sm text-[color:var(--w11-text-secondary)]">{tool.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {tab === "years" && <AcademicYearsTab />}
        {tab === "classes" && <ClassesTab />}
        {tab === "subjects" && <SubjectsTab />}
      </AOSPageBody>
    </AOSPage>
  );
}

function AcademicYearsTab() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<AcademicYear | null>(null);
  // E219: Start/End are REQUIRED — a year without dates is meaningless
  // (the seeded "2082" had none). BSDateInput's hidden input always carries a
  // value (it defaults to today), so "required" is enforced here by only
  // accepting a submission once the user has actually picked both dates
  // (edit dialogs start from the stored dates instead).
  const [pickedDates, setPickedDates] = useState<{ start?: string; end?: string }>({});
  const [isCurrentYear, setIsCurrentYear] = useState(false);

  const openYearDialog = (year: AcademicYear | null) => {
    setPickedDates(
      year
        ? { start: getDateInputValue(year.start_date) || undefined, end: getDateInputValue(year.end_date) || undefined }
        : {}
    );
    setIsCurrentYear(Boolean(year?.is_current));
    if (year) {
      setEditItem(year);
    } else {
      setShowAdd(true);
    }
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["academic-years"],
    queryFn: fetchAcademicYears,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createAcademicYear(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success("Academic year created");
      setShowAdd(false);
    },
    onError: () => toast.error("Failed to create academic year"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateAcademicYear(editItem?.id || "", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success("Academic year updated");
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update academic year"),
  });

  const deleteMutation = useMutation({
    mutationFn: (yearId: string) => deleteAcademicYear(yearId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success("Academic year deleted");
    },
    onError: () => toast.error("Failed to delete academic year"),
  });

  if (isError)
    return (
      <div className="win11-card p-6 text-center space-y-3">
        <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load data. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  if (isLoading) return <PageLoader />;

  const years = data || [];

  const YEAR_COLUMNS: Column<AcademicYear>[] = [
    { key: "name", label: "Name", sortable: true, value: (y) => y.name, render: (y) => <span className="font-medium">{y.name}</span> },
    { key: "start_date", label: "Start Date", sortable: true, value: (y) => y.start_date, render: (y) => displayBS(y.start_date) || "-" },
    { key: "end_date", label: "End Date", sortable: true, value: (y) => y.end_date, render: (y) => displayBS(y.end_date) || "-" },
    {
      key: "is_current",
      label: "Status",
      sortable: true,
      value: (y) => (y.is_current ? "current" : "past"),
      render: (y) => (
        <Badge variant={y.is_current ? "success" : "secondary"}>
          {y.is_current ? "Current" : "Past"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (y) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => openYearDialog(y)}
            onDelete={() => deleteMutation.mutate(y.id)}
            deleteLabel={`Delete academic year "${y.name}"?`}
            deleting={deleteMutation.isPending}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <DataPanel
        title="Academic Years"
        actions={
          <Button onClick={() => openYearDialog(null)}>
            <Plus className="mr-2 h-4 w-4" /> Add Year
          </Button>
        }
        bodyClassName="p-0"
      >
        <DataTable<AcademicYear>
          columns={YEAR_COLUMNS}
          rows={years}
          rowKey={(y) => y.id}
          searchable
          searchPlaceholder="Search years…"
          exportFileName="academic-years"
          empty={{
            icon: BookOpen,
            title: "No academic years yet",
            body: "Create your first academic year — everything (classes, exams, fees) hangs off it.",
            action: { label: "Add Year", onClick: () => openYearDialog(null) },
          }}
        />
      </DataPanel>

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
            <DialogTitle>{editItem ? "Edit Academic Year" : "Add Academic Year"}</DialogTitle>
          </DialogHeader>
          <form
            key={editItem?.id || "new-year"}
            onSubmit={(event) => {
              event.preventDefault();
              // E219: a year without Start/End is rejected with feedback
              // (previously it silently saved, leaving the "N/A" row).
              if (!pickedDates.start || !pickedDates.end) {
                toast.error("Start date and End date are both required");
                return;
              }
              const formData = new FormData(event.currentTarget);
              const payload = {
                name: formData.get("name"),
                start_date: pickedDates.start,
                end_date: pickedDates.end,
                is_current: formData.get("is_current") === "on",
              };

              if (editItem) {
                updateMutation.mutate(payload);
              } else {
                createMutation.mutate(payload);
              }
            }}
            className="space-y-4"
          >
            <FormSection title="Year Details">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input name="name" required defaultValue={editItem?.name} placeholder="2082" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date *</Label>
                    <BSDateInput
                      name="start_date"
                      value={pickedDates.start}
                      onChange={(ad) => setPickedDates((p) => ({ ...p, start: ad }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date *</Label>
                    <BSDateInput
                      name="end_date"
                      value={pickedDates.end}
                      onChange={(ad) => setPickedDates((p) => ({ ...p, end: ad }))}
                    />
                  </div>
                </div>
                <p className="text-xs text-[color:var(--w11-text-secondary)]">
                  BS calendar dates (e.g. a school year 2082 runs Baisakh 1, 2082 → Chaitra 30, 2082).
                </p>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={isCurrentYear}
                    onCheckedChange={(v) => setIsCurrentYear(v === true)}
                    aria-label="Set as current academic year"
                  />
                  Set as current academic year
                </label>
                {/* Radix Checkbox doesn't submit — mirror into FormData */}
                <input type="hidden" name="is_current" value={isCurrentYear ? "on" : ""} />
              </div>
            </FormSection>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAdd(false);
                  setEditItem(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? <Spinner size="sm" /> : editItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClassesTab() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [showAddClass, setShowAddClass] = useState(false);
  const [editClass, setEditClass] = useState<ClassItem | null>(null);
  const [addSectionFor, setAddSectionFor] = useState<ClassItem | null>(null);
  const [editSection, setEditSection] = useState<{ klass: ClassItem; section: SectionItem } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["classes"],
    queryFn: fetchClasses,
  });

  const createClassMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      numeric_grade: number;
      initial_section_name?: string;
      initial_section_capacity?: number;
    }) => {
      const createdClass = await createClass({
        name: payload.name,
        numeric_grade: payload.numeric_grade,
      });

      const sectionName = payload.initial_section_name?.trim();
      if (sectionName) {
        await createSection(createdClass.id, {
          name: sectionName,
          capacity: payload.initial_section_capacity,
        });
      }

      return createdClass;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class created");
      setShowAddClass(false);
    },
    onError: () => toast.error("Failed to create class"),
  });

  const updateClassMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      updateClass(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class updated");
      setEditClass(null);
    },
    onError: () => toast.error("Failed to update class"),
  });

  const deleteClassMutation = useMutation({
    mutationFn: (classId: string) => deleteClass(classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class deleted");
    },
    onError: () => toast.error("Failed to delete class"),
  });

  const createSectionMutation = useMutation({
    mutationFn: (payload: { classId: string; data: Record<string, unknown> }) =>
      createSection(payload.classId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Section created");
      setAddSectionFor(null);
    },
    onError: () => toast.error("Failed to create section"),
  });

  const updateSectionMutation = useMutation({
    mutationFn: (payload: { classId: string; sectionId: string; data: Record<string, unknown> }) =>
      updateSection(payload.classId, payload.sectionId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Section updated");
      setEditSection(null);
    },
    onError: () => toast.error("Failed to update section"),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (payload: { classId: string; sectionId: string }) =>
      deleteSection(payload.classId, payload.sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Section deleted");
    },
    onError: () => toast.error("Failed to delete section"),
  });

  if (isError)
    return (
      <div className="win11-card p-6 text-center space-y-3">
        <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load data. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  if (isLoading) return <PageLoader />;

  const classes = data || [];

  const CLASS_COLUMNS: Column<ClassItem>[] = [
    {
      key: "name",
      label: "Class",
      sortable: true,
      value: (k) => k.name,
      render: (k) => (
        <div>
          <div className="font-medium">{k.name}</div>
          <div className="text-xs text-[color:var(--w11-text-secondary)]">
            Manage sections and teacher assignments from here.
          </div>
        </div>
      ),
    },
    { key: "numeric_grade", label: "Grade", align: "right", sortable: true, value: (k) => k.numeric_grade ?? 0, render: (k) => <Badge variant="outline">Grade {k.numeric_grade ?? "-"}</Badge> },
    {
      key: "sections",
      label: "Sections",
      value: (k) => (k.sections || []).length,
      render: (k) => (
        <div className="space-y-2">
          {(k.sections || []).map((section) => (
            <div
              key={section.id}
              className="flex items-center justify-between rounded-[var(--w11-radius-md)] border border-[var(--w11-border-subtle)] px-3 py-2"
            >
              <div>
                <div className="font-medium">Section {section.name}</div>
                <div className="text-xs text-[color:var(--w11-text-secondary)]">
                  Capacity: {section.capacity ?? "-"}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); setEditSection({ klass: k, section }); }}
                  aria-label={`Edit section ${section.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      const ok = await confirm({
                        title: `Delete section "${section.name}"?`,
                        body: `It will be removed from ${k.name}. Students stay enrolled in the class.`,
                        confirmLabel: "Delete section",
                        tone: "danger",
                      });
                      if (ok) {
                        deleteSectionMutation.mutate({ classId: k.id, sectionId: section.id });
                      }
                    })();
                  }}
                  aria-label={`Delete section ${section.name}`}
                >
                  <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
                </Button>
              </div>
            </div>
          ))}
          {(k.sections || []).length === 0 && (
            <div className="text-sm text-[color:var(--w11-text-secondary)]">No sections yet.</div>
          )}
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setAddSectionFor(k); }}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Add Section
          </Button>
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (k) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => setEditClass(k)}
            onDelete={() => deleteClassMutation.mutate(k.id)}
            deleteLabel={`Delete class "${k.name}"?`}
            deleting={deleteClassMutation.isPending}
          />
        </div>
      ),
    },
  ];
  const sectionDialogClass = addSectionFor || editSection?.klass || null;
  const sectionDialogItem = editSection?.section || null;

  return (
    <>
      <DataPanel
        title="Classes & Sections"
        actions={
          <Button onClick={() => setShowAddClass(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Class
          </Button>
        }
        bodyClassName="p-0"
      >
        <DataTable<ClassItem>
          columns={CLASS_COLUMNS}
          rows={classes}
          rowKey={(k) => k.id}
          searchable
          searchPlaceholder="Search classes…"
          exportFileName="classes-sections"
          empty={{
            icon: Users,
            title: "No classes created yet",
            body: "Create your first class — sections and teachers hang off it.",
            action: { label: "Add Class", onClick: () => setShowAddClass(true) },
          }}
        />
      </DataPanel>

      <Dialog
        open={showAddClass || !!editClass}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddClass(false);
            setEditClass(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editClass ? "Edit Class" : "Add Class"}</DialogTitle>
          </DialogHeader>
          <form
            key={editClass?.id || "new-class"}
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const payload = {
                name: String(formData.get("name") || ""),
                numeric_grade: Number(formData.get("numeric_grade")),
              };

              if (editClass) {
                updateClassMutation.mutate({ id: editClass.id, data: payload });
                return;
              }

              createClassMutation.mutate({
                ...payload,
                initial_section_name: String(formData.get("initial_section_name") || "").trim() || undefined,
                initial_section_capacity: formData.get("initial_section_capacity")
                  ? Number(formData.get("initial_section_capacity"))
                  : undefined,
              });
            }}
            className="space-y-4"
          >
            <FormSection title="Class Details">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Class Name</Label>
                  <Input name="name" required defaultValue={editClass?.name} placeholder="Class 10" />
                </div>
                <div className="space-y-2">
                  <Label>Grade Number</Label>
                  <Input
                    name="numeric_grade"
                    type="number"
                    min={1}
                    max={12}
                    required
                    defaultValue={editClass?.numeric_grade ?? undefined}
                  />
                </div>
                {!editClass && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Initial Section</Label>
                      <Input name="initial_section_name" placeholder="A" />
                    </div>
                    <div className="space-y-2">
                      <Label>Section Capacity</Label>
                      <Input name="initial_section_capacity" type="number" min={1} placeholder="40" />
                    </div>
                  </div>
                )}
              </div>
            </FormSection>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddClass(false);
                  setEditClass(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createClassMutation.isPending || updateClassMutation.isPending}>
                {createClassMutation.isPending || updateClassMutation.isPending ? <Spinner size="sm" /> : editClass ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!sectionDialogClass}
        onOpenChange={(open) => {
          if (!open) {
            setAddSectionFor(null);
            setEditSection(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sectionDialogItem ? "Edit Section" : "Add Section"}
              {sectionDialogClass ? ` - ${sectionDialogClass.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <form
            key={sectionDialogItem?.id || `${sectionDialogClass?.id || "new"}-section`}
            onSubmit={(event) => {
              event.preventDefault();
              if (!sectionDialogClass) return;

              const formData = new FormData(event.currentTarget);
              const payload = {
                name: String(formData.get("name") || "").trim(),
                capacity: formData.get("capacity") ? Number(formData.get("capacity")) : undefined,
              };

              if (sectionDialogItem) {
                updateSectionMutation.mutate({
                  classId: sectionDialogClass.id,
                  sectionId: sectionDialogItem.id,
                  data: payload,
                });
              } else {
                createSectionMutation.mutate({
                  classId: sectionDialogClass.id,
                  data: payload,
                });
              }
            }}
            className="space-y-4"
          >
            <FormSection title="Section Details">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Section Name</Label>
                  <Input name="name" required defaultValue={sectionDialogItem?.name} placeholder="A" />
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input
                    name="capacity"
                    type="number"
                    min={1}
                    defaultValue={sectionDialogItem?.capacity ?? 40}
                  />
                </div>
              </div>
            </FormSection>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddSectionFor(null);
                  setEditSection(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createSectionMutation.isPending || updateSectionMutation.isPending}>
                {createSectionMutation.isPending || updateSectionMutation.isPending ? <Spinner size="sm" /> : sectionDialogItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SubjectsTab() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Subject | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["subjects"],
    queryFn: fetchSubjects,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createSubject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject created");
      setShowAdd(false);
    },
    onError: () => toast.error("Failed to create subject"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateSubject(editItem?.id || "", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject updated");
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update subject"),
  });

  const deleteMutation = useMutation({
    mutationFn: (subjectId: string) => deleteSubject(subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject deleted");
    },
    onError: () => toast.error("Failed to delete subject"),
  });

  if (isError)
    return (
      <div className="win11-card p-6 text-center space-y-3">
        <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load data. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  if (isLoading) return <PageLoader />;

  const subjects = data || [];

  const SUBJECT_COLUMNS: Column<Subject>[] = [
    { key: "name", label: "Name", sortable: true, value: (s) => s.name, render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "code", label: "Code", sortable: true, value: (s) => s.code || "" },
    { key: "credit_hours", label: "Credit Hours", sortable: true, align: "right", value: (s) => s.credit_hours ?? 0 },
    {
      key: "marks",
      label: "Marks",
      render: (s) =>
        s.has_practical && (s.practical_full_marks ?? 0) > 0 ? (
          <div className="text-sm leading-tight">
            <p>
              Th {s.full_marks ?? 0} / {s.pass_marks ?? 0}
            </p>
            <p className="text-[color:var(--w11-text-secondary)]">
              Pr {s.practical_full_marks} / {s.practical_pass_marks ?? 0}
            </p>
          </div>
        ) : (
          <span className="text-sm">
            {s.full_marks ?? 100} / {s.pass_marks ?? 32}
          </span>
        ),
    },
    {
      key: "is_optional",
      label: "Type",
      sortable: true,
      value: (s) => (s.is_optional ? "optional" : "compulsory"),
      render: (s) => (
        <Badge variant={s.is_optional ? "outline" : "secondary"}>
          {s.is_optional ? "Optional" : "Compulsory"}
        </Badge>
      ),
    },
    {
      key: "has_practical",
      label: "Practical",
      value: (s) => (s.has_practical ? "yes" : "no"),
      render: (s) => (
        <Badge variant={s.has_practical ? "default" : "secondary"}>
          {s.has_practical ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (s) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => setEditItem(s)}
            onDelete={() => deleteMutation.mutate(s.id)}
            deleteLabel={`Delete subject "${s.name}"?`}
            deleting={deleteMutation.isPending}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <DataPanel
        title="Subjects"
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Subject
          </Button>
        }
        bodyClassName="p-0"
      >
        <DataTable<Subject>
          columns={SUBJECT_COLUMNS}
          rows={subjects}
          rowKey={(s) => s.id}
          searchable
          searchPlaceholder="Search subjects…"
          exportFileName="subjects"
          empty={{
            icon: BookMarked,
            title: "No subjects yet",
            body: "Add your first subject to start recording marks.",
            action: { label: "Add Subject", onClick: () => setShowAdd(true) },
          }}
        />
      </DataPanel>

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
            <DialogTitle>{editItem ? "Edit Subject" : "Add Subject"}</DialogTitle>
          </DialogHeader>
          <form
            key={editItem?.id || "new-subject"}
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const hasPractical = formData.get("has_practical") === "true";
              const payload = {
                name: formData.get("name"),
                code: formData.get("code"),
                credit_hours: Number(formData.get("credit_hours")),
                is_optional: formData.get("is_optional") === "true",
                full_marks: Number(formData.get("full_marks") || 100),
                pass_marks: Number(formData.get("pass_marks") || 32),
                has_practical: hasPractical,
                practical_full_marks: hasPractical
                  ? Number(formData.get("practical_full_marks") || 0)
                  : null,
                practical_pass_marks: hasPractical
                  ? Number(formData.get("practical_pass_marks") || 0)
                  : null,
              };

              if (editItem) {
                updateMutation.mutate(payload);
              } else {
                createMutation.mutate(payload);
              }
            }}
            className="space-y-4"
          >
            <FormSection title="Subject Details">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject Name</Label>
                    <Input name="name" required defaultValue={editItem?.name} placeholder="Mathematics" />
                  </div>
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input name="code" required defaultValue={editItem?.code} placeholder="MATH" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Credit Hours</Label>
                    <Input
                      name="credit_hours"
                      type="number"
                      min={1}
                      required
                      defaultValue={editItem?.credit_hours ?? 4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <AdvancedSelect
                      name="is_optional"
                      defaultValue={String(Boolean(editItem?.is_optional))}
                      options={[
                        { value: "false", label: "Compulsory" },
                        { value: "true", label: "Optional" },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </FormSection>
            <FormSection title="Marks & Grading">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Marks</Label>
                    <Input
                      name="full_marks"
                      type="number"
                      min={1}
                      required
                      defaultValue={editItem?.full_marks ?? 100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pass Marks</Label>
                    <Input
                      name="pass_marks"
                      type="number"
                      min={0}
                      required
                      defaultValue={editItem?.pass_marks ?? 32}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Practical Component</Label>
                  <AdvancedSelect
                    name="has_practical"
                    defaultValue={String(Boolean(editItem?.has_practical))}
                    options={[
                      { value: "false", label: "No practical" },
                      { value: "true", label: "Has practical" },
                    ]}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Practical Full Marks</Label>
                    <Input
                      name="practical_full_marks"
                      type="number"
                      min={0}
                      defaultValue={editItem?.practical_full_marks ?? ""}
                      placeholder="25"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Practical Pass Marks</Label>
                    <Input
                      name="practical_pass_marks"
                      type="number"
                      min={0}
                      defaultValue={editItem?.practical_pass_marks ?? ""}
                      placeholder="10"
                    />
                  </div>
                </div>
                <p className="text-xs text-[color:var(--w11-text-secondary)]">
                  Set practical full/pass marks to use subject-specific NEB grading. Leave them empty to keep the legacy exam-level split.
                </p>
              </div>
            </FormSection>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAdd(false);
                  setEditItem(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? <Spinner size="sm" /> : editItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
