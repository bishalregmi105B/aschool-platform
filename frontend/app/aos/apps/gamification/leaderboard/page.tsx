"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { Trophy, Medal, Star } from "lucide-react";

const rankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
};

export default function LeaderboardPage() {
  return <PluginGate slug="gamification"><LeaderboardContent /></PluginGate>;
}

function LeaderboardContent() {
  const { isError, refetch, data, isLoading } = useQuery<any>({
    queryKey: ["gamification-leaderboard-full"],
    queryFn: async () => (await api.get("/gamification/leaderboard", { params: { top: 50 } })).data?.data || [],
  });

  const entries: any[] = Array.isArray(data) ? data : [];

  const LEADERBOARD_COLUMNS: Column<any>[] = [
    {
      key: "rank",
      label: "Rank",
      sortable: true,
      value: (e) => e.rank ?? 0,
      render: (e, i) => <div className="flex justify-center">{rankIcon(e.rank || (i ?? 0) + 1)}</div>,
    },
    { key: "student_name", label: "Student", sortable: true, value: (e) => e.student_name ?? "", render: (e) => <span className="font-medium">{e.student_name || e.student_id}</span> },
    { key: "class_name", label: "Class", sortable: true, value: (e) => e.class_name ?? "", render: (e) => <span className="text-sm text-muted-foreground">{e.class_name || "—"}</span> },
    {
      key: "total_points",
      label: "Total Points",
      align: "right",
      sortable: true,
      value: (e) => e.total_points ?? 0,
      render: (e, i) => (
        <Badge variant={(i ?? 0) === 0 ? "default" : "outline"} className="font-mono">
          {e.total_points?.toLocaleString() || 0} XP
        </Badge>
      ),
    },
  ];

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load data. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6 text-yellow-500" /> Leaderboard</h1>
        <p className="text-muted-foreground">Top students ranked by total XP points</p>
      </div>

      {entries.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No rankings yet</p>
          <p className="text-sm">Award points to students to populate the leaderboard.</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6">
          <DataTable
            columns={LEADERBOARD_COLUMNS}
            rows={entries}
            rowKey={(e: any) => e.student_id || `rank-${e.rank}`}
            searchable
            searchPlaceholder="Search students…"
            exportFileName="leaderboard"
            dense
          />
        </CardContent></Card>
      )}
    </div>
  );
}
