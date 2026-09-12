"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

/**
 * Notification Matrix (A-02) — per-event × per-channel notification rules.
 * Rows are the school's known events (grouped by prefix: attendance., fees.,
 * exams., …), columns are the four channels, and each Switch shows the
 * EFFECTIVE state (default-on unless an override disables it). Toggling
 * upserts an override via PUT /notifications/rules; cells carrying an
 * explicit override get a dot that resets them to default (DELETE).
 */

type Channel = "push" | "sms" | "email" | "whatsapp";

interface RuleOverride {
  id: string;
  channel: string;
  audience_role: string | null;
  enabled: boolean;
  template_key?: string | null;
}

interface EventRules {
  event_key: string;
  channels: Record<Channel, boolean>;
  overrides: RuleOverride[];
}

interface RulesPayload {
  events: EventRules[];
  channels: Channel[];
}

const CHANNEL_META: { key: Channel; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "push", label: "Push", icon: Bell },
  { key: "sms", label: "SMS", icon: Smartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const GROUP_LABELS: Record<string, string> = {
  attendance: "Attendance",
  fees: "Fees",
  exams: "Exams",
  online_exam: "Online Exams",
  notice: "Notices",
  admission: "Admissions",
  assignment: "Assignments",
  timetable: "Timetable",
  library: "Library",
  incident: "Incidents",
  emergency: "Emergency",
  wellbeing: "Wellbeing",
  conference: "Conferences",
  sms: "SMS",
  website: "Website",
  gamification: "Gamification",
  file: "Files",
  iemis: "IEMIS",
  whatsapp: "WhatsApp",
  academics: "Academics",
};

function groupLabel(prefix: string): string {
  return (
    GROUP_LABELS[prefix] ??
    prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/_/g, " ")
  );
}

function eventLabel(eventKey: string): string {
  const tail = eventKey.split(".").slice(1).join(".") || eventKey;
  return tail.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NotificationMatrixPage() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["notification-rules"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RulesPayload>>("/notifications/rules");
      return res.data.data;
    },
    retry: 1,
  });

  const toggle = useMutation({
    mutationFn: (vars: { eventKey: string; channel: Channel; enabled: boolean }) =>
      api.put("/notifications/rules", {
        event_key: vars.eventKey,
        channel: vars.channel,
        enabled: vars.enabled,
      }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
      toast.success(
        `${vars.channel.toUpperCase()} ${vars.enabled ? "enabled" : "disabled"} for ${eventLabel(vars.eventKey)}`
      );
    },
    onError: () => toast.error("Failed to update notification rule"),
  });

  const reset = useMutation({
    mutationFn: (vars: { eventKey: string; channel: Channel; ruleIds: string[] }) =>
      Promise.all(
        vars.ruleIds.map((id) => api.delete(`/notifications/rules/${id}`))
      ),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
      toast.success(
        `${vars.channel.toUpperCase()} for ${eventLabel(vars.eventKey)} reset to default (on)`
      );
    },
    onError: () => toast.error("Failed to reset notification rule"),
  });

  const groups = useMemo(() => {
    const events = data?.events ?? [];
    const map = new Map<string, EventRules[]>();
    for (const e of events) {
      const prefix = e.event_key.split(".")[0] || "other";
      const list = map.get(prefix) ?? [];
      list.push(e);
      map.set(prefix, list);
    }
    return [...map.entries()];
  }, [data]);

  if (isLoading && !data) return <PageLoader />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Notification Matrix"
          subtitle="Choose which channel delivers each event."
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>
                Failed to load the notification matrix. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const busy = toggle.isPending || reset.isPending;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Notification Matrix"
        subtitle="Choose which channel delivers each event. Everything is on by default — switch a cell off to silence it."
      />
      <AOSPageBody>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[color:var(--w11-text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#9d5d00" }} />
            Custom override — click to reset to default
          </span>
          <span>Default for every event and channel: on.</span>
        </div>

        {groups.length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              icon={<Bell className="h-12 w-12" />}
              title="No notification events defined."
            />
          </DataPanel>
        ) : (
          <div className="space-y-5">
            {groups.map(([prefix, events]) => (
              <DataPanel
                key={prefix}
                title={
                  <span className="flex items-center justify-between">
                    {groupLabel(prefix)}
                    <span className="win11-chip">{events.length} events</span>
                  </span>
                }
                bodyClassName="p-0"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--w11-border-subtle)]" style={{ background: "var(--w11-control-hover)" }}>
                        <th className="px-3 py-2 text-left font-medium">Event</th>
                        {CHANNEL_META.map((c) => {
                          const Icon = c.icon;
                          return (
                            <th
                              key={c.key}
                              className="px-3 py-2 text-center font-medium w-28"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Icon className="h-4 w-4 text-[color:var(--w11-text-secondary)]" />
                                {c.label}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e) => (
                        <tr key={e.event_key} className="border-b border-[color:var(--w11-border-subtle)] last:border-b-0">
                          <td className="px-3 py-2">
                            <p className="font-medium">{eventLabel(e.event_key)}</p>
                            <p className="font-mono text-[11px] text-[color:var(--w11-text-secondary)]">
                              {e.event_key}
                            </p>
                          </td>
                          {CHANNEL_META.map((c) => {
                            const overrides = e.overrides.filter(
                              (o) => o.channel === c.key
                            );
                            const hasOverride = overrides.length > 0;
                            const cellPending =
                              toggle.isPending &&
                              toggle.variables?.eventKey === e.event_key &&
                              toggle.variables?.channel === c.key;
                            return (
                              <td key={c.key} className="px-3 py-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Switch
                                    checked={Boolean(e.channels[c.key])}
                                    disabled={busy}
                                    onCheckedChange={(checked) =>
                                      toggle.mutate({
                                        eventKey: e.event_key,
                                        channel: c.key,
                                        enabled: checked,
                                      })
                                    }
                                    aria-label={`${c.label} for ${e.event_key}`}
                                  />
                                  {hasOverride && (
                                    <button
                                      type="button"
                                      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center"
                                      title="Custom override — click to reset to default"
                                      aria-label={`Reset ${c.label} for ${e.event_key} to default`}
                                      onClick={() =>
                                        reset.mutate({
                                          eventKey: e.event_key,
                                          channel: c.key,
                                          ruleIds: overrides.map((o) => o.id),
                                        })
                                      }
                                    >
                                      <span className="block h-2.5 w-2.5 rounded-full" style={{ background: "#9d5d00", boxShadow: "0 0 0 2px rgba(157,93,0,.25)" }} />
                                    </button>
                                  )}
                                  {cellPending && (
                                    <span
                                      className="h-3 w-3 shrink-0 rounded-full border-2 border-t-transparent animate-spin"
                                      style={{ borderColor: "var(--w11-accent)", borderTopColor: "transparent" }}
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataPanel>
            ))}
          </div>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
