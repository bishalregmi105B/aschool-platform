"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";
import { AOSModuleLoadingState } from "@/components/aos/kit/page-kit";

type MoodEntry = { date?: string; mood?: string; note?: string };

type ChildWellbeingPayload = {
  student_name?: string;
  avg_mood?: number | string;
  mood_count?: number;
  recent_moods?: MoodEntry[];
  counselor_notes?: { date?: string; counselor_name?: string; note?: string }[];
};

/** Parent → Wellbeing. Backed by GET /parent/child-wellbeing. */
export default function ParentWellbeingPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent-child-wellbeing"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ChildWellbeingPayload>>("/parent/child-wellbeing");
      return res.data.data;
    },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading…" />;
  if (isError)
    return <ErrorState title="Couldn't load wellbeing" onRetry={() => refetch()} />;

  const moods = data?.recent_moods || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="parent" title="Wellbeing" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{data?.avg_mood ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Average mood (1–5)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{data?.mood_count ?? 0}</p>
            <p className="text-xs text-muted-foreground">Check-ins recorded</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Mood Check-ins</CardTitle></CardHeader>
        <CardContent>
          {moods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mood check-ins yet.</p>
          ) : (
            <div className="space-y-2">
              {moods.map((m, i) => (
                <div key={i} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium capitalize">{m.mood || "—"}</p>
                    {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{m.date || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(data?.counselor_notes || []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Counselor Notes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.counselor_notes || []).map((n, i) => (
              <div key={i} className="border-b py-2 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{n.counselor_name || "Counselor"}</Badge>
                  <span className="text-xs text-muted-foreground">{n.date || ""}</span>
                </div>
                <p className="text-sm mt-1">{n.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
