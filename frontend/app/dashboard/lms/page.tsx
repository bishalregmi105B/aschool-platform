"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { BookOpen, Video, FileText, GraduationCap, Plus, Lock, CheckCircle2, PlayCircle, FileAudio, FileVideo } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";

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
  /** Optional per-viewer progress fields. Today the staff-side course GET
   *  returns the raw lesson list; these are read defensively so the EduEx-style
   *  sequential-lock / progress chips light up the moment the backend adds
   *  `is_completed` / `is_accessible` (flagged as a backend need in Wave C). */
  is_completed?: boolean;
  is_accessible?: boolean;
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
  const { t } = useI18n();
  // Wave C: the open course is URL state (?course=<id>) so a course view is
  // shareable / restorable (plan 33-2); lesson rows carry progress chips.
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const selectedCourse = routeParams.get("course");
  const setSelectedCourse = (id: string | null) => {
    const pathname = windowRoute?.pathname ?? "/dashboard/lms";
    const next = new URLSearchParams(routeParams.toString());
    if (id) next.set("course", id);
    else next.delete("course");
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  };
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

  if (isLoading)
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title={t("Learning Management", "सिक्ने प्रबन्धन (LMS)")}
          subtitle={t("Courses, lessons, quizzes, and progress tracking", "पाठ्यक्रम, पाठ, प्रश्नोत्तर र प्रगति")}
        />
        <AOSPageBody>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </AOSPageBody>
      </AOSPage>
    );

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title={t("Learning Management", "सिक्ने प्रबन्धन (LMS)")}
          subtitle={t("Courses, lessons, quizzes, and progress tracking", "पाठ्यक्रम, पाठ, प्रश्नोत्तर र प्रगति")}
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load courses. Please try again.", "पाठ्यक्रम लोड गर्न असफल। फेरि प्रयास गर्नुहोस्।")}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
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
            <Button variant="outline" size="sm" onClick={() => setSelectedCourse(null)}>← {t("Back to Courses", "पाठ्यक्रममा फर्कनुहोस्")}</Button>
          }
        />
        <AOSPageBody>
          {(() => {
            const lessons = (courseDetail.lessons || []) as Lesson[];
            const total = lessons.length;
            // EduEx-style progress rail (eduex-lms-v2.0.md §10-2): chips are
            // derived from per-lesson flags when the backend supplies them
            // (is_completed / is_accessible); otherwise the first lesson is
            // the honest "next" marker. Sequential LOCK stays server-side —
            // the UI only reflects is_accessible === false, never enforces.
            const completed = lessons.filter((l) => l.is_completed).length;
            const anyProgress = lessons.some((l) => l.is_completed || l.is_accessible === false);
            const nextIdx = lessons.findIndex((l) => !l.is_completed);
            return (
              <>
                {total > 0 && (
                  <DataPanel title={t("Course progress", "पाठ्यक्रम प्रगति")} className="mb-4">
                    <div className="flex items-center gap-4">
                      <Progress value={total ? Math.round((completed / total) * 100) : 0} className="flex-1" />
                      <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--w11-text-secondary)" }}>
                        {completed}/{total} {t("lessons", "पाठ")}
                      </span>
                    </div>
                    {!anyProgress && (
                      <p className="text-[11px] mt-2" style={{ color: "var(--w11-text-tertiary)" }}>
                        {t(
                          "Per-student completion appears once progress tracking data is served with the course.",
                          "विद्यार्थीगत प्रगति डेटा आएसँगै यहाँ देखिनेछ।"
                        )}
                      </p>
                    )}
                  </DataPanel>
                )}
                <div className="space-y-3">
                  {lessons.map((lesson, i) => {
                    const locked = lesson.is_accessible === false;
                    const done = Boolean(lesson.is_completed);
                    const isNext = !done && !locked && i === nextIdx;
                    return (
                      <div key={lesson.id} className="win11-card" style={{ marginBottom: 0, opacity: locked ? 0.65 : 1 }}>
                        <div className="flex items-center gap-4 py-2">
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center font-bold shrink-0"
                            style={
                              done
                                ? { background: "rgba(16,124,16,.12)", color: "#107c10" }
                                : locked
                                ? { background: "var(--w11-control-hover)", color: "var(--w11-text-tertiary)" }
                                : { background: "var(--w11-accent-light)", color: "var(--w11-accent)" }
                            }
                          >
                            {done ? <CheckCircle2 className="h-5 w-5" /> : locked ? <Lock className="h-4 w-4" /> : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{lesson.title}</p>
                            <p className="text-xs text-[color:var(--w11-text-secondary)]">
                              {lesson.content_type === "video" && <FileVideo className="h-3 w-3 inline mr-1" />}
                              {lesson.content_type === "audio" && <FileAudio className="h-3 w-3 inline mr-1" />}
                              {lesson.content_type === "text" && <FileText className="h-3 w-3 inline mr-1" />}
                              {lesson.content_type} {lesson.duration_minutes ? `• ${lesson.duration_minutes} min` : ""}
                            </p>
                          </div>
                          {done && <span className="win11-chip success">{t("Completed", "सम्पन्न")}</span>}
                          {locked && <span className="win11-chip subtle">{t("Locked", "बन्द")}</span>}
                          {isNext && (
                            <span className="win11-chip accent flex items-center gap-1">
                              <PlayCircle className="h-3.5 w-3.5" /> {t("Up next", "अर्को")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {total === 0 && (
                    <AOSEmptyState
                      icon={<FileText className="h-10 w-10" />}
                      title={t("No lessons added yet", "अझै पाठ थपिएको छैन")}
                      description={t("Lessons created from the teacher app appear here in order.", "शिक्षक एपबाट बनेका पाठ यहाँ क्रममा देखिन्छन्।")}
                    />
                  )}
                </div>
              </>
            );
          })()}
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Learning Management", "सिक्ने प्रबन्धन (LMS)")}
        subtitle={t("Courses, lessons, quizzes, and progress tracking", "पाठ्यक्रम, पाठ, प्रश्नोत्तर र प्रगति")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("Create Course", "पाठ्यक्रम बनाउनुहोस्")}
          </Button>
        }
      />
      <AOSPageBody>
        <StatGrid min={160}>
          <KpiCard label={t("Total Courses", "कुल पाठ्यक्रम")} value={courses?.length || 0} />
          <KpiCard label={t("Published", "प्रकाशित")} value={courses?.filter((c: any) => c.status === "published").length || 0} />
          <KpiCard label={t("Draft", "ड्राफ्ट")} value={courses?.filter((c: any) => c.status === "draft").length || 0} />
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
              <p className="text-[11px] mt-2" style={{ color: "var(--w11-text-tertiary)" }}>
                {(course.lessons?.length ?? course.total_lessons ?? 0)} {t("lessons", "पाठ")}
              </p>
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
