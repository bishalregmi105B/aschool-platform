"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Bell, MessageCircle, Phone, Smartphone } from "lucide-react";

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
  attendance: { label: "Attendance Alerts", description: "Notify parents when student is marked absent" },
  fee_reminder: { label: "Fee Reminders", description: "Remind parents about overdue fee payments" },
  fee_payment: { label: "Payment Receipts", description: "Confirm payment to parent when fee is collected" },
  notice: { label: "Notices & Circulars", description: "Push new school notices to all users" },
  homework: { label: "Homework / Assignments", description: "Alert students & parents when homework is posted" },
  exam_result: { label: "Exam Results", description: "Notify when exam results are published" },
  gamification: { label: "Gamification", description: "Celebrate points, badges, and achievements" },
};

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NotificationConfig>({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      const r = await api.get("/schools/current/notification-settings");
      return r.data?.data;
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<NotificationConfig>) =>
      api.put("/schools/current/notification-settings", patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      toast.success("Notification settings saved.");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || "Failed to save settings"),
  });

  const toggleChannel = (
    channel: keyof Pick<NotificationConfig, "push_enabled" | "sms_enabled" | "whatsapp_enabled">
  ) => {
    if (!data) return;
    save.mutate({ [channel]: !data[channel] });
  };

  const toggleType = (type: string) => {
    if (!data) return;
    save.mutate({ types: { ...data.types, [type]: !data.types[type] } });
  };

  if (isLoading) return <PageLoader />;
  if (!data) return null;

  const channels = [
    { key: "push_enabled" as const, label: "Push Notifications", icon: Smartphone, color: "text-violet-600" },
    { key: "sms_enabled" as const, label: "SMS", icon: Phone, color: "text-blue-600" },
    { key: "whatsapp_enabled" as const, label: "WhatsApp", icon: MessageCircle, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" /> Notification Settings
        </h1>
        <p className="text-muted-foreground">
          Control which channels and event types are active for your school.
        </p>
      </div>

      {/* Global channel toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {channels.map((ch) => (
            <div key={ch.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ch.icon className={`h-5 w-5 ${ch.color}`} />
                <Label className="text-sm font-medium">{ch.label}</Label>
              </div>
              <Switch
                checked={data[ch.key]}
                onCheckedChange={() => toggleChannel(ch.key)}
                disabled={save.isPending}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Per-type toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {Object.entries(TYPE_LABELS).map(([key, meta]) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{meta.label}</p>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <Switch
                checked={data.types[key] ?? true}
                onCheckedChange={() => toggleType(key)}
                disabled={save.isPending}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {save.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" /> Saving…
        </div>
      )}
    </div>
  );
}
