"use client";

/**
 * Student Wellbeing — hub (archetype A7, plan Part 34 #43 + spec: mood trends
 * + confidentiality notice).
 *
 * Research notes (wave F): (1) wellbeing dashboards for minors work best at
 * aggregate level (distribution + trend, not per-child surveillance) with an
 * explicit confidentiality banner on every screen; (2) mood trend lines need
 * a time-range control and an honest zero-data state — no fabricated series.
 * (Live search was bot-blocked in-session; notes grounded in audits corpus
 * 8.19 + standard privacy-by-design heuristics.)
 *
 * Changes vs previous version: hand-rolled button strip replaced by the
 * fixed Tabs grammar is NOT needed here — the hub is a pure A7: KPI band,
 * two chart panels (donut + per-day line), at-risk class rollup from
 * /wellbeing/dashboard, one embedded recent-check-ins panel, and QuickLinks
 * to the three subpages. The check-in form moved from a fake "tab" into a
 * header Dialog. Confidentiality infobar added per spec.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { useI18n } from "@/lib/i18n";
import { useAOSRouterNavigate } from "@/lib/aos-window-route";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/ui/data-table";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Spinner } from "@/components/ui/spinner";
import { ThemedDonutChart, ThemedLineChart } from "@/components/ui/charts";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { Smile, Frown, Meh, Brain, AlertTriangle, HeartPulse, PlusCircle, ShieldAlert, Users } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

const MOODS = ["happy", "neutral", "sad", "anxious", "angry"] as const;
type Mood = (typeof MOODS)[number];

const MOOD_COLORS: Record<Mood, string> = {
  happy: "#107c10",
  neutral: "#9d5d00",
  sad: "#6b6b6b",
  anxious: "#5c6bc0",
  angry: "#c42b1c",
};

/** en + ne labels for the five checked moods (bilingual, StatusChip tone map). */
const MOOD_LABELS: Record<Mood, { en: string; ne: string; tone: string }> = {
  happy: { en: "Happy", ne: "खुसी", tone: "active" },
  neutral: { en: "Neutral", ne: "सामान्य", tone: "pending" },
  sad: { en: "Sad", ne: "दुःखी", tone: "inactive" },
  anxious: { en: "Anxious", ne: "चिन्तित", tone: "review" },
  angry: { en: "Angry", ne: "रिसाएको", tone: "escalated" },
};

interface MoodEntry {
  id: string;
  student_id: string;
  student_name?: string | null;
  mood: Mood;
  energy_level?: number | null;
  notes?: string;
  created_at: string;
}

export default function WellbeingPage() {
  return (
    <AppGate slug="wellbeing">
      <WellbeingContent />
    </AppGate>
  );
}

