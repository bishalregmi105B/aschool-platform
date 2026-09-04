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
  obtained?: number;
  full_marks?: number;
  gpa?: number | string;
  rank?: number | null;
};

type ChildResultsPayload = {
  student_name?: string;
  subjects?: SubjectResult[];
  exam_name?: string;
};

/** Parent → Results. Backed by GET /parent/child-results (per-exam subject rows). */
export default function ParentResultsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent-results"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ChildResultsPayload[] | ChildResultsPayload>>(
        "/parent/child-results"
      );
      const payload = res.data.data;
      return Array.isArray(payload) ? payload[0] : payload;
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorState title="Couldn't load results" onRetry={() => refetch()} />;

  const subjects = data?.subjects || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="parent" title="Results" />
      {data?.exam_name && (
        <p className="text-sm text-muted-foreground">{data.exam_name}</p>
      )}
      <Card>
        <CardHeader><CardTitle>Subject Results</CardTitle></CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No published results yet — they appear here once the school publishes an exam.
            </p>
          ) : (
            <div className="space-y-3">
              {subjects.map((s) => {
                const pct =
                  s.full_marks && s.obtained != null
                    ? Math.round((s.obtained / s.full_marks) * 100)
                    : null;
                return (
                  <div key={s.subject} className="flex items-center justify-between border-b py-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{s.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.obtained ?? "—"} / {s.full_marks ?? "—"}
                        {s.gpa != null ? ` • GPA ${s.gpa}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.rank != null && <Badge variant="outline">Rank {s.rank}</Badge>}
                      {pct != null && (
                        <Badge variant={pct >= 40 ? "success" : "destructive"}>{pct}%</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryTile label="Subjects" value={subjects.length} />
        <SummaryTile
          label="Avg %"
          value={
            subjects.length
              ? Math.round(
                  subjects.reduce(
                    (sum, s) =>
                      sum +
                      (s.full_marks && s.obtained != null
                        ? (s.obtained / s.full_marks) * 100
                        : 0),
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
