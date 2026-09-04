"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";

type Thread = {
  id: string;
  teacher_id?: string;
  teacher_name?: string;
  updated_at?: string;
  last_message?: string;
};

type ChatMessage = {
  id: string;
  sender_role?: string;
  sender_name?: string;
  body?: string;
  content?: string;
  created_at?: string;
};

/** Parent → Messages. Backed by GET /parent/chat-threads and /parent/chat/<id>/messages. */
export default function ParentChatPage() {
  const qc = useQueryClient();
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const threads = useQuery({
    queryKey: ["parent-chat-threads"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Thread[]>>("/parent/chat-threads");
      return res.data.data || [];
    },
  });

  const messages = useQuery({
    queryKey: ["parent-chat-messages", activeThread],
    enabled: Boolean(activeThread),
    queryFn: async () => {
      const res = await api.get<ApiResponse<ChatMessage[]>>(
        `/parent/chat/${activeThread}/messages`
      );
      return res.data.data || [];
    },
  });

  const send = async () => {
    if (!activeThread || !draft.trim()) return;
    setSending(true);
    try {
      await api.post(`/parent/chat/${activeThread}/messages`, { body: draft.trim() });
      setDraft("");
      await qc.invalidateQueries({ queryKey: ["parent-chat-messages", activeThread] });
    } finally {
      setSending(false);
    }
  };

  if (threads.isLoading) return <PageLoader />;
  if (threads.isError)
    return <ErrorState title="Couldn't load messages" onRetry={() => threads.refetch()} />;

  const list = threads.data || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="parent" title="Messages" />
      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Conversations</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {list.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No conversations yet — a thread opens when you or a teacher message first.
              </p>
            )}
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveThread(t.id)}
                className={`w-full text-left rounded-md px-3 py-2 transition-colors ${
                  activeThread === t.id ? "bg-accent" : "hover:bg-muted"
                }`}
              >
                <p className="text-sm font-medium">{t.teacher_name || "Teacher"}</p>
                {t.last_message && (
                  <p className="text-xs text-muted-foreground truncate">{t.last_message}</p>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">
              {list.find((t) => t.id === activeThread)?.teacher_name || "Select a conversation"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <div className="flex-1 space-y-2 min-h-[240px] max-h-[420px] overflow-y-auto">
              {!activeThread && (
                <p className="text-sm text-muted-foreground">Pick a conversation to read it.</p>
              )}
              {activeThread && messages.isLoading && <PageLoader />}
              {activeThread &&
                (messages.data || []).map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      m.sender_role === "parent"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {m.body || m.content}
                  </div>
                ))}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                disabled={!activeThread}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button onClick={send} disabled={!activeThread || sending || !draft.trim()}>
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
