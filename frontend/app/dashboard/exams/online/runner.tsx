"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CloudUpload, CheckCircle2, Flag, ChevronLeft, ChevronRight, AlertTriangle,
  X, Clock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Wave C — online-exam runner UX (plan 4.3-12 / 16.4 / Part 34 row 7:
 * "runner A6 full-screen per eSchool polish").
 *
 * eSchool v3.3.6 ships the corpus's best exam-taking chrome — a question
 * palette, an away-timer and an always-visible save state
 * (`eschool-v3.3.6.md` §examOnlineScreen: PageView + palette bottom sheet +
 * away>5s auto-submit). This component brings the three UX layers to ASchool
 * as an admin **preview runner**: teachers validate how an exam feels before
 * publishing. It is deliberately view-layer: answers persist only to
 * localStorage (the autosave indicator says so); the student submission path
 * stays on the server integrity endpoints (/start /attempt /submit) which
 * this file never calls.
 *
 * The three layers:
 *  1. Question-palette sidebar (attempted / marked-for-review / current).
 *  2. "Leave screen" warning state — visibilitychange is tracked and a
 *     warning banner + count is shown (the same signal eSchool uses for its
 *     away timer; here it warns instead of auto-submitting).
 *  3. Autosave indicator — debounced local draft persistence with a
 *     Saving…/Saved ✓/Offline status line.
 */

interface RunnerQuestion {
  id: string;
  text?: string;
  question?: string;
  question_text?: string;
  options?: any[];
  choices?: any[];
  marks?: number;
}

interface OnlineExamDetail {
  id: string;
  title: string;
  duration_minutes?: number;
  total_marks?: number;
  questions?: RunnerQuestion[];
}

const qText = (q: RunnerQuestion) => q.text || q.question || q.question_text || "";
const qOptions = (q: RunnerQuestion): string[] =>
  (q.options || q.choices || []).map((o: any) =>
    typeof o === "string" ? o : o?.text || o?.label || o?.option || JSON.stringify(o)
  );

function draftKey(examId: string) {
  return `exam-runner-draft:${examId}`;
}

type SaveState = "idle" | "saving" | "saved" | "offline";

