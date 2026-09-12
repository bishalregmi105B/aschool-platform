"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { BookOpen, Video, FileText, GraduationCap, Plus } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

interface Course {
  id: string;
  title: string;
  description: string;
  instructor_id: string;
  class_id: string;
  subject_id: string;
  status: string;
  thumbnail_url: string | null;
  lessons?: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  content_type: string;
  sort_order: number;
  duration_minutes: number | null;
}

export default function LmsPage() {
  return (
    <PluginGate slug="lms">
      <LmsContent />
    </PluginGate>
  );
}

function LmsContent() {
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: courses, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["lms-courses"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/lms/courses");
      return (res.data.data as Course[]) || [];
    },
    retry: 1,
  });

  // E214: the empty state promised "Create one to get started" with no way to
  // create — this form POSTs the real course endpoint (POST /lms/courses).
  const { data: classes } = useQuery<any[]>({
    queryKey: ["lms-classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/academics/classes");
      return (res.data.data as any[]) || [];
    },
    enabled: createOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; description: string; class_id?: string; subject_id?: string; status: string }) =>
      (await api.post("/lms/courses", payload)).data,
    onSuccess: () => {
      toast.success("Course created");
      queryClient.invalidateQueries({ queryKey: ["lms-courses"] });
      setCreateOpen(false);
    },
    onError: () => toast.error("Failed to create course"),
  });

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const title = String(fd.get("title") || "").trim();
    if (!title) {
      toast.error("Course title is required");
      return;
    }
    createMutation.mutate({
      title,
      description: String(fd.get("description") || ""),
      class_id: (fd.get("class_id") as string) || undefined,
      subject_id: (fd.get("subject_id") as string) || undefined,
      status: String(fd.get("status") || "draft"),
    });
  };

  const { data: courseDetail } = useQuery<any>({
    queryKey: ["lms-course", selectedCourse],
    queryFn: async () => {
      const res = await api.get<ApiResponse>(`/lms/courses/${selectedCourse}`);
      return res.data.data as Course;
    },
    enabled: !!selectedCourse,
  });

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Learning Management"
          subtitle="Courses, lessons, quizzes, and progress tracking"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load courses. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  if (selectedCourse && courseDetail) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title={courseDetail.title}
          subtitle={courseDetail.description}
          actions={
            <Button variant="outline" size="sm" onClick={() => setSelectedCourse(null)}>&larr; Back to Courses</Button>
          }
        />
        <AOSPageBody>
          <div className="space-y-3">
            {courseDetail.lessons?.map((lesson: any, i: number) => (
              <div key={lesson.id} className="win11-card interactive" style={{ marginBottom: 0 }}>
                <div className="flex items-center gap-4 py-2">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center font-bold"
                    style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{lesson.title}</p>
                    <p className="text-xs text-[color:var(--w11-text-secondary)]">
                      {lesson.content_type === "video" && <Video className="h-3 w-3 inline mr-1" />}
                      {lesson.content_type === "text" && <FileText className="h-3 w-3 inline mr-1" />}
                      {lesson.content_type} {lesson.duration_minutes ? `• ${lesson.duration_minutes} min` : ""}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {(!courseDetail.lessons || courseDetail.lessons.length === 0) && (
              <p className="text-[color:var(--w11-text-secondary)] text-center py-8">No lessons added yet</p>
            )}
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Learning Management"
        subtitle="Courses, lessons, quizzes, and progress tracking"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Course
          </Button>
        }
      />
      <AOSPageBody>
        <StatGrid min={160}>
          <KpiCard label="Total Courses" value={courses?.length || 0} />
          <KpiCard label="Published" value={courses?.filter((c: any) => c.status === "published").length || 0} />
          <KpiCard label="Draft" value={courses?.filter((c: any) => c.status === "draft").length || 0} />
        </StatGrid>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses?.map((course: any) => (
            <div
              key={course.id}
              className="win11-card interactive cursor-pointer"
              style={{ marginBottom: 0 }}
              onClick={() => setSelectedCourse(course.id)}
            >
              <div className="flex items-start justify-between">
                <GraduationCap className="h-8 w-8" style={{ color: "var(--w11-accent)" }} />
                <StatusChip status={course.status} />
              </div>
              <p className="font-semibold mt-2 text-[color:var(--w11-text-primary)]">{course.title}</p>
              <p className="text-sm text-[color:var(--w11-text-secondary)] line-clamp-2 mt-1">{course.description}</p>
            </div>
          ))}
          {courses?.length === 0 && (
            <div className="col-span-full">
              <DataPanel>
                <AOSEmptyState
                  icon={<GraduationCap className="h-10 w-10" />}
                  title="No courses yet"
                  description="Create one to get started."
                  action={
                    <Button variant="outline" onClick={() => setCreateOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Create Course
                    </Button>
                  }
                />
              </DataPanel>
            </div>
          )}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Course</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input name="title" required placeholder="Grade 10 Science — Term 1" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea name="description" rows={3} placeholder="What this course covers" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <AdvancedSelect name="class_id" clearable placeholder="— Optional —"
                    options={(classes || []).map((c: any) => ({ value: c.id, label: c.sections ? `${c.name} (${c.sections.length})` : c.name }))} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <AdvancedSelect name="status" defaultValue="draft"
                    options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                  Create Course
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
