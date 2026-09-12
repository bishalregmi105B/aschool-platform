"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Save } from "lucide-react";
import { toast } from "sonner";

import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface WorkingHours {
  enabled: boolean;
  start: string;
  end: string;
  days: string[];
  off_hours_message: string;
}

interface AiSettings {
  auto_reply_enabled: boolean;
  ai_persona: string;
  working_hours: WorkingHours;
}

const DEFAULT_SETTINGS: AiSettings = {
  auto_reply_enabled: true,
  ai_persona: "",
  working_hours: {
    enabled: false,
    start: "09:00",
    end: "17:00",
    days: ["Sun", "Mon", "Tue", "Wed", "Thu"],
    off_hours_message: "",
  },
};

function normalizeSettings(raw: unknown): AiSettings {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<AiSettings>;
  const hours = (source.working_hours && typeof source.working_hours === "object"
    ? source.working_hours
    : {}) as Partial<WorkingHours>;
  return {
    auto_reply_enabled:
      typeof source.auto_reply_enabled === "boolean"
        ? source.auto_reply_enabled
        : DEFAULT_SETTINGS.auto_reply_enabled,
    ai_persona: typeof source.ai_persona === "string" ? source.ai_persona : "",
    working_hours: {
      enabled: typeof hours.enabled === "boolean" ? hours.enabled : DEFAULT_SETTINGS.working_hours.enabled,
      start: typeof hours.start === "string" && hours.start ? hours.start : DEFAULT_SETTINGS.working_hours.start,
      end: typeof hours.end === "string" && hours.end ? hours.end : DEFAULT_SETTINGS.working_hours.end,
      days: Array.isArray(hours.days) ? hours.days.filter((d): d is string => typeof d === "string") : DEFAULT_SETTINGS.working_hours.days,
      off_hours_message: typeof hours.off_hours_message === "string" ? hours.off_hours_message : "",
    },
  };
}

export default function WhatsAppAiSettingsPage() {
  return (
    <PluginGate slug="whatsapp_bot">
      <WhatsAppAiSettingsContent />
    </PluginGate>
  );
}

function WhatsAppAiSettingsContent() {
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<AiSettings | null>(null);

  // Persisted to the whatsapp_bot PLUGIN config (SchoolPlugin.config["ai_settings"])
  // — GET/PUT /plugins/whatsapp_bot/config — so the settings travel with the
  // plugin install like every other WP-style plugin setting.
  const {
    data: config,
    isLoading,
    isError,
    refetch,
  } = useQuery<Record<string, unknown>>({
    queryKey: ["whatsapp-plugin-config"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/plugins/whatsapp_bot/config");
      return (res.data.data as Record<string, unknown>) || {};
    },
    retry: 1,
  });

  useEffect(() => {
    if (config) setLocal(normalizeSettings((config as { ai_settings?: unknown }).ai_settings));
  }, [config]);

  const settings = local ?? DEFAULT_SETTINGS;

  const saveMutation = useMutation({
    mutationFn: async (payload: AiSettings) =>
      (await api.put("/plugins/whatsapp_bot/config", { ai_settings: payload })).data,
    onSuccess: () => {
      toast.success("AI settings saved");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-plugin-config"] });
    },
    onError: () => toast.error("Failed to save AI settings"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading AI settings…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="WhatsApp AI Settings" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load AI settings. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const update = (updater: (current: AiSettings) => AiSettings) => setLocal((c) => updater(c ?? settings));

  const toggleDay = (day: string) =>
    update((current) => ({
      ...current,
      working_hours: {
        ...current.working_hours,
        days: current.working_hours.days.includes(day)
          ? current.working_hours.days.filter((d) => d !== day)
          : [...current.working_hours.days, day],
      },
    }));

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bot className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="WhatsApp AI Settings"
        subtitle="Control how the WhatsApp bot talks to parents — persona, auto-replies, and working hours."
        actions={
          <Button
            onClick={() => saveMutation.mutate(settings)}
            disabled={saveMutation.isPending || !local}
          >
            {saveMutation.isPending ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        }
      />
      <AOSPageBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <DataPanel
            title={
              <span className="flex items-center gap-2 text-sm">
                <Bot className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                Bot Behaviour
              </span>
            }
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border border-[var(--w11-border-subtle)] p-4">
                <div>
                  <p className="font-medium" style={{ color: "var(--w11-text-primary)" }}>Auto-reply enabled</p>
                  <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                    When on, the bot answers matching inbound messages automatically.
                  </p>
                </div>
                <Switch
                  checked={settings.auto_reply_enabled}
                  onCheckedChange={(checked) =>
                    update((current) => ({ ...current, auto_reply_enabled: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>AI Persona</Label>
                <Textarea
                  rows={5}
                  value={settings.ai_persona}
                  onChange={(e) =>
                    update((current) => ({ ...current, ai_persona: e.target.value }))
                  }
                  placeholder="You are the friendly front-office assistant of the school. Reply politely in Nepali or English, keep answers short, and never invent fee amounts."
                />
                <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                  Shown as instructions to the AI when it drafts replies for parents.
                </p>
              </div>
            </div>
          </DataPanel>

          <DataPanel title={<span className="text-sm">Working Hours</span>}>
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border border-[var(--w11-border-subtle)] p-4">
                <div>
                  <p className="font-medium" style={{ color: "var(--w11-text-primary)" }}>Limit replies to working hours</p>
                  <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                    Outside these hours parents get the off-hours message instead.
                  </p>
                </div>
                <Switch
                  checked={settings.working_hours.enabled}
                  onCheckedChange={(checked) =>
                    update((current) => ({
                      ...current,
                      working_hours: { ...current.working_hours, enabled: checked },
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <TimePicker
                    value={settings.working_hours.start}
                    onChange={(v) =>
                      update((current) => ({
                        ...current,
                        working_hours: { ...current.working_hours, start: v },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End</Label>
                  <TimePicker
                    value={settings.working_hours.end}
                    onChange={(v) =>
                      update((current) => ({
                        ...current,
                        working_hours: { ...current.working_hours, end: v },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Working Days</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map((day) => {
                    const active = settings.working_hours.days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className="rounded-full border px-3 py-1 text-sm transition-colors"
                        style={
                          active
                            ? {
                                borderColor: "var(--w11-accent)",
                                background: "var(--w11-accent)",
                                color: "#fff",
                              }
                            : {
                                borderColor: "var(--w11-border-default)",
                                color: "var(--w11-text-primary)",
                              }
                        }
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Off-Hours Message</Label>
                <Textarea
                  rows={3}
                  value={settings.working_hours.off_hours_message}
                  onChange={(e) =>
                    update((current) => ({
                      ...current,
                      working_hours: { ...current.working_hours, off_hours_message: e.target.value },
                    }))
                  }
                  placeholder="The school office is closed right now. We will reply during working hours (Sun–Fri, 9am–5pm)."
                />
              </div>
            </div>
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
