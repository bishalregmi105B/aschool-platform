"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Bot, MessageSquare, Phone, Send, User } from "lucide-react";
import { toast } from "sonner";

import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

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

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load conversations. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/communications/whatsapp">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">WhatsApp Conversations</h1>
          <p className="text-muted-foreground">
            Every inbound WhatsApp message with its bot / staff replies.
          </p>
        </div>
      </div>

      {(conversations || []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No WhatsApp conversations yet. Messages sent to the school WhatsApp number will appear here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Conversation list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Conversations ({conversations?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(conversations || []).map((conversation) => (
                <button
                  key={conversation.phone}
                  type="button"
                  onClick={() => setSelectedPhone(conversation.phone)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedPhone === conversation.phone
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-medium">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {conversation.phone}
                    </p>
                    <Badge
                      variant={conversation.status === "handled" ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {conversation.status}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {conversation.last_message || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {conversation.inbound_count} in · {conversation.outbound_count} out ·{" "}
                    {formatMessageTime(conversation.last_message_at)}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Message thread */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                {selectedPhone ? `Thread · ${selectedPhone}` : "Select a conversation"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {!selectedPhone ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Pick a conversation on the left to read the full history.
                </p>
              ) : messagesLoading ? (
                <PageLoader />
              ) : messagesError ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-sm text-destructive">Failed to load messages.</p>
                  <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["whatsapp-conversation", selectedPhone] })}>
                    Retry
                  </Button>
                </div>
              ) : (messages || []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No messages in this thread.</p>
              ) : (
                <div className="space-y-3">
                  {(messages || []).map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          message.direction === "outbound"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
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
            </CardContent>

            {selectedPhone && (
              <CardContent className="border-t">
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Sends via the WhatsApp Cloud API; replies are recorded in the thread.
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
