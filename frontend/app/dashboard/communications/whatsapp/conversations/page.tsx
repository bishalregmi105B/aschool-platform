"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, MessageSquare, Phone, Send, User } from "lucide-react";
import { toast } from "sonner";

import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

interface Conversation {
  phone: string;
  inbound_count: number;
  outbound_count: number;
  last_message: string | null;
  last_message_at: string | null;
  status: "handled" | "unhandled";
}

interface ConversationMessage {
  id: string;
  direction: "inbound" | "outbound";
  content: string | null;
  message_type: string | null;
  status: string | null;
  is_bot_reply: boolean;
  handled: boolean | null;
  created_at: string | null;
}

export default function WhatsAppConversationsPage() {
  return (
    <PluginGate slug="whatsapp_bot">
      <WhatsAppConversationsContent />
    </PluginGate>
  );
}

function formatMessageTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function WhatsAppConversationsContent() {
  const queryClient = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const {
    data: conversations,
    isLoading,
    isError,
    refetch,
  } = useQuery<Conversation[]>({
    queryKey: ["whatsapp-conversations"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/whatsapp-bot/conversations");
      return (res.data.data as Conversation[]) || [];
    },
    retry: 1,
  });

  const {
    data: messages,
    isLoading: messagesLoading,
    isError: messagesError,
  } = useQuery<ConversationMessage[]>({
    queryKey: ["whatsapp-conversation", selectedPhone],
    queryFn: async () => {
      const res = await api.get<ApiResponse>(
        `/whatsapp-bot/conversations/${encodeURIComponent(selectedPhone || "")}/messages`
      );
      return (res.data.data as ConversationMessage[]) || [];
    },
    enabled: !!selectedPhone,
    retry: 1,
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/whatsapp-bot/send", {
        to: selectedPhone,
        message: replyDraft,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Reply sent");
      setReplyDraft("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversation", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
    onError: () => toast.error("Failed to send reply"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading conversations…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="WhatsApp Conversations" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load conversations. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<MessageSquare className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="WhatsApp Conversations"
        subtitle={`${conversations?.length || 0} ${conversations?.length === 1 ? "thread" : "threads"} — every inbound message with its bot / staff replies`}
      />
      <AOSPageBody>
        {(conversations || []).length === 0 ? (
          <DataPanel>
            <div className="py-10 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>
              No WhatsApp conversations yet. Messages sent to the school WhatsApp number will appear here.
            </div>
          </DataPanel>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Conversation list */}
            <DataPanel title={<span className="text-sm">Conversations ({conversations?.length || 0})</span>}>
              <div className="space-y-2">
                {(conversations || []).map((conversation) => (
                  <button
                    key={conversation.phone}
                    type="button"
                    onClick={() => setSelectedPhone(conversation.phone)}
                    className="w-full rounded-lg border p-3 text-left transition-colors"
                    style={
                      selectedPhone === conversation.phone
                        ? {
                            borderColor: "var(--w11-accent)",
                            background: "var(--w11-accent-light)",
                          }
                        : {
                            borderColor: "var(--w11-border-default)",
                          }
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-medium" style={{ color: "var(--w11-text-primary)" }}>
                        <Phone className="h-3.5 w-3.5" style={{ color: "var(--w11-text-secondary)" }} />
                        {conversation.phone}
                      </p>
                      <span className={`win11-chip text-xs ${conversation.status === "handled" ? "subtle" : "error"}`}>
                        {conversation.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                      {conversation.last_message || "—"}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                      {conversation.inbound_count} in · {conversation.outbound_count} out ·{" "}
                      {formatMessageTime(conversation.last_message_at)}
                    </p>
                  </button>
                ))}
              </div>
            </DataPanel>

            {/* Message thread */}
            <DataPanel
              className="flex flex-col"
              title={
                <span className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                  {selectedPhone ? `Thread · ${selectedPhone}` : "Select a conversation"}
                </span>
              }
            >
              <div className="space-y-3">
                {!selectedPhone ? (
                  <p className="py-8 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                    Pick a conversation on the left to read the full history.
                  </p>
                ) : messagesLoading ? (
                  <div className="py-8 flex justify-center"><Spinner /></div>
                ) : messagesError ? (
                  <div className="py-6 text-center space-y-2">
                    <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load messages.</p>
                    <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["whatsapp-conversation", selectedPhone] })}>
                      Retry
                    </Button>
                  </div>
                ) : (messages || []).length === 0 ? (
                  <p className="py-8 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>No messages in this thread.</p>
                ) : (
                  <div className="space-y-3">
                    {(messages || []).map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className="max-w-[80%] rounded-lg px-3 py-2 text-sm"
                          style={
                            message.direction === "outbound"
                              ? {
                                  background: "var(--w11-accent)",
                                  color: "#fff",
                                }
                              : {
                                  background: "var(--w11-control-hover)",
                                  color: "var(--w11-text-primary)",
                                }
                          }
                        >
                          <p className="flex items-center gap-1 text-xs opacity-70">
                            {message.direction === "outbound" ? (
                              <>{message.is_bot_reply ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />} {message.is_bot_reply ? "Bot" : "Staff"}</>
                            ) : (
                              <><User className="h-3 w-3" /> Parent</>
                            )}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words">{message.content || `(${message.message_type || "message"})`}</p>
                          <p className="mt-1 text-right text-xs opacity-70">
                            {formatMessageTime(message.created_at)}
                            {message.direction === "inbound" && message.handled !== null && (
                              <span className="ml-2">{message.handled ? "handled" : "unhandled"}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPhone && (
                <div className="mt-4 pt-4 border-t border-[var(--w11-border-subtle)]">
                  <div className="flex gap-2">
                    <Textarea
                      rows={2}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Type your reply…"
                    />
                    <Button
                      size="icon"
                      disabled={!replyDraft.trim() || replyMutation.isPending}
                      onClick={() => replyMutation.mutate()}
                    >
                      {replyMutation.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                    Sends via the WhatsApp Cloud API; replies are recorded in the thread.
                  </p>
                </div>
              )}
            </DataPanel>
          </div>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
