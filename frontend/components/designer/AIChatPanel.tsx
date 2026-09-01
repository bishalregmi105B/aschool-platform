"use client";

/**
 * AIChatPanel — agent chat for the Design Studio + Writer.
 *
 * The backend (/design-studio/ai/agent) returns structured actions; this
 * component executes them against the live editor surface:
 *  - designer mode: fabric canvas (add text / retitle / recolor / replace selection)
 *  - writer mode: TipTap editor (insert at cursor / replace selection / bullets)
 *
 * Every call is quota-tracked server-side via AITokenHub.
 */
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, Sparkles, X } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatMsg = { role: "user" | "assistant"; content: string };
type AgentAction = { action: string; [k: string]: unknown };
type AgentResponse = {
  reply: string;
  content?: string | null;
  actions?: AgentAction[];
  tokens_used?: number;
};

export interface AIChatPanelProps {
  mode: "designer" | "writer";
  /** execute one agent action against the canvas or document */
  executeAction: (action: AgentAction) => void;
  /** editor snapshot included with each request */
  getContext: () => Record<string, unknown>;
  onClose?: () => void;
}

const QUICK_PROMPTS: Record<"designer" | "writer", string[]> = {
  designer: [
    "Write a Children's Day poster headline and message",
    "Generate text for a merit certificate",
    "Give me a short Parents' Day invitation message",
    "Nepali text for a school anniversary banner",
  ],
  writer: [
    "Draft a fee-deadline notice for parents",
    "Write a Grade 5 science lesson plan outline (45 min)",
    "Draft a leave-approval letter for a teacher",
    "Write minutes of a PTA meeting",
  ],
};

export function AIChatPanel({ mode, executeAction, getContext, onClose }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const mutation = useMutation({
    mutationFn: async (history: ChatMsg[]) => {
      const r = await api.post("/design-studio/ai/agent", {
        messages: history,
        mode,
        context: getContext(),
      });
      return r.data?.data as AgentResponse;
    },
    onSuccess: (data) => {
      setMessages((prev) => {
        const next = [...prev, { role: "assistant" as const, content: data.reply || "Done." }];
        return next;
      });
      scrollToBottom();
      for (const action of data.actions || []) {
        try {
          executeAction(action);
        } catch {
          /* one bad action must not kill the rest */
        }
      }
      if ((data.actions || []).length === 0 && data.content) {
        // fallback: surface generated content even without structured actions
        executeAction({ action: mode === "designer" ? "add_text" : "insert_text_at_cursor", text: data.content });
      }
    },
    onError: (e: any) => {
      const msg = e?.response?.status === 429
        ? "AI quota exceeded — contact your school admin."
        : e?.response?.data?.message || "AI request failed";
      toast.error(msg);
    },
  });

  const send = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || mutation.isPending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    scrollToBottom();
    mutation.mutate(next);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-violet-600" />
        <span className="text-xs font-semibold">AI Assistant</span>
        <span className="text-[10px] text-muted-foreground ml-1">{mode === "designer" ? "canvas" : "document"}</span>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground" title="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] text-muted-foreground">Ask me to write or edit anything — I can add it straight onto your {mode === "designer" ? "canvas" : "document"}:</p>
            {QUICK_PROMPTS[mode].map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="block w-full text-left text-[11px] px-2 py-1.5 rounded-md border bg-muted/40 hover:bg-muted"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-[11px] leading-relaxed whitespace-pre-wrap rounded-lg px-2.5 py-1.5 max-w-[92%] ${
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-muted"
            }`}
          >
            {m.content}
          </div>
        ))}
        {mutation.isPending && (
          <div className="mr-auto bg-muted rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      {/* composer */}
      <form
        className="flex items-center gap-1.5 px-2 py-2 border-t shrink-0"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "designer" ? "e.g. Add a sports-day headline…" : "e.g. Draft a notice about…"}
          className="h-8 text-xs"
        />
        <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={mutation.isPending || !input.trim()}>
          {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </form>
    </div>
  );
}
