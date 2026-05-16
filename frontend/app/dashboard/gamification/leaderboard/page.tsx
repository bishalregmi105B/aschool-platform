"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const { data, isLoading } = useQuery<any>({
    queryKey: ["gamification-leaderboard-full"],
    queryFn: async () => (await api.get("/gamification/leaderboard", { params: { top: 50 } })).data?.data || [],
  });

  if (isLoading) return <PageLoader />;

  const entries: any[] = Array.isArray(data) ? data : [];

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Total Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry: any, i: number) => (
                <TableRow key={entry.student_id || i} className={i < 3 ? "bg-muted/30" : ""}>
                  <TableCell>
                    <div className="flex justify-center">{rankIcon(entry.rank || i + 1)}</div>
                  </TableCell>
                  <TableCell className="font-medium">{entry.student_name || entry.student_id}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.class_name || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={i === 0 ? "default" : "outline"} className="font-mono">
                      {entry.total_points?.toLocaleString() || 0} XP
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
