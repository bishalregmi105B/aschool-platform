"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { BookOpen, CheckCircle2, Clock3 } from "lucide-react";

interface StudentAssignment {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  teacher?: string;
  due_date?: string;
  due_date_bs?: string;
  is_overdue?: boolean;
  marks?: number | null;
  feedback?: string | null;
  total_marks?: number | null;
}

interface StudentAssignmentsResponse {
  pending: StudentAssignment[];
  submitted: StudentAssignment[];
}

function formatDate(bsDate?: string | null, adDate?: string | null) {
  if (bsDate) return bsDate;
  return adDate ? adDate.split("T")[0] : "—";
}

export default function StudentHomeworkPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["student-homework"],
    queryFn: async () => {
      const response = await api.get("/student/assignments");
      return (response.data?.data ?? {
        pending: [],
        submitted: [],
      }) as StudentAssignmentsResponse;
    },
  });

  if (isLoading) return <PageLoader />;

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Unable to load homework right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Homework</h1>
        <p className="text-muted-foreground">
          Review pending work, submitted tasks, and feedback.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold">{data.pending.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold">{data.submitted.length}</p>
              <p className="text-xs text-muted-foreground">Submitted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold">
                {data.pending.filter((assignment) => assignment.is_overdue).length}
              </p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending Homework</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pending.length > 0 ? (
              data.pending.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[assignment.subject, assignment.teacher]
                          .filter(Boolean)
                          .join(" • ") || "Assignment"}
                      </p>
                    </div>
                    <Badge
                      variant={assignment.is_overdue ? "destructive" : "outline"}
                    >
                      {assignment.is_overdue ? "Overdue" : "Pending"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {assignment.description || "No description provided."}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Due: {formatDate(assignment.due_date_bs, assignment.due_date)}</span>
                    <span>Total: {assignment.total_marks ?? "—"}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No pending homework right now.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submitted Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.submitted.length > 0 ? (
              data.submitted.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[assignment.subject, assignment.teacher]
                          .filter(Boolean)
                          .join(" • ") || "Assignment"}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {assignment.marks == null ? "Submitted" : "Graded"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Due: {formatDate(assignment.due_date_bs, assignment.due_date)}</span>
                    <span>
                      Marks: {assignment.marks ?? "Pending"}
                      {assignment.total_marks != null
                        ? ` / ${assignment.total_marks}`
                        : ""}
                    </span>
                  </div>
                  {assignment.feedback ? (
                    <p className="text-sm text-muted-foreground">
                      Feedback: {assignment.feedback}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Submitted homework will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}