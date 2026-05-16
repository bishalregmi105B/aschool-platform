"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
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
  return <LmsContent />;
}

function LmsContent() {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const { data: courses, isLoading } = useQuery<any>({
    queryKey: ["lms-courses"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/lms/courses");
      return (res.data.data as Course[]) || [];
    },
  });

  const { data: courseDetail } = useQuery<any>({
    queryKey: ["lms-course", selectedCourse],
    queryFn: async () => {
      const res = await api.get<ApiResponse>(`/lms/courses/${selectedCourse}`);
      return res.data.data as Course;
    },
    enabled: !!selectedCourse,
  });

  if (isLoading) return <PageLoader />;

  if (selectedCourse && courseDetail) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedCourse(null)}>&larr; Back to Courses</Button>
        <div>
          <h1 className="text-2xl font-bold">{courseDetail.title}</h1>
          <p className="text-muted-foreground">{courseDetail.description}</p>
        </div>
        <div className="space-y-3">
          {courseDetail.lessons?.map((lesson, i) => (
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
      <div>
        <h1 className="text-2xl font-bold">Learning Management</h1>
        <p className="text-muted-foreground">Courses, lessons, quizzes, and progress tracking</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Courses</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{courses?.length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Published</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{courses?.filter(c => c.status === "published").length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Draft</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{courses?.filter(c => c.status === "draft").length || 0}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses?.map(course => (
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
          <p className="text-muted-foreground col-span-full text-center py-8">No courses yet. Create one to get started.</p>
        )}
      </div>
    </div>
  );
}
