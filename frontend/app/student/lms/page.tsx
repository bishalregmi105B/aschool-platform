"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";

type Course = {
  id: string;
  title: string;
  subject?: string;
  teacher?: string;
  total_lessons?: number;
  completed_lessons?: number;
  progress?: number;
};

type Quiz = {
  id: string;
  title: string;
  course_title?: string;
  questions_count?: number;
  time_limit_minutes?: number;
  status?: string;
  score?: number | null;
};

type LmsPayload = {
  courses?: Course[];
  quizzes?: Quiz[];
};

/** Student → LMS. Backed by GET /student/lms (courses with derived progress + quizzes). */
export default function StudentLmsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-lms"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<LmsPayload>>("/student/lms");
      return res.data.data;
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorState title="Couldn't load your courses" onRetry={() => refetch()} />;

  const courses = data?.courses || [];
  const quizzes = data?.quizzes || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="student" title="LMS" />

      <Card>
        <CardHeader><CardTitle>My Courses</CardTitle></CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published courses for your class yet.</p>
          ) : (
            <div className="space-y-3">
              {courses.map((c) => {
                const pct =
                  c.progress != null
                    ? Math.round(c.progress)
                    : c.total_lessons
                    ? Math.round(((c.completed_lessons || 0) / c.total_lessons) * 100)
                    : 0;
                return (
                  <div key={c.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.subject ? `${c.subject} • ` : ""}
                          {c.completed_lessons || 0}/{c.total_lessons || 0} lessons
                          {c.teacher ? ` • ${c.teacher}` : ""}
                        </p>
                      </div>
                      <Badge variant={pct >= 100 ? "success" : "outline"}>{pct}%</Badge>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Quizzes</CardTitle></CardHeader>
        <CardContent>
          {quizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published quizzes right now.</p>
          ) : (
            <div className="space-y-2">
              {quizzes.map((q) => (
                <div key={q.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{q.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.course_title ? `${q.course_title} • ` : ""}
                      {q.questions_count ?? 0} questions
                      {q.time_limit_minutes ? ` • ${q.time_limit_minutes} min` : ""}
                    </p>
                  </div>
                  {q.score != null ? (
                    <Badge variant="success">Scored {Math.round(q.score)}%</Badge>
                  ) : (
                    <Badge variant="outline">{q.status || "Not attempted"}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
