"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Users, ClipboardCheck, BookOpen, Calendar, Bell } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";
import {
  KpiCard,
  StatGrid,
  DataPanel,
  AOSModuleLoadingState,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

export default function TeacherDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: async () => {
      const res = await api.get("/analytics/teacher-dashboard");
      return res.data?.data;
    },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading teacher dashboard…" />;

  const stats = [
    { label: "My Classes", value: String(data?.stats?.my_classes || 0), icon: Users },
    { label: "Recent Notices", value: String(data?.stats?.recent_notices || 0), icon: ClipboardCheck },
    { label: "Assignments", value: String(data?.stats?.pending_assignments || 0), icon: BookOpen },
    { label: "Today's Periods", value: String(data?.stats?.todays_periods || 0), icon: Calendar },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          Good Morning, Teacher! 👋
        </h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          Here&apos;s your day at a glance
        </p>
      </div>

      <StatGrid min={200}>
        {stats.map((stat) => (
          <KpiCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={<stat.icon className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          />
        ))}
      </StatGrid>

      <div className="grid md:grid-cols-2 gap-4">
        <DataPanel
          title={
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Today&apos;s Schedule
            </span>
          }
        >
          <div className="space-y-3">
            {(data?.schedule || []).map((period: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-4 py-2 border-b border-[var(--w11-border-subtle)] last:border-0"
              >
                <span
                  className="text-sm w-28 flex-shrink-0"
                  style={{ color: "var(--w11-text-secondary)" }}
                >
                  {period.time}
                </span>
                <span className="font-medium" style={{ color: "var(--w11-text-primary)" }}>
                  {period.subject}
                </span>
                <span className="text-sm ml-auto" style={{ color: "var(--w11-text-secondary)" }}>
                  {period.class_name}
                </span>
              </div>
            ))}
            {(data?.schedule || []).length === 0 && (
              <AOSEmptyState title="No timetable slots assigned for today." />
            )}
          </div>
        </DataPanel>

        <DataPanel
          title={
            <span className="inline-flex items-center gap-2">
              <Bell className="h-4 w-4" /> Recent Notices
            </span>
          }
        >
          <div className="space-y-3">
            {(data?.notices || []).map((notice: any, i: number) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 border-b border-[var(--w11-border-subtle)] last:border-0"
              >
                <div
                  className="w-2 h-2 mt-2"
                  style={{
                    background: notice.urgent ? "var(--w11-accent)" : "var(--w11-border-strong)",
                    borderRadius: "var(--w11-radius-full)",
                  }}
                />
                <div>
                  <p className="font-medium text-sm" style={{ color: "var(--w11-text-primary)" }}>
                    {notice.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                    {notice.date ? displayBS(notice.date) : "—"}
                  </p>
                </div>
              </div>
            ))}
            {(data?.notices || []).length === 0 && (
              <AOSEmptyState title="No recent notices." />
            )}
          </div>
        </DataPanel>
      </div>
    </div>
  );
}