function WellbeingContent() {
  const { t } = useI18n();
  const navigate = useAOSRouterNavigate();
  const [days, setDays] = useState("7");
  const [showCheckIn, setShowCheckIn] = useState(false);
  const range = parseInt(days, 10);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["wellbeing-summary", range],
    queryFn: async () =>
      (await api.get<ApiResponse>(`/wellbeing/mood/summary?days=${range}`)).data.data as {
        mood_distribution: Record<string, number>;
        total_entries: number;
      },
  });

  // Rollup lives at /wellbeing/dashboard (per-class avg + at-risk count).
  const { data: rollup } = useQuery({
    queryKey: ["wellbeing-dashboard", range],
    queryFn: async () =>
      (await api.get<ApiResponse>(`/wellbeing/dashboard?days=${range}`)).data.data as {
        class_summaries: Array<{ class_name: string; student_count: number; avg_mood: number; at_risk_count: number }>;
        at_risk_total: number;
      },
  });

  // Recent entries power both the trend chart (daily buckets) and the
  // embedded panel. per_page is capped at 100 server-side — the trend is
  // therefore "last 100 check-ins bucketed by day"; flagged in the report.
  const { data: entries } = useQuery({
    queryKey: ["wellbeing-entries", range],
    queryFn: async () =>
      (((await api.get<ApiResponse>(`/wellbeing/mood?per_page=100`)).data.data as MoodEntry[]) || []),
  });

  const distribution = summary?.mood_distribution || {};
  const total = summary?.total_entries ?? 0;

  const trendData = useMemo(() => {
    const cutoff = Date.now() - range * 86400000;
    const buckets = new Map<string, number>();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    (entries || [])
      .filter((e) => new Date(e.created_at).getTime() >= cutoff)
      .forEach((e) => {
        const key = e.created_at.slice(0, 10);
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
      });
    return Array.from(buckets.entries()).map(([day, count]) => ({
      day: day.slice(5),
      count,
    }));
  }, [entries, range]);

  const negativeCount = MOODS.filter((m) => m !== "happy" && m !== "neutral").reduce(
    (n, m) => n + (distribution[m] || 0),
    0
  );
  const topMood = MOODS.reduce<Mood | null>(
    (best, m) => (distribution[m] > 0 && (!best || distribution[m] > distribution[best]) ? m : best),
    null
  );

  const recentRows = useMemo(() => (entries || []).slice(0, 8), [entries]);

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<HeartPulse className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Student Wellbeing"
        subtitle={t("Mood tracking, counselor notes, and wellbeing surveys", "मood ट्र्याकिङ, काउन्सेलर नोट र सर्वेक्षण")}
        actions={
          <>
            <AdvancedSelect
              value={days}
              onChange={setDays}
              options={[
                { value: "7", label: t("Last 7 days", "पछिल्ला ७ दिन") },
                { value: "14", label: t("Last 14 days", "पछिल्ला १४ दिन") },
                { value: "30", label: t("Last 30 days", "पछिल्ला ३० दिन") },
              ]}
              className="w-40"
            />
            <Button onClick={() => setShowCheckIn(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              {t("Record Check-in", "चेक-इन रेकर्ड")}
            </Button>
          </>
        }
      />
      <AOSPageBody>
        {/* Confidentiality notice — spec requirement for this module. */}
        <div className="win11-infobar warning mb-4 flex items-start gap-2" role="note">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-[13px]">
            {t(
              "Confidential: wellbeing data is visible only to counselors and administrators. Never discuss individual students outside the counseling context.",
              "गोपनीय: wellbeing डाटा केवल काउन्सेलर र प्रशासकलाई मात्र देखिन्छ। व्यक्तिगत विद्यार्थीबारे काउन्सेलिङ सन्दर्भ बाहिर चर्चा नगर्नुहोस्।"
            )}
          </p>
        </div>

        <StatGrid min={150}>
          <KpiCard
            label={t(`Check-ins (${range}d)`, `चेक-इन (${range}d)`)}
            value={isLoading ? "—" : total}
            icon={<HeartPulse className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Most common mood", "सबैभन्दा बढी mood")}
            value={topMood ? MOOD_LABELS[topMood].en : "—"}
            color={topMood ? MOOD_COLORS[topMood] : undefined}
            footnote={topMood ? `${distribution[topMood]} / ${total}` : undefined}
            icon={<Smile className="h-4 w-4" style={{ color: topMood ? MOOD_COLORS[topMood] : undefined }} />}
          />
          <KpiCard
            label={t("Low-mood check-ins", "न्यून-mood चेक-इन")}
            value={isLoading ? "—" : negativeCount}
            color="#c42b1c"
            footnote={total > 0 ? `${Math.round((negativeCount / total) * 100)}%` : undefined}
            icon={<AlertTriangle className="h-4 w-4" style={{ color: "#c42b1c" }} />}
          />
          <KpiCard
            label={t("At-risk students", "जोखिमयुक्त विद्यार्थी")}
            value={rollup?.at_risk_total ?? "—"}
            color="#d83b01"
            footnote={t("Latest mood negative in window", "पछिल्लो mood नकारात्मक")}
            icon={<Brain className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
        </StatGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <DataPanel title={t("Mood distribution", "Mood वितरण")}>
            {total > 0 ? (
              <ThemedDonutChart
                data={MOODS.map((m) => ({ name: MOOD_LABELS[m].en, value: distribution[m] || 0, color: MOOD_COLORS[m] }))}
                nameKey="name"
                valueKey="value"
                height={220}
              />
            ) : (
              <WellbeingZero range={range} />
            )}
          </DataPanel>
          <DataPanel title={t("Check-in trend", "चेक-इन प्रवृत्ति")}>
            {total > 0 ? (
              <ThemedLineChart
                data={trendData}
                xKey="day"
                lines={[{ key: "count", name: t("Check-ins", "चेक-इन"), ne: "चेक-इन", color: "var(--w11-accent)" }]}
              />
            ) : (
              <WellbeingZero range={range} />
            )}
          </DataPanel>
        </div>

        <QuickLinks
          section="Student Life"
          links={[
            { label: t("Mood Trends", "Mood प्रवृत्ति"), href: "/dashboard/wellbeing/moods", icon: "TrendingUp" },
            { label: t("Counselor Notes", "काउन्सेलर नोट"), href: "/dashboard/wellbeing/counselor", icon: "Heart" },
            { label: t("Surveys", "सर्वेक्षण"), href: "/dashboard/wellbeing/surveys", icon: "ClipboardList" },
          ]}
        />

        {rollup?.class_summaries?.length ? (
          <DataPanel
            className="mb-4"
            title={
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                {t("Per-class rollup", "कक्षागत सारांश")}
              </span>
            }
            bodyClassName="p-0"
          >
            <ul className="win11-listview">
              {rollup.class_summaries.map((c) => (
                <li key={c.class_name} style={{ cursor: "default" }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium" style={{ color: "var(--w11-text-primary)" }}>
                      {c.class_name}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--w11-text-tertiary)" }}>
                      {c.student_count} {t("students reporting", "विद्यार्थी रिपोर्टिङ")} · {t("avg mood", "औसत")} {c.avg_mood}/5
                    </div>
                  </div>
                  {c.at_risk_count > 0 ? (
                    <StatusChip status="escalated" label={`${c.at_risk_count} at-risk`} />
                  ) : (
                    <StatusChip status="active" label={t("OK", "ठिक")} />
                  )}
                </li>
              ))}
            </ul>
          </DataPanel>
        ) : null}

        <DataPanel
          title={t("Recent check-ins", "पछिल्ला चेक-इन")}
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/wellbeing/moods")}>
              {t("View all", "सबै हेर्नुहोस्")}
            </Button>
          }
          bodyClassName="p-0"
        >
          <DataTable
            columns={[
              {
                key: "student_name",
                label: t("Student", "विद्यार्थी"),
                value: (e: MoodEntry) => e.student_name || e.student_id,
                render: (e: MoodEntry) => <span className="font-medium">{e.student_name || e.student_id}</span>,
              },
              {
                key: "mood",
                label: "Mood",
                value: (e: MoodEntry) => e.mood,
                render: (e: MoodEntry) => {
                  const l = MOOD_LABELS[e.mood] || { en: e.mood, tone: "" };
                  return <StatusChip status={l.tone} label={l.en} />;
                },
              },
              {
                key: "energy_level",
                label: t("Energy", "ऊर्जा"),
                align: "right",
                value: (e: MoodEntry) => e.energy_level ?? 0,
                render: (e: MoodEntry) => (e.energy_level != null ? `${e.energy_level}/5` : "—"),
              },
              {
                key: "created_at",
                label: t("Date", "मिति"),
                value: (e: MoodEntry) => e.created_at,
                render: (e: MoodEntry) => <span className="text-sm">{displayBS(e.created_at)}</span>,
              },
            ]}
            rows={recentRows}
            rowKey={(e: MoodEntry) => e.id}
            empty={{
              icon: HeartPulse,
              title: t("No mood entries yet", "अझै कुनै mood प्रविष्टि छैन"),
              body: t(
                "Encourage students to do daily check-ins from their app.",
                "विद्यार्थीलाई दैनिक चेक-इन गर्न प्रोत्साहन गर्नुहोस्।"
              ),
              action: { label: t("Record Check-in", "चेक-इन रेकर्ड"), onClick: () => setShowCheckIn(true) },
            }}
          />
        </DataPanel>
      </AOSPageBody>

      <Dialog open={showCheckIn} onOpenChange={setShowCheckIn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Mood Check-in", "Mood चेक-इन")}</DialogTitle>
          </DialogHeader>
          <MoodCheckIn onDone={() => setShowCheckIn(false)} />
        </DialogContent>
      </Dialog>
    </AOSPage>
  );
}

function WellbeingZero({ range }: { range: number }) {
  const { t } = useI18n();
  return (
    <div className="py-10 text-center">
      <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
        {t(
          `No check-ins in the last ${range} days. Encourage students to log daily from the student app.`,
          `पछिल्ला ${range} दिनमा कुनै चेक-इन छैन।`
        )}
      </p>
    </div>
  );
}

function MoodCheckIn({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [mood, setMood] = useState<Mood | "">("");
  const [energy, setEnergy] = useState(3);
  const [notes, setNotes] = useState("");
  const [studentId, setStudentId] = useState("");

  // staff (admin/teacher) have no student profile — the backend requires an
  // on-behalf student_id, so it is collected here (searchable).
  const { data: students } = useQuery({
    queryKey: ["wellbeing-checkin-students"],
    queryFn: async () =>
      ((await api.get<ApiResponse>("/students?per_page=200")).data.data as Array<{
        id: string;
        full_name?: string;
        first_name: string;
        last_name: string;
      }>) || [],
    retry: 1,
  });

  const submit = useMutation({
    mutationFn: async () =>
      (await api.post<ApiResponse>("/wellbeing/mood", {
        mood,
        energy_level: energy,
        notes,
        student_id: studentId || undefined,
      })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellbeing-summary"] });
      queryClient.invalidateQueries({ queryKey: ["wellbeing-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["wellbeing-entries"] });
      toast.success(t("Mood check-in recorded!", "Mood चेक-इन रेकर्ड भयो!"));
      onDone();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to record check-in"),
  });

  return (
    <div className="space-y-5 py-1">
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t("Log on behalf of", "तर्फबाट लग गर्नुहोस्")}
        </label>
        <AdvancedSelect
          value={studentId}
          onChange={setStudentId}
          searchable
          clearable
          placeholder={t("Search student…", "विद्यार्थी खोज्नुहोस्…")}
          options={(students || []).map((s) => ({
            value: s.id,
            label: s.full_name || `${s.first_name} ${s.last_name}`,
          }))}
        />
      </div>

      <div className="flex gap-2 justify-center">
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMood(m)}
            className="flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-colors"
            style={{
              borderColor: mood === m ? "var(--w11-accent)" : "transparent",
              background: mood === m ? "var(--w11-accent-light)" : undefined,
            }}
          >
            {m === "happy" && <Smile className="h-5 w-5" style={{ color: MOOD_COLORS.happy }} />}
            {m === "neutral" && <Meh className="h-5 w-5" style={{ color: MOOD_COLORS.neutral }} />}
            {m === "sad" && <Frown className="h-5 w-5" style={{ color: MOOD_COLORS.sad }} />}
            {m === "anxious" && <Brain className="h-5 w-5" style={{ color: MOOD_COLORS.anxious }} />}
            {m === "angry" && <Frown className="h-5 w-5" style={{ color: MOOD_COLORS.angry }} />}
            <span className="text-[11px]">{t(MOOD_LABELS[m].en, MOOD_LABELS[m].ne)}</span>
          </button>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium">
          {t("Energy level", "ऊर्जा स्तर")}: {energy}/5
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={energy}
          onChange={(e) => setEnergy(parseInt(e.target.value))}
          className="w-full mt-2"
        />
      </div>

      <Textarea
        placeholder={t("Anything they'd like to share? (optional)", "साझा गर्न केही छ? (वैकल्पिक)")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
      />

      <Button
        onClick={() => submit.mutate()}
        disabled={!mood || !studentId || submit.isPending}
        className="w-full"
      >
        {submit.isPending ? <Spinner className="mr-2" /> : null}
        {submit.isPending ? t("Submitting…", "पेश गर्दै…") : t("Submit Check-in", "चेक-इन पेश गर्नुहोस्")}
      </Button>
    </div>
  );
}