export function ExamRunnerDialog({
  examId,
  open,
  onOpenChange,
}: {
  examId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [awayCount, setAwayCount] = useState(0);
  const [awayNow, setAwayNow] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: exam, isLoading } = useQuery<OnlineExamDetail>({
    queryKey: ["online-exam-detail", examId],
    enabled: open && !!examId,
    queryFn: () => api.get(`/exams/online/${examId}`).then((r) => r.data?.data ?? r.data),
  });

  const questions = useMemo(() => exam?.questions || [], [exam]);
  const durationSec = (exam?.duration_minutes || 0) * 60;
  const remaining = durationSec > 0 ? Math.max(0, durationSec - elapsed) : null;

  // ── Draft lifecycle: resume on open, autosave (local) on change ─────────
  useEffect(() => {
    if (!open || !examId) return;
    setIndex(0);
    setElapsed(0);
    setAwayCount(0);
    setAwayNow(false);
    setSaveState("idle");
    try {
      const raw = window.localStorage.getItem(draftKey(examId));
      const parsed = raw ? JSON.parse(raw) : null;
      setAnswers(parsed?.answers || {});
      setFlagged(new Set(parsed?.flagged || []));
      setSavedAt(parsed?.savedAt || null);
    } catch {
      setAnswers({});
      setFlagged(new Set());
    }
  }, [open, examId]);

  const persist = useCallback(() => {
    if (!examId || !open) return;
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        if (!navigator.onLine) {
          setSaveState("offline");
          return;
        }
        const stamp = new Date().toLocaleTimeString();
        window.localStorage.setItem(
          draftKey(examId),
          JSON.stringify({ answers, flagged: Array.from(flagged), savedAt: stamp })
        );
        setSavedAt(stamp);
        setSaveState("saved");
      } catch {
        setSaveState("offline");
      }
    }, 600);
  }, [examId, open, answers, flagged]);

  useEffect(() => {
    if (open && Object.keys(answers).length) persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, flagged]);

  // ── Runner clock + leave-screen watcher (eSchool's away-timer signals) ──
  useEffect(() => {
    if (!open) return;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    const onVisibility = () => {
      if (document.hidden) {
        setAwayNow(true);
        setAwayCount((c) => c + 1);
      } else {
        setAwayNow(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open]);

  const current = questions[index];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;

  // Clear the local draft when the runner closes (nothing was ever submitted).
  const close = () => {
    onOpenChange(false);
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? close() : onOpenChange(v))}>
      <DialogContent className="max-w-5xl w-[95vw] sm:max-w-5xl p-0 gap-0 overflow-hidden">
        <div className="flex flex-col h-[85vh]">
          {/* Runner header: title · timer · autosave state */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--w11-border-subtle)]">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold truncate">
                {exam?.title || t("Exam runner", "परीक्षक रनर")}
              </h2>
              <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                {t(
                  "Preview mode — answers stay on this device, nothing is submitted.",
                  "पूर्वावलोकन — उत्तर यही यन्त्रमा मात्र, केही पेश हुँदैन।"
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1.5 text-xs font-mono" title={t("Autosave", "स्वतः-सुरक्षण")}>
                {saveState === "saving" ? (
                  <>
                    <CloudUpload className="h-3.5 w-3.5 animate-pulse" style={{ color: "var(--w11-accent)" }} />
                    <span style={{ color: "var(--w11-text-secondary)" }}>{t("Saving…", "सुरक्षित हुँदैछ…")}</span>
                  </>
                ) : saveState === "offline" ? (
                  <span className="flex items-center gap-1" style={{ color: "#d83b01" }}>
                    <AlertTriangle className="h-3.5 w-3.5" /> {t("Offline — not saved", "अफलाइन — सुरक्षित भएन")}
                  </span>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#107c10" }} />
                    <span style={{ color: "var(--w11-text-secondary)" }}>
                      {savedAt ? `${t("Saved", "सुरक्षित")} · ${savedAt}` : t("Autosave on", "स्वतः-सुरक्षण चालु")}
                    </span>
                  </>
                )}
              </span>
              {remaining !== null && (
                <span
                  className="flex items-center gap-1 text-sm font-mono px-2 py-1 rounded-md"
                  style={{
                    background: remaining < 60 ? "rgba(196,43,28,.1)" : "var(--w11-control-hover)",
                    color: remaining < 60 ? "#c42b1c" : "var(--w11-text-primary)",
                  }}
                >
                  <Clock className="h-4 w-4" /> {fmt(remaining)}
                </span>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close} aria-label={t("Close", "बन्द")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Leave-screen warning (eSchool's away counter) */}
          {(awayNow || awayCount > 0) && (
            <div className="win11-infobar warning flex items-center gap-2 px-4 py-2 text-sm m-0">
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#d83b01" }} />
              <span>
                {awayNow
                  ? t("You have left the exam screen — this is recorded.", "तपाईं परीक्षा स्क्रिनबाट हट्नुभयो — यो रेकर्ड गरियो।")
                  : t(
                      `You left the exam screen ${awayCount} time${awayCount > 1 ? "s" : ""} during this attempt. Stay on this page while testing.`,
                      `यस अवधिमा तपाईं ${awayCount} पटक स्क्रिनबाट हट्नुभयो। परीक्षा अवधिमा यही पानामा रहनुहोस्।`
                    )}
              </span>
            </div>
          )}

          {/* Body: palette sidebar (left) + question (right) */}
          <div className="flex flex-1 min-h-0">
            <aside
              className="w-56 shrink-0 border-r border-[var(--w11-border-subtle)] p-3 overflow-y-auto no-print"
              style={{ background: "var(--w11-control-hover)" }}
              aria-label={t("Question palette", "प्रश्न प्यालेट")}
            >
              <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: "var(--w11-text-secondary)" }}>
                {t("Question palette", "प्रश्न प्यालेट")} · {answeredCount}/{questions.length}
              </p>
              {isLoading ? (
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-8 rounded animate-pulse" style={{ background: "var(--w11-control-bg)" }} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {questions.map((q, i) => {
                    const answered = answers[q.id] !== undefined;
                    const isFlag = flagged.has(q.id);
                    return (
                      <button
                        key={q.id ?? i}
                        onClick={() => setIndex(i)}
                        aria-label={`${t("Question", "प्रश्न")} ${i + 1}`}
                        className="h-8 rounded text-xs font-semibold border transition-colors"
                        style={{
                          background: i === index ? "var(--w11-accent)" : answered ? "rgba(16,124,16,.12)" : "var(--w11-surface-solid, #fff)",
                          color: i === index ? "#fff" : answered ? "#107c10" : "var(--w11-text-primary)",
                          borderColor: isFlag ? "#d83b01" : "var(--w11-border-subtle)",
                        }}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 space-y-1 text-[10px]" style={{ color: "var(--w11-text-secondary)" }}>
                <p>□ {t("Not answered", "नभरेको")}</p>
                <p style={{ color: "#107c10" }}>■ {t("Answered", "भरिएको")}</p>
                <p style={{ color: "#d83b01" }}>▢ {t("Marked for review", "समीक्षा चिन्ह")}</p>
              </div>
            </aside>

            <section className="flex-1 min-w-0 p-6 overflow-y-auto">
              {!current ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                    {isLoading
                      ? t("Loading questions…", "प्रश्नहरू लोड हुँदैछन्…")
                      : t("This exam has no questions yet — add them from the question bank or AI generator.", "यो परीक्षामा अझै प्रश्न छैनन्।")}
                  </p>
                  {!isLoading && (
                    <Button variant="outline" size="sm" onClick={close}>
                      {t("Back to exams", "परीक्षा सूचीमा फर्कनुहोस्")}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
                      {t("Question", "प्रश्न")} {index + 1} / {questions.length}
                      {current.marks ? ` · ${current.marks} ${t("marks", "अंक")}` : ""}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() =>
                        setFlagged((prev) => {
                          const next = new Set(prev);
                          next.has(current.id) ? next.delete(current.id) : next.add(current.id);
                          return next;
                        })
                      }
                    >
                      <Flag className="h-3.5 w-3.5" style={flagged.has(current.id) ? { color: "#d83b01" } : undefined} />
                      {flagged.has(current.id) ? t("Flagged", "चिन्हित") : t("Mark for review", "समीक्षाका लागि")}
                    </Button>
                  </div>
                  <p className="text-[15px] leading-relaxed" style={{ color: "var(--w11-text-primary)" }}>
                    {qText(current)}
                  </p>
                  <div className="space-y-2">
                    {qOptions(current).map((opt, oi) => {
                      const selected = answers[current.id] === String(oi);
                      return (
                        <button
                          key={oi}
                          onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: String(oi) }))}
                          className="win11-card w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors"
                          style={{
                            margin: 0,
                            borderColor: selected ? "var(--w11-accent)" : undefined,
                            background: selected ? "var(--w11-accent-light, rgba(0,120,212,.08))" : undefined,
                          }}
                        >
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold shrink-0"
                            style={{
                              borderColor: selected ? "var(--w11-accent)" : "var(--w11-border-default)",
                              background: selected ? "var(--w11-accent)" : "transparent",
                              color: selected ? "#fff" : "inherit",
                            }}
                          >
                            {String.fromCharCode(65 + oi)}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--w11-border-subtle)]">
            <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> {t("Previous", "अघिल्लो")}
            </Button>
            <span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
              {t("Answered", "भरिएको")} {answeredCount} / {questions.length}
            </span>
            {index < questions.length - 1 ? (
              <Button size="sm" disabled={!current} onClick={() => setIndex((i) => i + 1)}>
                {t("Next", "अर्को")} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={!questions.length}
                onClick={() => {
                  toast.info(
                    t(
                      `Preview complete — ${answeredCount}/${questions.length} answered. Nothing was submitted.`,
                      `पूर्वावलोकन सम्पन्न — ${answeredCount}/${questions.length} भरियो। केही पेश भएन।`
                    )
                  );
                  close();
                }}
              >
                {t("Finish preview", "पूर्वावलोकन समाप्त")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
