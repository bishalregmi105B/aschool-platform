"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar } from "@/components/ui/avatar";
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
import { PageLoader, Spinner } from "@/components/ui/spinner";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  X,
} from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterClassId, setFilterClassId] = useState("all");
  const [filterSectionId, setFilterSectionId] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const queryClient = useQueryClient();

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
        per_page: "20",
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

  function handleBulkDelete() {
    if (
      !confirm(
        `Delete ${selected.size} selected student(s)? This cannot be undone.`,
      )
    )
      return;
    bulkDeleteMutation.mutate(Array.from(selected));
  }

  if (isLoading) return <PageLoader />;

  if (listError)
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">
              Failed to load students. Please try again.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchStudents()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-muted-foreground">
            {pagination?.total || 0} students enrolled
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
      </div>

      {/* Search + Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or enrollment number..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Class filter using actual class objects */}
            <Select
              value={filterClassId}
              onValueChange={(v) => {
                setFilterClassId(v);
                setFilterSectionId("all");
                setFilterGrade("all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Section filter — only when a class is selected */}
            {filterClassId !== "all" && sections.length > 0 && (
              <Select
                value={filterSectionId}
                onValueChange={(v) => {
                  setFilterSectionId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={filterGender}
              onValueChange={(v) => {
                setFilterGender(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterStatus}
              onValueChange={(v) => {
                setFilterStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2 bg-muted rounded-lg border">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Enrollment No.</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-10 text-muted-foreground"
                  >
                    No students found.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow
                    key={student.id}
                    data-state={
                      selected.has(student.id) ? "selected" : undefined
                    }
                    className={
                      selected.has(student.id) ? "bg-muted/50" : undefined
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(student.id)}
                        onCheckedChange={() => toggleOne(student.id)}
                        aria-label={`Select ${student.first_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={student.photo_url}
                          name={`${student.first_name} ${student.last_name}`}
                          size="sm"
                        />
                        <span className="font-medium">
                          {student.first_name} {student.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {student.enrollment_number || "-"}
                    </TableCell>
                    <TableCell>
                      {/* E204: class names can already carry the "Class " prefix
                          (legacy rows store "Class 10") — strip it before
                          prepending so the cell never shows "Class Class 10". */}
                      {student.class_name
                        ? `Class ${student.class_name.replace(/^\s*class\s+/i, "")}${student.section_name ? ` - ${student.section_name}` : ""}`
                        : "-"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {student.gender || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          student.status === "active"
                            ? "success"
                            : student.status === "graduated"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {STATUS_LABELS[student.status] ?? student.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/dashboard/students/${student.id}`}>View</a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditStudent(student)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Delete this student?"))
                              deleteMutation.mutate(student.id);
                          }}
                        >
                          Delete
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
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_next}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AddStudentDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      {editStudent && (
        <EditStudentDialog
          student={editStudent}
          onOpenChange={(open) => {
            if (!open) setEditStudent(null);
          }}
        />
      )}
    </div>
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
              <p className="text-xs text-muted-foreground">
                Default: EMIS ID @ Student ID
              </p>
            </div>
          </div>
          <div className="space-y-4 pt-4 border-t">
            <Label htmlFor="dob_bs">Date of Birth (BS)</Label>
            <Input id="dob_bs" name="dob_bs" placeholder="2065-04-15" />
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Guardian Information</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardian_name">Guardian Name *</Label>
                <Input id="guardian_name" name="guardian_name" required />
                <p className="text-xs text-muted-foreground">
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
              <Input
                value={dobBs}
                onChange={(e) => setDobBs(e.target.value)}
                placeholder="2065-04-15"
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
