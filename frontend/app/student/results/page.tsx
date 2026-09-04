"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";

type SubjectResult = {
  subject: string;
  subject_name?: string;
  obtained?: number;
  full_marks?: number;
  grade?: string;
  gpa?: number | string;
};

type ResultsPayload = SubjectResult[] | { subjects?: SubjectResult[] };

/** Student → Results. Backed by GET /student/results. */
export default function StudentResultsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-results"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ResultsPayload>>("/student/results");
      const payload = res.data.data;
      return Array.isArray(payload) ? payload : payload?.subjects || [];
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorState title="Couldn't load results" onRetry={() => refetch()} />;

  const subjects = data || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="student" title="Results" />
      <Card>
        <CardHeader><CardTitle>Subject Results</CardTitle></CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No results published yet — they appear here once your school publishes an exam.
            </p>
          ) : (
            <div className="space-y-3">
              {subjects.map((s, i) => {
                const pct =
                  s.full_marks && s.obtained != null
                    ? Math.round((s.obtained / s.full_marks) * 100)
                    : null;
                return (
                  <div key={`${s.subject}-${i}`} className="flex items-center justify-between border-b py-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{s.subject_name || s.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.obtained ?? "—"} / {s.full_marks ?? "—"}
                        {s.gpa != null ? ` • GPA ${s.gpa}` : ""}
                      </p>
                    </div>
                    {s.grade && <Badge variant={pct != null && pct < 40 ? "destructive" : "success"}>{s.grade}</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryTile label="Subjects" value={subjects.length} />
        <SummaryTile
          label="Average %"
          value={
            subjects.length
              ? Math.round(
                  subjects.reduce(
                    (sum, s) =>
                      sum +
                      (s.full_marks && s.obtained != null ? (s.obtained / s.full_marks) * 100 : 0),
                    0
                  ) / subjects.length
                )
              : 0
          }
        />
      </div>
    </div>
  );
}
