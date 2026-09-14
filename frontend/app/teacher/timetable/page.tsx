"use client";

/**
 * Teacher → My Timetable (scoped grid, 44.1).
 *
 * Was a re-export of the ADMIN per-teacher timetable page (a picker to view
 * ANY teacher's grid). Teachers need their own week at a glance: GET
 * /teacher/timetable returns this teacher's slots grouped by day — rendered
 * as a mobile-first day-card grid with today's column highlighted.
 *
 * Research notes: weekly schedule scanning works best with the current day
 * visually pinned (recognition over recall); breaks must be distinguishable
 * from lessons at a glance (contrast, not color alone).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { DataPanel } from "@/components/aos/kit/page-kit";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type Slot = {
  id?: string;
  subject?: string;
  class_name?: string;
  section_name?: string;
  time?: string;
  period_number?: number;
  is_break?: boolean;
};

const DAYS: { key: string; label: string }[] = [
  { key: "sun", label: "Sunday" },
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
];

export default function TeacherTimetablePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["teacher-timetable"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Record<string, Slot[]>>>("/teacher/timetable");
      return res.data.data || {};
    },
  });

  const todayKey = useMemo(() => DAYS[new Date().getDay()].key, []);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState title="Couldn't load your timetable" onRetry={refetch} />;

  const grouped = data || {};
  const hasAny = DAYS.some((d) => (grouped[d.key] || []).length > 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>My Timetable</h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          Your weekly periods, per the published timetable.
        </p>
      </div>

      {!hasAny ? (
        <EmptyState
          icon={CalendarDays}
          variant="dependency"
          title="Your timetable isn't published yet"
          body="The office generates the timetable and assigns subjects to you (Timetable → Auto/AI Generate)."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DAYS.map((d) => {
            const slots = grouped[d.key] || [];
            const isToday = d.key === todayKey;
            if (!slots.length) return null;
            return (
              <DataPanel
                key={d.key}
                title={
                  <span className="inline-flex items-center gap-2">
                    {d.label}
                    {isToday && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: "var(--w11-accent)", color: "var(--w11-accent-text)" }}
                      >
                        Today
                      </span>
                    )}
                  </span>
                }
                className={isToday ? "ring-2 ring-[var(--w11-accent)]" : undefined}
              >
                <ol className="space-y-2">
                  {slots.map((s, i) => (
                    <li
                      key={s.id || i}
                      className="rounded-lg border px-3 py-2"
                      style={{
                        borderColor: "var(--w11-border-subtle)",
                        background: s.is_break ? "var(--w11-subtle, rgba(0,0,0,0.03))" : undefined,
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm font-medium ${s.is_break ? "italic" : ""}`}
                          style={{ color: "var(--w11-text-primary)" }}
                        >
                          {s.subject || (s.is_break ? "Break" : "—")}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums" style={{ color: "var(--w11-text-secondary)" }}>
                          P{s.period_number ?? i + 1}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                        {s.time || "—"}
                        {s.class_name ? ` · ${s.class_name}${s.section_name ? ` ${s.section_name}` : ""}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              </DataPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
