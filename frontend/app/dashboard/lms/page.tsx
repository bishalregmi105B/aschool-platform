"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { BookOpen, Video, FileText, GraduationCap } from "lucide-react";

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
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load courses. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (selectedCourse && courseDetail) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedCourse(null)}>&larr; Back to Courses</Button>
        <div>
          <h1 className="text-2xl font-bold">{courseDetail.title}</h1>
          <p className="text-muted-foreground">{courseDetail.description}</p>
        </div>
        <div className="space-y-3">
          {courseDetail.lessons?.map((lesson: any, i: number) => (
            <Card key={lesson.id} className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{lesson.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {lesson.content_type === "video" && <Video className="h-3 w-3 inline mr-1" />}
                    {lesson.content_type === "text" && <FileText className="h-3 w-3 inline mr-1" />}
                    {lesson.content_type} {lesson.duration_minutes ? `• ${lesson.duration_minutes} min` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!courseDetail.lessons || courseDetail.lessons.length === 0) && (
            <p className="text-muted-foreground text-center py-8">No lessons added yet</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Learning Management</h1>
          <p className="text-muted-foreground">Courses, lessons, quizzes, and progress tracking</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Course
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Courses</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{courses?.length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Published</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{courses?.filter((c: any) => c.status === "published").length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Draft</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{courses?.filter((c: any) => c.status === "draft").length || 0}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses?.map((course: any) => (
          <Card key={course.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedCourse(course.id)}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <GraduationCap className="h-8 w-8 text-primary" />
                <Badge variant={course.status === "published" ? "default" : "secondary"}>{course.status}</Badge>
              </div>
              <CardTitle className="mt-2">{course.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
            </CardContent>
          </Card>
        ))}
        {courses?.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-10 text-center space-y-3">
              <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No courses yet. Create one to get started.</p>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create Course
              </Button>
            </CardContent>
          </Card>
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
                <select name="class_id" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">— Optional —</option>
                  {(classes || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}{c.sections ? ` (${c.sections.length})` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select name="status" defaultValue="draft" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
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
    </div>
  );
}
