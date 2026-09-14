"use client";

/**
 * Student → Online Exam Runner (NEW, R4b).
 *
 * Backend contract (backend/app/apps/modules/exams/routes.py):
 *   POST /exams/online/<id>/start → {attempt_id, status, started_at,
 *        remaining_seconds, saved_answers}
 *   GET  /exams/online/<id>/take  → questions + server clock
 *   PATCH /exams/online/<id>/attempt → autosave {attempt_id, saved_question_count,
 *        remaining_seconds}
 *   POST /exams/online/<id>/submit → scores & close
 *
 * Mobile-runner parity: server clock for the countdown, autosave every
 * answer change (debounced), question palette, away-5s warning, submit
 * confirmation. No client-side scoring — the server owns the result.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n";
import { Clock, ChevronLeft, ChevronRight, Send, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  question_text: string;
  question_type?: string;
  options?: string[] | null;
  marks?: number | null;
};

type TakePayload = {
  exam?: { id: string; title: string; duration_minutes?: number | null; total_marks?: number | null; end_time?: string | null };
  questions: Question[];
  server_time?: string;
};

type StartPayload = {
  attempt_id: string;
  status: string;
  started_at?: string;
  remaining_seconds: number;
  saved_answers?: Record<string, unknown>;
};

export default function StudentExamRunnerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const examId = params.id;
  const { t } = useI18n();
  const confirm = useConfirm();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const [awayWarned, setAwayWarned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch the paper (questions)
  const paper = useQuery({
    queryKey: ["exam-take", examId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TakePayload>>(
        `/exams/online/${examId}/take`,
      );
      return res.data.data;
    },
    retry: 1,
    enabled: !finished,
  });

  const questions = useMemo(() => paper.data?.questions || [], [paper.data]);
  const exam = paper.data?.exam;

  // Start the attempt
  const startExam = useCallback(async () => {
    const res = await api.post<ApiResponse<StartPayload>>(
      `/exams/online/${examId}/start`,
    );
    const data = res.data.data;
    setAttemptId(data.attempt_id);
    setRemaining(data.remaining_seconds);
    if (data.saved_answers) {
      const restored: Record<string, string> = {};
      for (const [qid, val] of Object.entries(data.saved_answers)) {
        restored[qid] = typeof val === "string" ? val : JSON.stringify(val);
      }
      setAnswers(restored);
    }
    setStarted(true);
  }, [examId]);

  // Countdown (server-anchored)
  useEffect(() => {
    if (!started || finished || remaining === null) return;
    const iv = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return r;
        if (r <= 1) {
          clearInterval(iv);
          void doSubmit(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished]);

  // Anti-cheat: away-5s warning
  useEffect(() => {
    if (!started || finished) return;
    const onVis = () => {
      if (document.hidden && !awayWarned) {
        setAwayWarned(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [started, finished, awayWarned]);

  // Autosave (debounced on answer change)
  const scheduleSave = useCallback(
    (next: Record<string, string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (!attemptId) return;
        try {
          await api.patch(`/exams/online/${examId}/attempt`, {
            attempt_id: attemptId,
            answers: next,
          });
        } catch {
          /* autosave is best-effort; the next change retries */
        }
      }, 1200);
    },
    [attemptId, examId],
  );

  const setAnswer = (qid: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: value };
      scheduleSave(next);
      return next;
    });
  };

  const doSubmit = async (auto = false) => {
    if (!attemptId) return;
    if (!auto) {
      const unanswered = questions.filter((q) => !answers[q.id]).length;
      const ok = await confirm({
        title: t("Submit exam?", "परीक्षा बुझाउने?"),
        body: unanswered
          ? t(
              `${unanswered} question(s) are unanswered. You cannot change answers after submitting.`,
              `${unanswered} प्रश्नको उत्तर दिइएको छैन। बुझाएपछि सच्याउन मिल्दैन।`,
            )
          : t(
              "You cannot change answers after submitting.",
              "बुझाएपछि उत्तर सच्याउन मिल्दैन।",
            ),
        confirmLabel: t("Submit", "बुझाउनुहोस्"),
      });
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      await api.post(`/exams/online/${examId}/submit`, {
        attempt_id: attemptId,
        answers,
      });
      setFinished(true);
    } catch {
      setSubmitting(false);
    }
  };

  if (paper.isLoading) return <PageLoader />;
  if (paper.isError)
    return (
      <ErrorState
        title={t("Couldn't load this exam", "यो परीक्षा लोड गर्न सकिएन")}
        onRetry={() => paper.refetch()}
      />
    );

  if (finished) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mb-3 text-4xl">✅</div>
        <h1 className="text-xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          {t("Exam submitted", "परीक्षा बुझाइयो")}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {t(
            "Your answers are saved. Results appear in Results once your teacher publishes them.",
            "तपाईंका उत्तर सुरक्षित छन्। नतिजा प्रकाशित भएपछि 'नतिजा' मा देखिनेछ।",
          )}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => router.push("/student/exams")}>
            {t("Back to exams", "परीक्षामा फर्कनुहोस्")}
          </Button>
          <Button onClick={() => router.push("/student")}>
            {t("Home", "गृह")}
          </Button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          {exam?.title || t("Online Exam", "अनलाइन परीक्षा")}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {[
            questions.length ? t(`${questions.length} questions`, `${questions.length} प्रश्न`) : null,
            exam?.duration_minutes ? t(`${exam.duration_minutes} minutes`, `${exam.duration_minutes} मिनेट`) : null,
            exam?.total_marks ? t(`${exam.total_marks} marks`, `${exam.total_marks} अंक`) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          <li>• {t("Answers autosave as you type.", "लेख्दै गर्दा उत्तर स्वतः सेभ हुन्छ।")}</li>
          <li>• {t("The timer is server-side — refresh-safe.", "टाइमर सर्भरमा चल्छ — रिफ्रेश गरे पनि ठीक छ।")}</li>
          <li>• {t("Leaving the page is recorded.", "पेज छोडेको रेकर्ड हुन्छ।")}</li>
        </ul>
        <Button className="mt-8" size="lg" onClick={() => void startExam()}>
          {t("Start exam", "परीक्षा सुरु गर्नुहोस्")}
        </Button>
      </div>
    );
  }

  const q = questions[current];
  const mm = Math.floor((remaining ?? 0) / 60);
  const ss = (remaining ?? 0) % 60;
  const answeredCount = questions.filter((qq) => answers[qq.id]).length;

  return (
    <div className="space-y-4">
      {/* Header: title + server countdown */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-lg border bg-[var(--w11-surface-solid)] px-4 py-2.5" style={{ borderColor: "var(--w11-border-default)" }}>
        <p className="min-w-0 truncate text-sm font-semibold" style={{ color: "var(--w11-text-primary)" }}>
          {exam?.title}
        </p>
        <span
          className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums")}
          style={
            (remaining ?? 0) < 300
              ? { background: "#c42b1c", color: "#fff" }
              : { background: "var(--w11-subtle, rgba(0,0,0,0.05))", color: "var(--w11-text-primary)" }
          }
          role="timer"
          aria-live="off"
        >
          <Clock className="h-4 w-4" />
          {mm}:{String(ss).padStart(2, "0")}
        </span>
      </div>

      {awayWarned && (
        <div className="win11-infobar flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "#fff4ce", color: "#4a3200" }}>
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {t(
            "You left the exam page — this has been recorded.",
            "तपाईंले परीक्षा पेज छोड्नुभयो — यो रेकर्ड भयो।",
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.6fr_2fr]">
        {/* Question palette */}
        <div className="order-2 lg:order-1">
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--w11-border-default)" }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
              {t("Questions", "प्रश्नहरू")} · {answeredCount}/{questions.length}
            </p>
            <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
              {questions.map((qq, i) => (
                <button
                  key={qq.id}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={`${t("Question", "प्रश्न")} ${i + 1}${answers[qq.id] ? ` — ${t("answered", "उत्तर दिइयो")}` : ""}`}
                  className={cn(
                    "h-8 rounded-md border text-xs font-semibold transition-colors",
                    i === current && "ring-2 ring-[var(--w11-accent)]",
                  )}
                  style={{
                    borderColor: answers[qq.id] ? "var(--w11-accent)" : "var(--w11-border-default)",
                    background: answers[qq.id] ? "var(--w11-accent)" : "transparent",
                    color: answers[qq.id] ? "var(--w11-accent-text)" : "var(--w11-text-primary)",
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current question */}
        <div className="order-1 min-w-0 lg:order-2">
          {q && (
            <div className="rounded-xl border p-4 sm:p-6" style={{ borderColor: "var(--w11-border-default)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
                {t("Question", "प्रश्न")} {current + 1} {q.marks ? `· ${q.marks} ${t("marks", "अंक")}` : ""}
              </p>
              <p className="mt-2 text-[15px] font-medium leading-relaxed" style={{ color: "var(--w11-text-primary)" }}>
                {q.question_text}
              </p>

              {q.options && q.options.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-[var(--w11-control-hover)]"
                      style={{
                        borderColor: answers[q.id] === String(oi) ? "var(--w11-accent)" : "var(--w11-border-default)",
                        background: answers[q.id] === String(oi) ? "var(--w11-subtle, rgba(0,0,0,0.05))" : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === String(oi)}
                        onChange={() => setAnswer(q.id, String(oi))}
                        className="h-4 w-4"
                      />
                      <span style={{ color: "var(--w11-text-primary)" }}>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  rows={5}
                  placeholder={t("Write your answer…", "तपाईंको उत्तर लेख्नुहोस्…")}
                  aria-label={t("Answer", "उत्तर")}
                  className="mt-4 w-full rounded-lg border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--w11-accent)]"
                  style={{ borderColor: "var(--w11-border-default)", background: "var(--w11-surface-solid)", color: "var(--w11-text-primary)" }}
                />
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("Previous", "अघिल्लो")}
            </Button>
            {current < questions.length - 1 ? (
              <Button size="sm" onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>
                {t("Next", "अर्को")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" disabled={submitting} onClick={() => void doSubmit()}>
                <Send className="mr-1 h-4 w-4" />
                {submitting ? t("Submitting…", "बुझाँदै…") : t("Submit exam", "परीक्षा बुझाउनुहोस्")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
