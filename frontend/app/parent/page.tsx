"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { CalendarCheck, CreditCard, Bus, Bell, Heart, Users } from "lucide-react";
import {
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

type ParentChild = {
  id: string;
  name: string;
  class_name?: string;
  roll_no?: number;
  attendance_pct?: number;
  fees_due?: number;
  today_status?: string | null;
};

type ParentNotice = {
  id: string;
  title: string;
  date?: string;
};

type ParentDashboardPayload = {
  children: ParentChild[];
  recent_notices: ParentNotice[];
};

export default function ParentDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["parent-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ParentDashboardPayload>>("/parent/dashboard");
      return res.data.data;
    },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading parent dashboard…" />;

  const children = data?.children || [];
  const notices = data?.recent_notices || [];
  const totalDue = children.reduce((sum, child) => sum + (child.fees_due || 0), 0);
  const avgAttendance = children.length
    ? Math.round(children.reduce((sum, child) => sum + (child.attendance_pct || 0), 0) / children.length)
    : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          Welcome, Parent
        </h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          Track all linked children from one account
        </p>
      </div>

      <StatGrid min={170}>
        <a key="Linked Children" href="/parent">
          <KpiCard label="Linked Children" value={children.length} footnote="Active links" icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </a>
        <a key="Attendance" href="/parent/attendance">
          <KpiCard label="Attendance" value={`${avgAttendance}%`} footnote="Average" icon={<CalendarCheck className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </a>
        <a key="Due Fees" href="/parent/fees">
          <KpiCard label="Due Fees" value={`Rs. ${totalDue.toLocaleString()}`} footnote="Across children" icon={<CreditCard className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </a>
        <a key="Bus Status" href="/parent/bus">
          <KpiCard label="Bus Status" value="Live" footnote="Track routes" icon={<Bus className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </a>
        <a key="Notices" href="/parent/notices">
          <KpiCard label="Notices" value={notices.length} footnote="Recent" icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </a>
        <a key="Wellbeing" href="/parent/wellbeing">
          <KpiCard label="Wellbeing" value="View" footnote="Mood & notes" icon={<Heart className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </a>
      </StatGrid>

      <DataPanel title="Children Overview">
        <div className="space-y-3">
          {children.length === 0 && (
            <AOSEmptyState title="No students are linked to this parent account yet." />
          )}
          {children.map((child) => (
            <div
              key={child.id}
              className="border border-[var(--w11-border-default)] rounded-lg p-3 flex items-center gap-3"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                style={{
                  background: "var(--w11-accent)",
                  color: "var(--w11-accent-text)",
                  borderRadius: "var(--w11-radius-full)",
                }}
              >
                {(child.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{child.name}</p>
                <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                  {child.class_name || "Class not assigned"}
                  {child.roll_no ? ` • Roll ${child.roll_no}` : ""}
                </p>
              </div>
              <div className="text-right">
                <StatusChip
                  status={child.today_status === "present" ? "present" : "pending"}
                  label={child.today_status || "Not marked"}
                />
                <p className="text-xs mt-1" style={{ color: "var(--w11-text-secondary)" }}>
                  Due: Rs. {(child.fees_due || 0).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DataPanel>

      <DataPanel title="Recent Notices">
        <div className="space-y-3">
          {notices.length === 0 && (
            <AOSEmptyState title="No recent notices for parents." />
          )}
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="flex items-start gap-3 py-2 border-b border-[var(--w11-border-subtle)] last:border-0"
            >
              <div
                className="w-2 h-2 mt-2"
                style={{ background: "var(--w11-accent)", borderRadius: "var(--w11-radius-full)" }}
              />
              <div>
                <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>{notice.title}</p>
                <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{notice.date || "—"}</p>
              </div>
            </div>
          ))}
        </div>
      </DataPanel>
    </div>
  );
}
