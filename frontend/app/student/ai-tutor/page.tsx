"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";

type TurnResult = {
  reply?: string;
  response?: string;
  message?: string;
  content?: string;
  socratic_hint?: string;
  follow_ups?: string[];
};

/**
 * Student → AI Tutor. The real tutoring contract:
 *   POST /ai/tutor/plans            {topic}        → {plan_id}     (consent-gated)
 *   POST /ai/tutor/sessions         {plan_id}      → {session_id}
 *   POST /ai/tutor/sessions/<id>/turn {message}    → guided/socratic turn
 * Every turn passes the workbench guardrails (injection, moderation, quota).
 */
export default function StudentAiTutorPage() {
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "tutor" | "student"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);

  const startLesson = async () => {
    if (!topic.trim()) return;
    setStarting(true);
    setError(null);
    try {
      const plan = await api.post<ApiResponse<{ plan_id: string }>>("/ai/tutor/plans", {
        topic: topic.trim(),
      });
      const session = await api.post<ApiResponse<{ session_id: string }>>("/ai/tutor/sessions", {
        plan_id: plan.data.data.plan_id,
      });
      setSessionId(session.data.data.session_id);
      setMessages([
        {
          role: "tutor",
          text: `Let's work on “${topic.trim()}”. Tell me what you already know, and I'll guide you from there.`,
        },
      ]);
      setTopic("");
    } catch (e) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Couldn't start the session — try again shortly.";
      setError(msg);
    } finally {
      setStarting(false);
    }
  };

  const sendTurn = async () => {
    if (!sessionId || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    setMessages((m) => [...m, { role: "student", text }]);
    setThinking(true);
    try {
      const res = await api.post<ApiResponse<TurnResult>>(
        `/ai/tutor/sessions/${sessionId}/turn`,
        { message: text }
      );
      const data = res.data.data || {};
      const reply =
        data.reply || data.response || data.message || data.content ||
        (data.socratic_hint ? `${data.socratic_hint}` : "…");
      setMessages((m) => [...m, { role: "tutor", text: reply }]);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "The tutor couldn't respond — try again.";
      setMessages((m) => [...m, { role: "tutor", text: msg }]);
    } finally {
      setThinking(false);
      void qc.invalidateQueries({ queryKey: ["student-dashboard"] });
    }
  };

  return (
    <div className="space-y-6">
      <PortalHeader portal="student" title="AI Tutor" />
      <Card className="flex flex-col min-h-[480px]">
        <CardHeader>
          <CardTitle className="text-base">
            {sessionId ? "Session in progress" : "Start a study session"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3">
          {!sessionId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Name a topic and the tutor guides you with questions — it never hands you the
                answer. Guardian AI consent must be on for your account.
              </p>
              <div className="flex w-full max-w-md gap-2">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Quadratic equations"
                  onKeyDown={(e) => e.key === "Enter" && startLesson()}
                />
                <Button onClick={startLesson} disabled={starting || !topic.trim()}>
                  {starting ? "Starting…" : "Start"}
                </Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-2 min-h-[280px] max-h-[440px] overflow-y-auto">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === "student" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
                {thinking && (
                  <div className="bg-muted max-w-[80%] rounded-lg px-3 py-2 text-sm text-muted-foreground">
                    Thinking…
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Answer or ask…"
                  disabled={thinking}
                  onKeyDown={(e) => e.key === "Enter" && sendTurn()}
                />
                <Button onClick={sendTurn} disabled={thinking || !draft.trim()}>
                  Send
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
