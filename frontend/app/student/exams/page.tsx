"use client";

/**
 * Student → Exams (NEW, R4b).
 *
 * Lists online exams (GET /exams/online filtered to my class) with status:
 * upcoming / live window / attempted. "Start" opens the runner route that
 * POSTs /exams/online/<id>/start and renders questions with autosave +
 * server clock + submit — mirroring the mobile runner's contract.
 */

import { useQuery } from "@tanstack/react-query";
import { use, useMemo } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState, EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n";
import { displayBS } from "@/lib/nepali_date";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, Clock, CheckCircle2, Play } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

type OnlineExam = {
  id: string;
  title: string;
  subject_name?: string;
  class_name?: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  total_marks?: number | null;
  status?: string;
};

function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function StudentExamsPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  // My profile (for class_id filter + exam eligibility display)
  const profile = useQuery({
    queryKey: ["student-me"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<unknown>>("/auth/me");
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const exams = useQuery({
    queryKey: ["student-online-exams"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OnlineExam[] | OnlineExam[]>>(
        "/exams/online",
        { params: { per_page: 50 } },
      );
      const data = res.data.data;
      return Array.isArray(data) ? data : (data as unknown as { items?: OnlineExam[] })?.items ?? [];
    },
    retry: 1,
  });

  const now = Date.now();
  const categorized = useMemo(() => {
    const list = exams.data || [];
    const live: OnlineExam[] = [];
    const upcoming: OnlineExam[] = [];
    const closed: OnlineExam[] = [];
    for (const e of list) {
      const start = e.start_time ? new Date(e.start_time).getTime() : null;
      const end = e.end_time ? new Date(e.end_time).getTime() : null;
      if (end && end < now) closed.push(e);
      else if (start && start <= now && (!end || end >= now)) live.push(e);
      else if (start) upcoming.push(e);
      else live.push(e); // no window = always available
    }
    return { live, upcoming, closed };
  }, [exams.data, now]);

  if (exams.isLoading) return <PageLoader />;
  if (exams.isError)
    return (
      <ErrorState
        title={t("Couldn't load your exams", "तपाईंको परीक्षा लोड गर्न सकिएन")}
        onRetry={() => exams.refetch()}
      />
    );

  const { live, upcoming, closed } = categorized;
  const total = live.length + upcoming.length + closed.length;

  if (total === 0) {
    return (
      <EmptyState
        icon={FileQuestion}
        title={t("No online exams yet", "अझै अनलाइन परीक्षा छैन")}
        body={t(
          "When your teachers publish online exams, they appear here with a start button.",
          "शिक्षकहरूले अनलाइन परीक्षा प्रकाशित गर्दा यहाँ देखिन्छ।",
        )}
      />
    );
  }

  const ExamCard = ({ exam, state }: { exam: OnlineExam; state: "live" | "upcoming" | "closed" }) => (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 pt-4">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
          style={{
            background: state === "live" ? "var(--w11-accent)" : "var(--w11-subtle, rgba(0,0,0,0.05))",
            color: state === "live" ? "var(--w11-accent-text)" : "var(--w11-text-secondary)",
          }}
        >
          {state === "closed" ? <CheckCircle2 className="h-5 w-5" /> : <FileQuestion className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--w11-text-primary)" }}>
            {exam.title}
          </p>
          <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            {[exam.subject_name, exam.total_marks ? `${exam.total_marks} marks` : null, exam.duration_minutes ? `${exam.duration_minutes} min` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            <Clock className="h-3 w-3" />
            {fmtTime(exam.start_time)} → {fmtTime(exam.end_time)}
          </p>
        </div>
        {state === "live" && (
          <Link href={`/student/exams/${exam.id}`}>
            <Button size="sm">
              <Play className="mr-1 h-3.5 w-3.5" />
              {t("Start", "सुरु")}
            </Button>
          </Link>
        )}
        {state === "closed" && (
          <span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            {t("Closed", "बन्द")}
          </span>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          {t("Exams", "परीक्षा")}
        </h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {t("Online exams with autosave and a server-side timer.", "स्वतः सेभ र सर्भर टाइमरसहितका अनलाइन परीक्षाहरू।")}
        </p>
      </div>

      {live.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
            {t("Available now", "अहिले उपलब्ध")} · {live.length}
          </h2>
          {live.map((e) => <ExamCard key={e.id} exam={e} state="live" />)}
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
            {t("Upcoming", "आउँदै") } · {upcoming.length}
          </h2>
          {upcoming.map((e) => <ExamCard key={e.id} exam={e} state="upcoming" />)}
        </section>
      )}

      {closed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
            {t("Finished", "समाप्त")} · {closed.length}
          </h2>
          {closed.map((e) => <ExamCard key={e.id} exam={e} state="closed" />)}
        </section>
      )}
    </div>
  );
}
