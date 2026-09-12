"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";
import { AOSModuleLoadingState } from "@/components/aos/kit/page-kit";
import Link from "next/link";

type ChildRef = {
  student_id: string;
  student_name: string;
};

type AttendanceRecord = {
  date: string;
  status: string;
  note?: string | null;
};

type ChildAttendancePayload = {
  records: AttendanceRecord[];
  summary?: {
    total_days?: number;
    present?: number;
    absent?: number;
    late?: number;
    half_day?: number;
    percentage?: number;
  };
};

/**
 * Parent → Attendance. Backed by GET /parent/child-attendance
 * (records + summary; one child per account device — multi-child accounts
 * get a picker when the API gains a student_id param).
 */
export default function ParentAttendancePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent-attendance"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ChildAttendancePayload[] | ChildAttendancePayload>>(
        "/parent/child-attendance"
      );
      const payload = res.data.data;
      return Array.isArray(payload) ? payload[0] : payload;
    },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading…" />;
  if (isError)
    return <ErrorState title="Couldn't load attendance" onRetry={() => refetch()} />;

  const records = data?.records || [];
  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      <PortalHeader portal="parent" title="Attendance" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryTile label="Attendance" value={`${summary.percentage ?? 0}%`} />
        <SummaryTile label="Total Days" value={summary.total_days ?? 0} />
        <SummaryTile label="Present" value={summary.present ?? 0} />
        <SummaryTile label="Absent" value={summary.absent ?? 0} />
        <SummaryTile label="Late" value={summary.late ?? 0} />
      </div>
      <Card>
        <CardHeader><CardTitle>Daily Record</CardTitle></CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div key={`${r.date}-${r.status}`} className="flex items-center justify-between border-b py-2 last:border-0">
                  <span className="text-sm">{r.date}</span>
                  <Badge
                    variant={
                      r.status === "present" ? "success" : r.status === "absent" ? "destructive" : "outline"
                    }
                  >
                    {r.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export type { ChildRef };
