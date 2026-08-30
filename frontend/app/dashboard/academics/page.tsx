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
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { displayBS } from "@/lib/nepali_date";
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
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-sm text-muted-foreground">{deleteLabel}</p>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Academics</h1>
        <p className="text-muted-foreground">
          Manage academic years, classes, sections, subjects, and assignments
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {[
          { key: "years" as const, label: "Academic Years", icon: BookOpen },
          { key: "classes" as const, label: "Classes & Sections", icon: Users },
          { key: "subjects" as const, label: "Subjects", icon: BookMarked },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {ACADEMIC_TOOLS.map((tool) => (
          <Link key={tool.href} href={tool.href} className="group">
            <Card className="border-dashed transition-colors hover:border-primary/40 hover:bg-muted/30">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <tool.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold group-hover:text-primary">
                    {tool.label}
                  </div>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {tab === "years" && <AcademicYearsTab />}
      {tab === "classes" && <ClassesTab />}
      {tab === "subjects" && <SubjectsTab />}
    </div>
  );
}

function AcademicYearsTab() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<AcademicYear | null>(null);
  // E219: Start/End are REQUIRED — a year without dates is meaningless
  // (the seeded "2082" had none). BSDateInput's hidden input always carries a
  // value (it defaults to today), so "required" is enforced here by only
  // accepting a submission once the user has actually picked both dates
  // (edit dialogs start from the stored dates instead).
  const [pickedDates, setPickedDates] = useState<{ start?: string; end?: string }>({});

  const openYearDialog = (year: AcademicYear | null) => {
    setPickedDates(
      year
        ? { start: getDateInputValue(year.start_date) || undefined, end: getDateInputValue(year.end_date) || undefined }
        : {}
    );
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
      <div className="max-w-2xl mx-auto p-6">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load data. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  if (isLoading) return <PageLoader />;

  const years = data || [];

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => openYearDialog(null)}>
          <Plus className="mr-2 h-4 w-4" /> Add Year
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((year) => (
                <TableRow key={year.id}>
                  <TableCell className="font-medium">{year.name}</TableCell>
                  <TableCell>{displayBS(year.start_date) || "-"}</TableCell>
                  <TableCell>{displayBS(year.end_date) || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={year.is_current ? "success" : "secondary"}>
                      {year.is_current ? "Current" : "Past"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => openYearDialog(year)}
                      onDelete={() => deleteMutation.mutate(year.id)}
                      deleteLabel={`Delete academic year \"${year.name}\"?`}
                      deleting={deleteMutation.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {years.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No academic years yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            <p className="text-xs text-muted-foreground">
              BS calendar dates (e.g. a school year 2082 runs Baisakh 1, 2082 → Chaitra 30, 2082).
            </p>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                name="is_current"
                type="checkbox"
                defaultChecked={Boolean(editItem?.is_current)}
                className="h-4 w-4 rounded border-input"
              />
              Set as current academic year
            </label>
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
      <div className="max-w-2xl mx-auto p-6">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load data. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  if (isLoading) return <PageLoader />;

  const classes = data || [];
  const sectionDialogClass = addSectionFor || editSection?.klass || null;
  const sectionDialogItem = editSection?.section || null;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setShowAddClass(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Class
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Sections</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((klass) => (
                <TableRow key={klass.id}>
                  <TableCell>
                    <div className="font-medium">{klass.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Manage sections and teacher assignments from here.
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Grade {klass.numeric_grade ?? "-"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {(klass.sections || []).map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <div>
                            <div className="font-medium">Section {section.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Capacity: {section.capacity ?? "-"}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditSection({ klass, section })}
                              aria-label={`Edit section ${section.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Delete section \"${section.name}\" from ${klass.name}?`)) {
                                  deleteSectionMutation.mutate({ classId: klass.id, sectionId: section.id });
                                }
                              }}
                              aria-label={`Delete section ${section.name}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(klass.sections || []).length === 0 && (
                        <div className="text-sm text-muted-foreground">No sections yet.</div>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setAddSectionFor(klass)}>
                        <Plus className="mr-2 h-3.5 w-3.5" /> Add Section
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => setEditClass(klass)}
                      onDelete={() => deleteClassMutation.mutate(klass.id)}
                      deleteLabel={`Delete class \"${klass.name}\"?`}
                      deleting={deleteClassMutation.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {classes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No classes created yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
      <div className="max-w-2xl mx-auto p-6">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load data. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  if (isLoading) return <PageLoader />;

  const subjects = data || [];

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Subject
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Credit Hours</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Practical</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{subject.code || "-"}</TableCell>
                  <TableCell>{subject.credit_hours ?? "-"}</TableCell>
                  <TableCell>
                    {subject.has_practical && (subject.practical_full_marks ?? 0) > 0 ? (
                      <div className="text-sm leading-tight">
                        <p>
                          Th {subject.full_marks ?? 0} / {subject.pass_marks ?? 0}
                        </p>
                        <p className="text-muted-foreground">
                          Pr {subject.practical_full_marks} / {subject.practical_pass_marks ?? 0}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm">
                        {subject.full_marks ?? 100} / {subject.pass_marks ?? 32}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={subject.is_optional ? "outline" : "secondary"}>
                      {subject.is_optional ? "Optional" : "Compulsory"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={subject.has_practical ? "default" : "secondary"}>
                      {subject.has_practical ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => setEditItem(subject)}
                      onDelete={() => deleteMutation.mutate(subject.id)}
                      deleteLabel={`Delete subject \"${subject.name}\"?`}
                      deleting={deleteMutation.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {subjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No subjects yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                <select
                  name="is_optional"
                  defaultValue={String(Boolean(editItem?.is_optional))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="false">Compulsory</option>
                  <option value="true">Optional</option>
                </select>
              </div>
            </div>
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
              <select
                name="has_practical"
                defaultValue={String(Boolean(editItem?.has_practical))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="false">No practical</option>
                <option value="true">Has practical</option>
              </select>
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
            <p className="text-xs text-muted-foreground">
              Set practical full/pass marks to use subject-specific NEB grading. Leave them empty to keep the legacy exam-level split.
            </p>
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
