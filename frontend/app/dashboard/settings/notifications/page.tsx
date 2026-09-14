"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Bell, MessageCircle, Phone, Smartphone } from "lucide-react";
import { AOSModuleLoadingState } from "@/components/aos/kit/page-kit";
import { SettingsPage } from "../settings-page";
import { SettingsSection, SettingField, useSectionSave } from "../settings-section";

interface NotificationConfig {
  push_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  types: {
    attendance: boolean;
    fee_reminder: boolean;
    fee_payment: boolean;
    notice: boolean;
    homework: boolean;
    exam_result: boolean;
    gamification: boolean;
    [key: string]: boolean;
  };
}

const TYPE_LABELS: Record<string, { label: string; description: string }> = {
  attendance: { label: "Attendance Alerts", description: "Parents are notified when a student is marked absent." },
  fee_reminder: { label: "Fee Reminders", description: "Parents receive a reminder when a fee becomes overdue." },
  fee_payment: { label: "Payment Receipts", description: "A receipt confirmation is sent when a fee is collected." },
  notice: { label: "Notices & Circulars", description: "New school notices are pushed to every user of this school." },
  homework: { label: "Homework / Assignments", description: "Students and parents are alerted when homework is posted." },
  exam_result: { label: "Exam Results", description: "Users are notified when exam results are published." },
  gamification: { label: "Gamification", description: "Celebration messages for points, badges and achievements." },
};

type ChannelValues = Record<string, boolean>;
type TypeValues = Record<string, boolean>;

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<NotificationConfig>({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      const r = await api.get("/schools/current/notification-settings");
      return r.data?.data;
    },
    retry: 1,
  });

  const channelInitial = useMemo<ChannelValues>(
    () => ({
      push_enabled: data?.push_enabled ?? false,
      sms_enabled: data?.sms_enabled ?? false,
      whatsapp_enabled: data?.whatsapp_enabled ?? false,
    }),
    [data],
  );
  const typesInitial = useMemo<TypeValues>(
    () => Object.fromEntries(Object.keys(TYPE_LABELS).map((k) => [k, data?.types?.[k] ?? true])),
    [data],
  );

  const channels = useSectionSave<ChannelValues>(channelInitial, async (v) => {
    await api.put("/schools/current/notification-settings", v);
    queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
  });
  const types = useSectionSave<TypeValues>(typesInitial, async (v) => {
    await api.put("/schools/current/notification-settings", { types: v });
    queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
  });

  if (isError || (!isLoading && !data)) {
    return (
      <SettingsPage
        active="notifications"
        icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Notification Settings"
        titleNe="सूचना सेटिङ"
        subtitle="Control which channels and event types are active for your school"
      >
        <div className="win11-infobar error">
          <div>
            <p className="text-sm font-medium">Couldn&rsquo;t load notification settings</p>
            <p className="text-xs mt-1">The settings service didn&rsquo;t respond — retry to load them again.</p>
          </div>
          <button className="win11-btn" onClick={() => refetch()}>Retry</button>
        </div>
      </SettingsPage>
    );
  }
  if (isLoading || !data) return <AOSModuleLoadingState label="Loading notification settings…" />;

  const channelDefs = [
    { key: "push_enabled" as const, label: "Push Notifications", icon: Smartphone, help: "Mobile app push alerts to the signed-in device. Needs the school app installed." },
    { key: "sms_enabled" as const, label: "SMS", icon: Phone, help: "Text alerts via the SMS gateway — costs credits per message (see the SMS plugin)." },
    { key: "whatsapp_enabled" as const, label: "WhatsApp", icon: MessageCircle, help: "Sends event alerts through the connected WhatsApp Business account." },
  ];

  return (
    <SettingsPage
      active="notifications"
      icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
      title="Notification Settings"
      subtitle="Channels decide where alerts go; event types decide what is sent"
    >
      <div className="space-y-4 max-w-3xl">
        {/* ── Channels ── */}
        <SettingsSection
          title="Notification Channels"
          description="A channel must be on here before any event can be delivered through it."
          form={channels}
        >
          <div className="space-y-4">
            {channelDefs.map((ch) => (
              <SettingField key={ch.key} label={ch.label} help={ch.help}>
                <div className="flex items-center gap-3">
                  <ch.icon className="h-4 w-4 shrink-0" style={{ color: "var(--w11-accent)" }} />
                  <Switch
                    checked={Boolean(channels.values[ch.key])}
                    disabled={channels.saving}
                    onCheckedChange={(c) => channels.setField({ [ch.key]: c })}
                    aria-label={ch.label}
                  />
                  <span className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                    {channels.values[ch.key] ? "On" : "Off"}
                  </span>
                </div>
              </SettingField>
            ))}
            {channels.saving && (
              <p className="flex items-center gap-2 text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                <Spinner size="sm" /> Saving channels…
              </p>
            )}
          </div>
        </SettingsSection>

        {/* ── Event types ── */}
        <SettingsSection
          title="Notification Types"
          description="Which events generate notifications (delivered via the channels above)."
          form={types}
        >
          <div className="space-y-4">
            {Object.entries(TYPE_LABELS).map(([key, meta]) => (
              <SettingField key={key} label={meta.label} help={meta.description}>
                <Switch
                  checked={Boolean(types.values[key])}
                  disabled={types.saving}
                  onCheckedChange={(c) => types.setField({ [key]: c })}
                  aria-label={meta.label}
                />
              </SettingField>
            ))}
          </div>
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}
