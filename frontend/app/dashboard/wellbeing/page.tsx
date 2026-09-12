"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Smile, Frown, Meh, Brain, TrendingUp, FileHeart, HeartPulse } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FormSection,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";

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
  happy: <Smile className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />,
  neutral: <Meh className="h-5 w-5" style={{ color: "#9d5d00" }} />,
  sad: <Frown className="h-5 w-5 text-[color:var(--w11-text-secondary)]" />,
  anxious: <Brain className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />,
  angry: <Frown className="h-5 w-5" style={{ color: "#c42b1c" }} />,
};

const moodChipTone: Record<string, string> = {
  happy: "success",
  neutral: "warning",
  sad: "",
  anxious: "accent",
  angry: "error",
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

  const { isError, refetch, data: summary, isLoading } = useQuery<any>({
    queryKey: ["wellbeing-summary"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/wellbeing/mood/summary?days=7");
      return res.data.data as MoodSummary;
    },
  });

  const { data: entries } = useQuery<any>({
    queryKey: ["wellbeing-entries"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/wellbeing/mood");
      return (res.data.data as MoodEntry[]) || [];
    },
    enabled: tab === "entries",
  });

  const submitMoodMut = useMutation({
    mutationFn: async (data: { mood: string; energy_level: number; notes: string; student_id?: string }) => {
      const res = await api.post<ApiResponse>("/wellbeing/mood", data);
      return res.data;
    },
    onSuccess: () => {
      // NOTE: invalidateQueries matches element-wise prefixes — the combined
      // key ["wellbeing-summary", "wellbeing-entries"] matches NEITHER query,
      // so the overview silently kept showing stale counts after a check-in.
      queryClient.invalidateQueries({ queryKey: ["wellbeing-summary"] });
      queryClient.invalidateQueries({ queryKey: ["wellbeing-entries"] });
      setTab("overview");
      toast.success("Mood check-in recorded!");
    },
    // admins/teachers have no student profile, so the backend requires an
    // on-behalf student_id — surface the 400 instead of failing silently
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to record check-in"),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<HeartPulse className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Student Wellbeing"
          subtitle="Mood tracking, counselor notes, and wellbeing surveys"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load data. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }


  const distribution = summary?.mood_distribution || {};

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<HeartPulse className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Student Wellbeing"
        subtitle="Mood tracking, counselor notes, and wellbeing surveys"
      />
      <AOSPageBody>
        {/* Dashboard KPIs — 7-day mood distribution from /wellbeing/mood/summary */}
        <StatGrid min={140}>
          {Object.entries(moodIcons).map(([mood, icon]) => (
            <KpiCard key={mood} label={mood} value={distribution[mood] || 0} icon={icon} />
          ))}
          <KpiCard
            label="Check-ins (7d)"
            value={summary?.total_entries ?? "—"}
            icon={<TrendingUp className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
        </StatGrid>

        {/* Quick links — every wellbeing subpage from the plugin manifest */}
        <QuickLinks
          section="Student Life"
          links={[
            { label: "Mood Trends", href: "/dashboard/wellbeing/moods", icon: "TrendingUp" },
            { label: "Counselor", href: "/dashboard/wellbeing/counselor", icon: "Heart" },
            { label: "Surveys", href: "/dashboard/wellbeing/surveys", icon: "ClipboardList" },
          ]}
        />

        <div className="flex gap-2 mb-4">
          {(["overview", "check-in", "entries"] as const).map((t: any) => (
            <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">
              {t === "overview" && <TrendingUp className="h-4 w-4 mr-2" />}
              {t === "check-in" && <FileHeart className="h-4 w-4 mr-2" />}
              {t.replace("-", " ")}
            </Button>
          ))}
        </div>

        {tab === "overview" && (
          <DataPanel title="7-Day Summary">
            <p className="text-[color:var(--w11-text-secondary)]">Total check-ins: <strong>{summary?.total_entries || 0}</strong></p>
            {summary?.total_entries === 0 && (
              <p className="mt-2 text-sm text-[color:var(--w11-text-secondary)]">No mood entries yet. Encourage students to do daily check-ins.</p>
            )}
          </DataPanel>
        )}

        {tab === "check-in" && <MoodCheckIn onSubmit={(data) => submitMoodMut.mutate(data)} loading={submitMoodMut.isPending} />}
        {tab === "entries" && (
          <div className="space-y-3">
            {entries?.map((entry: any) => (
              <div key={entry.id} className="win11-card" style={{ marginBottom: 0 }}>
                <div className="flex items-center gap-4 py-2">
                  {moodIcons[entry.mood] || <Meh className="h-5 w-5" />}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`win11-chip ${moodChipTone[entry.mood] || ""}`}>{entry.mood}</span>
                      <span className="text-xs text-[color:var(--w11-text-secondary)]">Energy: {entry.energy_level}/5</span>
                      <span className="text-xs text-[color:var(--w11-text-secondary)]">{displayBS(entry.created_at)}</span>
                    </div>
                    {entry.notes && <p className="text-sm mt-1">{entry.notes}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}

function MoodCheckIn({ onSubmit, loading }: { onSubmit: (data: { mood: string; energy_level: number; notes: string; student_id?: string }) => void; loading: boolean }) {
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState(3);
  const [notes, setNotes] = useState("");
  // staff (admin/teacher) have no student profile of their own — the backend
  // 400s without an on-behalf student_id, so the check-in records for the
  // selected student.
  const { data: students } = useQuery({
    queryKey: ["wellbeing-checkin-students"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/students?per_page=200");
      return (res.data.data as Array<{ id: string; first_name: string; last_name: string }>) || [];
    },
    retry: 1,
  });
  const [studentId, setStudentId] = useState("");

  return (
    <FormSection title="How are you feeling today?">
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Log on behalf of</label>
          <AdvancedSelect value={studentId} onChange={(v) => setStudentId(v)} clearable searchable placeholder="Select student…"
            options={(students || []).map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))} />
          <p className="text-xs text-[color:var(--w11-text-secondary)]">Wellbeing check-ins are recorded per student.</p>
        </div>

        <div className="flex gap-3 justify-center">
          {(["happy", "neutral", "sad", "anxious", "angry"] as const).map((m: any) => (
            <button key={m} onClick={() => setMood(m)}
              className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors"
              style={{
                borderColor: mood === m ? "var(--w11-accent)" : "transparent",
                background: mood === m ? "var(--w11-accent-light)" : undefined,
              }}>
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

        <Button onClick={() => onSubmit({ mood, energy_level: energy, notes, student_id: studentId || undefined })} disabled={!mood || !studentId || loading} className="w-full">
          {loading ? "Submitting..." : "Submit Check-in"}
        </Button>
      </div>
    </FormSection>
  );
}
