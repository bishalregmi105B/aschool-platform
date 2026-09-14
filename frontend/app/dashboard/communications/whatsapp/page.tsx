"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FormSection,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { useI18n } from "@/lib/i18n";
import {
  MessageSquare,
  Plus,
  Save,
  Trash2,
  FlaskConical,
  History,
  Sparkles,
} from "lucide-react";

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
  const { t } = useI18n();
  const [draftReply, setDraftReply] = useState<AutoReply>({
    keyword: "",
    response: "",
    match_type: "contains",
  });
  const [testPhone, setTestPhone] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

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

  // Test-connection: POST /whatsapp-bot/send already returns the honest
  // {skipped|error|success} shape — surfaced inline (plan 6.1-10 / 48.5).
  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/whatsapp-bot/send", {
        to: testPhone.trim(),
        message: "ASchool WhatsApp test message ✅",
      });
      return res.data;
    },
    onSuccess: (d) => {
      const r = d?.data || {};
      if (r.skipped) {
        setTestResult({
          ok: false,
          msg: t(
            "Not configured — the school has no WhatsApp credentials on the server.",
            "कन्फिगर भएको छैन — सर्भरमा WhatsApp क्रेडेन्स छैन।"
          ),
        });
      } else if (r.error) {
        setTestResult({ ok: false, msg: `WhatsApp API: ${typeof r.error === "string" ? r.error : r.error?.message || "error"}` });
      } else {
        setTestResult({ ok: true, msg: t("Test message delivered.", "जाँच सन्देश पठाइयो।") });
      }
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setTestResult({ ok: false, msg: e?.response?.data?.error || t("Send failed", "पठाउन सकिएन") });
    },
  });

  const setConfig = (updater: (current: WhatsAppConfig) => WhatsAppConfig) => {
    const current = localConfig ?? data;
    if (!current) return;
    setLocalConfig(updater(current));
  };

  if (isLoading || !config) return <AOSModuleLoadingState label="Loading WhatsApp settings…" />;

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
    <AOSPage>
      <AOSPageHeader
        icon={<MessageSquare className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="WhatsApp Bot"
        subtitle="Configure automated replies and parent-facing notifications."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/communications/whatsapp/conversations">
              <Button variant="outline" size="sm">
                <History className="h-4 w-4 mr-2" />
                {t("Conversations", "संवादहरू")}
              </Button>
            </Link>
            <Link href="/dashboard/communications/whatsapp/ai-settings">
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                {t("AI Settings", "AI सेटिङ")}
              </Button>
            </Link>
            <Button
              onClick={() => saveMutation.mutate(localConfig ?? config)}
              disabled={saveMutation.isPending || !localConfig}
            >
              {saveMutation.isPending ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {localConfig
                ? t("Save Changes", "परिवर्तन सेभ")
                : t("Saved", "सेभ भइसकेको")}
            </Button>
          </div>
        }
      />
      <AOSPageBody>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <DataPanel
            title={
              <span className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />
                Bot Settings
              </span>
            }
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border border-[var(--w11-border-subtle)] p-4">
                <div>
                  <p className="font-medium" style={{ color: "var(--w11-text-primary)" }}>Enable WhatsApp bot</p>
                  <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
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
                        className="rounded-lg border px-4 py-3 text-left text-sm transition-colors"
                        style={
                          active
                            ? {
                                borderColor: "var(--w11-accent)",
                                background: "var(--w11-accent-light)",
                              }
                            : {
                                borderColor: "var(--w11-border-default)",
                              }
                        }
                      >
                        <div className="font-medium" style={{ color: active ? "var(--w11-accent)" : "var(--w11-text-primary)" }}>{option.label}</div>
                        <div style={{ color: "var(--w11-text-secondary)" }}>
                          {active ? "Enabled" : "Disabled"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </DataPanel>

          <DataPanel title="Auto Replies">
            <div className="space-y-4">
              <FormSection>
                <div className="space-y-3">
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
              </FormSection>

              <div className="space-y-3">
                {config.auto_replies.length === 0 ? (
                  <div
                    className="rounded-lg border border-dashed border-[var(--w11-border-default)] p-6 text-sm"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    No auto-reply rules configured yet.
                  </div>
                ) : (
                  config.auto_replies.map((reply, index) => (
                    <div key={`${reply.keyword}-${index}`} className="rounded-lg border border-[var(--w11-border-subtle)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{reply.keyword}</p>
                          <p className="mt-1 text-sm" style={{ color: "var(--w11-text-secondary)" }}>{reply.response}</p>
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
            </div>
          </DataPanel>

          <DataPanel
            className="lg:col-span-2"
            title={
              <span className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                {t("Test connection", "कनेक्सन जाँच")}
              </span>
            }
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wa-test">{t("Your WhatsApp number", "तपाईंको WhatsApp नम्बर")}</Label>
                <Input
                  id="wa-test"
                  value={testPhone}
                  onChange={(e) => { setTestPhone(e.target.value); setTestResult(null); }}
                  placeholder="+97798XXXXXXXX"
                  className="w-[220px]"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={!/^\+?[0-9]{7,15}$/.test(testPhone.trim()) || testMutation.isPending}
              >
                {testMutation.isPending ? <Spinner className="mr-2" /> : null}
                {t("Send test message", "जाँच सन्देश पठाउनुहोस्")}
              </Button>
              <p className="text-[11px] flex-1" style={{ color: "var(--w11-text-secondary)" }}>
                {t(
                  "Uses the real Cloud API and is recorded in the audit trail like any staff message.",
                  "वास्तविक Cloud API प्रयोग गर्छ र अडिट ट्रेलमा रेकर्ड हुन्छ।"
                )}
              </p>
            </div>
            {testResult && (
              <div className={`win11-infobar ${testResult.ok ? "success" : "error"} mt-3 text-[12px]`} style={{ padding: "8px 12px" }}>
                {testResult.msg}
              </div>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
