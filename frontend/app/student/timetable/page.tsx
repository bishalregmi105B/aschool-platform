"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";

type Period = {
  id?: string;
  period_number?: number;
  subject?: string;
  subject_name?: string;
  teacher?: string;
  start_time?: string;
  end_time?: string;
  is_break?: boolean;
};

type TimetableDay = {
  day_of_week?: string;
  day?: string;
  periods?: Period[];
};

type TimetablePayload = TimetableDay[] | { days?: TimetableDay[]; periods?: Period[] };

const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Student → Timetable. Backed by GET /student/timetable. */
export default function StudentTimetablePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-timetable"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TimetablePayload>>("/student/timetable");
      const payload = res.data.data;
      return Array.isArray(payload) ? payload : payload?.days || [];
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorState title="Couldn't load your timetable" onRetry={() => refetch()} />;

  const days = data || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="student" title="Timetable" />
      {days.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Your timetable hasn&apos;t been published yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {days
            .slice()
            .sort(
              (a, b) =>
                DAY_ORDER.indexOf(a.day_of_week || a.day || "") -
                DAY_ORDER.indexOf(b.day_of_week || b.day || "")
            )
            .map((day) => (
              <Card key={day.day_of_week || day.day}>
                <CardHeader>
                  <CardTitle className="text-base">{day.day_of_week || day.day}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(day.periods || []).map((p, i) => (
                    <div
                      key={p.id || i}
                      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                        p.is_break ? "bg-muted text-muted-foreground" : "border"
                      }`}
                    >
                      <div>
                        <p className="font-medium">
                          {p.is_break ? "Break" : p.subject_name || p.subject || "—"}
                        </p>
                        {!p.is_break && p.teacher && (
                          <p className="text-xs text-muted-foreground">{p.teacher}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {p.start_time || `P${p.period_number ?? i + 1}`}
                      </Badge>
                    </div>
                  ))}
                  {(day.periods || []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No periods.</p>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
