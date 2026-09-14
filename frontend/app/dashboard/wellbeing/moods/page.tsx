"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoader } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { useUrlFilters } from "@/components/ui/filter-bar";
import { Smile, Frown, Meh, Brain, TrendingUp } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
} from "@/components/aos/kit/page-kit";
import { displayBS } from "@/lib/nepali_date";

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
  const { t } = useI18n();
  const { values, setValues, clear, activeCount } = useUrlFilters(["mood"]);
  const moodFilter = values.mood || "";

  const { isError, refetch, data: entries, isLoading } = useQuery<any>({
    queryKey: ["wellbeing-moods-admin"],
    queryFn: async () => (await api.get("/wellbeing/mood?per_page=100")).data?.data || [],
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
              <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load data. Please try again.", "डाटा लोड गर्न असफल। फेरि प्रयास गर्नुहोस्।")}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const moodEntries: any[] = Array.isArray(entries) ? entries : [];

  const MOOD_COLUMNS: Column<any>[] = [
    { key: "student_name", label: t("Student", "विद्यार्थी"), sortable: true, value: (e) => e.student_name ?? "", render: (e) => <span className="font-medium">{e.student_name || e.student_id}</span> },
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
    { key: "energy_level", label: t("Energy", "ऊर्जा"), align: "right", sortable: true, value: (e) => e.energy_level ?? 0, render: (e) => (e.energy_level != null ? `${e.energy_level}/5` : "—") },
    { key: "notes", label: t("Notes", "नोट"), value: (e) => e.notes ?? "", render: (e) => <span className="text-sm text-[color:var(--w11-text-secondary)] max-w-xs truncate block">{e.notes || "—"}</span> },
    { key: "created_at", label: t("Date", "मिति"), sortable: true, value: (e) => e.created_at ?? "", render: (e) => <span className="text-sm">{e.created_at ? displayBS(e.created_at) : "—"}</span> },
  ];
  const dist: Record<string, number> = summary?.mood_distribution || {};
  const total = summary?.total_entries || 0;

  const filtered = moodFilter ? moodEntries.filter((e) => e.mood === moodFilter) : moodEntries;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Mood Tracker"
        subtitle={t("School-wide mood check-in overview", "विद्यालयभरको mood चेक-इन अवलोकन")}
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

        <FilterCommandBar>
          <AdvancedSelect
            value={moodFilter}
            onChange={(v) => setValues({ mood: v })}
            clearable
            placeholder={t("All moods", "सबै mood")}
            className="w-44"
            options={Object.keys(moodIcon).map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))}
          />
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clear}>{t("Clear filters", "फिल्टर हटाउनुहोस्")}</Button>
          )}
        </FilterCommandBar>

        <DataPanel title={t("Recent Check-ins", "पछिल्ला चेक-इन")} bodyClassName="p-0 pt-0">
          <DataTable
            columns={MOOD_COLUMNS}
            rows={filtered}
            rowKey={(e: any) => e.id}
            searchable
            searchPlaceholder={t("Search students…", "विद्यार्थी खोज्नुहोस्…")}
            exportFileName="mood-checkins"
            empty={{ icon: TrendingUp, title: t("No mood entries yet", "अझै कुनै mood प्रविष्टि छैन"), body: t("Check-ins from the student app appear here.", "विद्यार्थी एपका चेक-इन यहाँ देखिन्छन्।") }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
