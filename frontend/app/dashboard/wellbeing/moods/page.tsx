"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { Smile, Frown, Meh, Brain, TrendingUp } from "lucide-react";

const moodIcon: Record<string, React.ReactNode> = {
  happy: <Smile className="h-4 w-4 text-green-500" />,
  neutral: <Meh className="h-4 w-4 text-yellow-500" />,
  sad: <Frown className="h-4 w-4 text-blue-500" />,
  anxious: <Brain className="h-4 w-4 text-purple-500" />,
  angry: <Frown className="h-4 w-4 text-red-500" />,
};

const moodColor: Record<string, string> = {
  happy: "bg-green-100 text-green-800",
  neutral: "bg-yellow-100 text-yellow-800",
  sad: "bg-blue-100 text-blue-800",
  anxious: "bg-purple-100 text-purple-800",
  angry: "bg-red-100 text-red-800",
};

export default function MoodsPage() {
  return <PluginGate slug="wellbeing"><MoodsContent /></PluginGate>;
}

function MoodsContent() {
  const { data: entries, isLoading } = useQuery<any>({
    queryKey: ["wellbeing-moods-admin"],
    queryFn: async () => (await api.get("/wellbeing/mood")).data?.data || [],
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["wellbeing-mood-summary"],
    queryFn: async () => (await api.get("/wellbeing/mood/summary")).data?.data || {},
  });

  if (isLoading) return <PageLoader />;

  const moodEntries: any[] = Array.isArray(entries) ? entries : [];
  const dist: Record<string, number> = summary?.mood_distribution || {};
  const total = summary?.total_entries || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6" /> Mood Tracker</h1>
        <p className="text-muted-foreground">School-wide mood check-in overview</p>
      </div>

      {total > 0 && (
        <div className="grid gap-3 md:grid-cols-5">
          {Object.entries(dist).map(([mood, count]) => (
            <Card key={mood}>
              <CardContent className="pt-4 text-center">
                <div className="flex justify-center mb-1">{moodIcon[mood] || <Meh className="h-4 w-4" />}</div>
                <p className="capitalize font-medium text-sm">{mood}</p>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{total > 0 ? Math.round((count / total) * 100) : 0}%</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Recent Check-ins</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Mood</TableHead>
                <TableHead>Energy</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moodEntries.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No mood entries yet</TableCell></TableRow>
              ) : moodEntries.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.student?.name || e.student_id}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${moodColor[e.mood] || "bg-muted"}`}>
                      {moodIcon[e.mood]} {e.mood}
                    </span>
                  </TableCell>
                  <TableCell>{e.energy_level != null ? `${e.energy_level}/5` : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{e.notes || "—"}</TableCell>
                  <TableCell className="text-sm">{e.created_at ? new Date(e.created_at).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
