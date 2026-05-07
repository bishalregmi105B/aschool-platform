"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type AutoReply = {
  keyword: string;
  response: string;
  match_type: string;
};

type WhatsAppConfig = {
  enabled: boolean;
  welcome_message: string;
  auto_replies: AutoReply[];
  notification_types: string[];
  language?: string;
};

const NOTIFICATION_OPTIONS = [
  { value: "attendance", label: "Attendance" },
  { value: "fee_reminder", label: "Fee Reminders" },
  { value: "results", label: "Results" },
  { value: "notices", label: "Notices" },
];

export default function WhatsAppSettingsPage() {
  return (
    <PluginGate slug="whatsapp_bot">
      <WhatsAppSettingsContent />
    </PluginGate>
  );
}

function WhatsAppSettingsContent() {
  const [draftReply, setDraftReply] = useState<AutoReply>({
    keyword: "",
    response: "",
    match_type: "contains",
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-bot-config"],
    queryFn: async () => {
      const response = await api.get("/whatsapp-bot/config");
      return response.data?.data as WhatsAppConfig;
    },
  });

  const [localConfig, setLocalConfig] = useState<WhatsAppConfig | null>(null);

  const config = localConfig ?? data ?? null;

  const saveMutation = useMutation({
    mutationFn: async (payload: WhatsAppConfig) =>
      api.put("/whatsapp-bot/config", {
        is_enabled: payload.enabled,
        welcome_message: payload.welcome_message,
        auto_replies: payload.auto_replies,
        notification_types: payload.notification_types,
        language: payload.language || "en",
      }),
    onSuccess: async () => {
      toast.success("WhatsApp settings saved");
      setLocalConfig(null);
      await refetch();
    },
    onError: () => toast.error("Failed to save WhatsApp settings"),
  });

  const setConfig = (updater: (current: WhatsAppConfig) => WhatsAppConfig) => {
    const current = localConfig ?? data;
    if (!current) return;
    setLocalConfig(updater(current));
  };

  if (isLoading || !config) return <PageLoader />;

  const addReply = () => {
    if (!draftReply.keyword.trim() || !draftReply.response.trim()) {
      toast.error("Keyword and response are required");
      return;
    }
    setConfig((current) => ({
      ...current,
      auto_replies: [...current.auto_replies, draftReply],
    }));
    setDraftReply({ keyword: "", response: "", match_type: "contains" });
  };

  const removeReply = (index: number) => {
    setConfig((current) => ({
      ...current,
      auto_replies: current.auto_replies.filter((_, replyIndex) => replyIndex !== index),
    }));
  };

  const toggleNotification = (value: string) => {
    setConfig((current) => {
      const active = current.notification_types.includes(value);
      return {
        ...current,
        notification_types: active
          ? current.notification_types.filter((item) => item !== value)
          : [...current.notification_types, value],
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/communications">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">WhatsApp Bot</h1>
          <p className="text-muted-foreground">
            Configure automated replies and parent-facing notifications.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate(localConfig ?? config)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Bot Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Enable WhatsApp bot</p>
                <p className="text-sm text-muted-foreground">
                  Allow parents to receive automated replies and outbound updates.
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) =>
                  setConfig((current) => ({ ...current, enabled: checked }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Welcome Message</Label>
              <Textarea
                rows={4}
                value={config.welcome_message}
                onChange={(e) =>
                  setConfig((current) => ({
                    ...current,
                    welcome_message: e.target.value,
                  }))
                }
                placeholder="Namaste! How can we help today?"
              />
            </div>

            <div className="space-y-3">
              <Label>Notification Types</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {NOTIFICATION_OPTIONS.map((option) => {
                  const active = config.notification_types.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleNotification(option.value)}
                      className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                        active ? "border-primary bg-primary/5" : "hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-muted-foreground">
                        {active ? "Enabled" : "Disabled"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto Replies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-2">
                <Label>Keyword</Label>
                <Input
                  value={draftReply.keyword}
                  onChange={(e) =>
                    setDraftReply((current) => ({ ...current, keyword: e.target.value }))
                  }
                  placeholder="fees"
                />
              </div>
              <div className="space-y-2">
                <Label>Response</Label>
                <Textarea
                  rows={3}
                  value={draftReply.response}
                  onChange={(e) =>
                    setDraftReply((current) => ({ ...current, response: e.target.value }))
                  }
                  placeholder="Please send your ward's admission number to check fee status."
                />
              </div>
              <Button type="button" variant="outline" onClick={addReply}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>

            <div className="space-y-3">
              {config.auto_replies.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No auto-reply rules configured yet.
                </div>
              ) : (
                config.auto_replies.map((reply, index) => (
                  <div key={`${reply.keyword}-${index}`} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{reply.keyword}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{reply.response}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeReply(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
