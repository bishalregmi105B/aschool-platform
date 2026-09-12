"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoader } from "@/components/ui/spinner";
import { Smile, Frown, Meh, Brain, TrendingUp } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";

const moodIcon: Record<string, React.ReactNode> = {
  happy: <Smile className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
  neutral: <Meh className="h-4 w-4" style={{ color: "#9d5d00" }} />,
  sad: <Frown className="h-4 w-4 text-[color:var(--w11-text-secondary)]" />,
  anxious: <Brain className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
  angry: <Frown className="h-4 w-4" style={{ color: "#c42b1c" }} />,
};

const moodChipTone: Record<string, string> = {
  happy: "success",
  neutral: "warning",
  sad: "",
  anxious: "accent",
  angry: "error",
};

export default function MoodsPage() {
  return <PluginGate slug="wellbeing"><MoodsContent /></PluginGate>;
}

function MoodsContent() {
  const { isError, refetch, data: entries, isLoading } = useQuery<any>({
    queryKey: ["wellbeing-moods-admin"],
    queryFn: async () => (await api.get("/wellbeing/mood")).data?.data || [],
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["wellbeing-mood-summary"],
    queryFn: async () => (await api.get("/wellbeing/mood/summary")).data?.data || {},
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Mood Tracker"
          subtitle="School-wide mood check-in overview"
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


  const moodEntries: any[] = Array.isArray(entries) ? entries : [];

  const MOOD_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (e) => e.student_name ?? "", render: (e) => <span className="font-medium">{e.student_name || e.student_id}</span> },
    {
      key: "mood",
      label: "Mood",
      sortable: true,
      value: (e) => e.mood ?? "",
      render: (e) => (
        <span className={`inline-flex items-center gap-1 win11-chip ${moodChipTone[e.mood] || ""}`}>
          {moodIcon[e.mood]} {e.mood}
        </span>
      ),
    },
    { key: "energy_level", label: "Energy", align: "right", sortable: true, value: (e) => e.energy_level ?? 0, render: (e) => (e.energy_level != null ? `${e.energy_level}/5` : "—") },
    { key: "notes", label: "Notes", value: (e) => e.notes ?? "", render: (e) => <span className="text-sm text-[color:var(--w11-text-secondary)] max-w-xs truncate block">{e.notes || "—"}</span> },
    { key: "created_at", label: "Date", sortable: true, value: (e) => e.created_at ?? "", render: (e) => <span className="text-sm">{e.created_at ? new Date(e.created_at).toLocaleDateString() : "—"}</span> },
  ];
  const dist: Record<string, number> = summary?.mood_distribution || {};
  const total = summary?.total_entries || 0;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Mood Tracker"
        subtitle="School-wide mood check-in overview"
      />
      <AOSPageBody>
        {total > 0 && (
          <StatGrid min={140}>
            {Object.entries(dist).map(([mood, count]) => (
              <KpiCard
                key={mood}
                label={<span className="capitalize">{mood}</span>}
                value={count}
                footnote={total > 0 ? `${Math.round((count / total) * 100)}%` : "0%"}
                icon={<span className="inline-flex">{moodIcon[mood] || <Meh className="h-4 w-4" />}</span>}
              />
            ))}
          </StatGrid>
        )}

        <DataPanel title="Recent Check-ins" bodyClassName="p-0 pt-0">
          <DataTable
            columns={MOOD_COLUMNS}
            rows={moodEntries}
            rowKey={(e: any) => e.id}
            searchable
            searchPlaceholder="Search students…"
            exportFileName="mood-checkins"
            empty={{ icon: TrendingUp, title: "No mood entries yet", body: "Check-ins from the student app appear here." }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
