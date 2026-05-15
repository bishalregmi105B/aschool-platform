"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Smile, Frown, Meh, Brain, TrendingUp, FileHeart } from "lucide-react";

interface MoodEntry {
  id: string;
  student_id: string;
  mood: string;
  energy_level: number;
  notes: string;
  created_at: string;
}

interface MoodSummary {
  period_days: number;
  mood_distribution: Record<string, number>;
  total_entries: number;
}

const moodIcons: Record<string, React.ReactNode> = {
  happy: <Smile className="h-5 w-5 text-green-500" />,
  neutral: <Meh className="h-5 w-5 text-yellow-500" />,
  sad: <Frown className="h-5 w-5 text-blue-500" />,
  anxious: <Brain className="h-5 w-5 text-purple-500" />,
  angry: <Frown className="h-5 w-5 text-red-500" />,
};

const moodColors: Record<string, string> = {
  happy: "bg-green-100 text-green-800",
  neutral: "bg-yellow-100 text-yellow-800",
  sad: "bg-blue-100 text-blue-800",
  anxious: "bg-purple-100 text-purple-800",
  angry: "bg-red-100 text-red-800",
};

export default function WellbeingPage() {
  return (
    <PluginGate slug="wellbeing">
      <WellbeingContent />
    </PluginGate>
  );
}

function WellbeingContent() {
  const [tab, setTab] = useState<"overview" | "check-in" | "entries">("overview");
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["wellbeing-summary"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/wellbeing/mood/summary?days=7");
      return res.data.data as MoodSummary;
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["wellbeing-entries"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/wellbeing/mood");
      return (res.data.data as MoodEntry[]) || [];
    },
    enabled: tab === "entries",
  });

  const submitMoodMut = useMutation({
    mutationFn: async (data: { mood: string; energy_level: number; notes: string }) => {
      const res = await api.post<ApiResponse>("/wellbeing/mood", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellbeing-summary", "wellbeing-entries"] });
      setTab("overview");
      toast.success("Mood check-in recorded!");
    },
  });

  if (isLoading) return <PageLoader />;

  const distribution = summary?.mood_distribution || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Student Wellbeing</h1>
        <p className="text-muted-foreground">Mood tracking, counselor notes, and wellbeing surveys</p>
      </div>

      <div className="flex gap-2">
        {(["overview", "check-in", "entries"] as const).map(t => (
          <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">
            {t === "overview" && <TrendingUp className="h-4 w-4 mr-2" />}
            {t === "check-in" && <FileHeart className="h-4 w-4 mr-2" />}
            {t.replace("-", " ")}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-5">
            {Object.entries(moodIcons).map(([mood, icon]) => (
              <Card key={mood}>
                <CardContent className="flex items-center gap-3 py-4">
                  {icon}
                  <div>
                    <p className="text-2xl font-bold">{distribution[mood] || 0}</p>
                    <p className="text-xs text-muted-foreground capitalize">{mood}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>7-Day Summary</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Total check-ins: <strong>{summary?.total_entries || 0}</strong></p>
              {summary?.total_entries === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">No mood entries yet. Encourage students to do daily check-ins.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "check-in" && <MoodCheckIn onSubmit={(data) => submitMoodMut.mutate(data)} loading={submitMoodMut.isPending} />}

      {tab === "entries" && (
        <div className="space-y-3">
          {entries?.map(entry => (
            <Card key={entry.id}>
              <CardContent className="flex items-center gap-4 py-4">
                {moodIcons[entry.mood] || <Meh className="h-5 w-5" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={moodColors[entry.mood] || ""} variant="outline">{entry.mood}</Badge>
                    <span className="text-xs text-muted-foreground">Energy: {entry.energy_level}/5</span>
                    <span className="text-xs text-muted-foreground">{displayBS(entry.created_at)}</span>
                  </div>
                  {entry.notes && <p className="text-sm mt-1">{entry.notes}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MoodCheckIn({ onSubmit, loading }: { onSubmit: (data: { mood: string; energy_level: number; notes: string }) => void; loading: boolean }) {
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState(3);
  const [notes, setNotes] = useState("");

  return (
    <Card>
      <CardHeader><CardTitle>How are you feeling today?</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-3 justify-center">
          {(["happy", "neutral", "sad", "anxious", "angry"] as const).map(m => (
            <button key={m} onClick={() => setMood(m)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${mood === m ? "border-primary bg-primary/5" : "border-transparent hover:border-muted"}`}>
              {moodIcons[m]}
              <span className="text-xs capitalize">{m}</span>
            </button>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium">Energy Level: {energy}/5</label>
          <input type="range" min={1} max={5} value={energy} onChange={(e) => setEnergy(parseInt(e.target.value))} className="w-full mt-2" />
        </div>

        <Textarea placeholder="Any thoughts you'd like to share? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />

        <Button onClick={() => onSubmit({ mood, energy_level: energy, notes })} disabled={!mood || loading} className="w-full">
          {loading ? "Submitting..." : "Submit Check-in"}
        </Button>
      </CardContent>
    </Card>
  );
}
