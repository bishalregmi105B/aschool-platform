"use client";

/**
 * Timetable / Teacher — per-teacher load view (plan 34 row 6, A7 lite).
 *
 * Rewrite: teacher picker URL-backed (?teacher=) and searchable, skeletons,
 * a "N periods this week / free slots" KPI strip (the answer the questioner
 * actually wants), Nepali day labels in NE mode, honest empty states,
 * bilingual chrome. Data source unchanged (/design-studio teacher records
 * for the picker, /timetable?teacher_id= for the grid).
 */

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Calendar, Clock, UserCog } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  StatGrid,
  KpiCard,
} from "@/components/aos/kit/page-kit";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";

export default function TeacherTimetablePage() {
  const { t, lang } = useI18n();
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/timetable/teacher";
  const selectedTeacherId = routeParams.get("teacher") ?? "";

  function setTeacher(id: string) {
    const next = new URLSearchParams(routeParams.toString());
    if (id) next.set("teacher", id);
    else next.delete("teacher");
    navigate(`${pathname}?${next.toString()}`);
  }

  const { data: staff, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["teachers-list"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/design-studio/data-sources/teacher/records?limit=100");
      return res.data.data;
    },
  });

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const daysNe = ["आइत", "सोम", "मङ्ल", "बुध", "बिही", "शुक्र"];

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["teacher-timetable", selectedTeacherId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/timetable", {
        params: { teacher_id: selectedTeacherId },
      });
      return res.data.data ?? [];
    },
    enabled: Boolean(selectedTeacherId),
  });

  const periodNumbers = Array.from(
    new Set(slots.map((slot) => Number(slot.period_number)).filter(Boolean))
  ).sort((a, b) => a - b);
  const periods = periodNumbers.length > 0 ? periodNumbers : [1, 2, 3, 4, 5, 6];

  if (isLoading) {
    return (
      <AOSPage>
        <AOSPageHeader icon={<UserCog className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} title={t("Teacher Timetable", "शिक्षक तालिका")} />
        <AOSPageBody><SkeletonTable rows={6} /></AOSPageBody>
      </AOSPage>
    );
  }
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader icon={<UserCog className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} title={t("Teacher Timetable", "शिक्षक तालिका")} />
        <AOSPageBody>
          <ErrorState
            body={t("Failed to load the teacher list.", "शिक्षक सूची लोड हुन सकेन।")}
            onRetry={() => void refetch()}
          />
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<UserCog className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Teacher Timetable", "शिक्षक तालिका")}
        subtitle={t(
          "Weekly load per teacher — double-bookings fall out of the grid",
          "शिक्षकअनुसार साप्ताहिक भार",
        )}
      />
      <AOSPageBody>
        <FilterCommandBar>
          <AdvancedSelect
            className="w-72"
            value={selectedTeacherId}
            onChange={(v) => setTeacher(v || "")}
            searchable
            clearable
            placeholder={t("Select a teacher...", "शिक्षक छान्नुहोस्…")}
            options={(staff || []).map((tc) => ({ value: tc.id, label: tc.label }))}
          />
        </FilterCommandBar>

        {!selectedTeacherId ? (
          <div className="win11-card">
            <EmptyState
              icon={UserCog}
              title={t("Pick a teacher", "शिक्षक छान्नुहोस्")}
              body={t("Their weekly grid and free-slot count appear here.", "साप्ताहिक ग्रिड यहाँ आउँछ।")}
            />
          </div>
        ) : (
          <>
            {slots.length > 0 && (
              <StatGrid min={150}>
                <KpiCard
                  label={t("Periods this week", "यस हप्ताका पिरियड")}
                  value={slots.length}
                  icon={<Clock className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
                />
                <KpiCard
                  label={t("Classes taught", "पढाउने कक्षा")}
                  value={new Set(slots.map((s: any) => `${s.class_id}|${s.section_id}`)).size}
                  color="var(--w11-text-primary)"
                  icon={<Calendar className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
                />
                <KpiCard
                  label={t("Free cells", "खाली सेल")}
                  value={days.length * periods.length - slots.length}
                  color="var(--w11-text-primary)"
                />
              </StatGrid>
            )}

            <DataPanel bodyClassName="p-0">
              {slotsLoading ? (
                <SkeletonTable rows={6} columns={7} />
              ) : slots.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={Calendar}
                  title={t("No timetable slots for this teacher", "यस शिक्षकाको स्लट छैन")}
                  body={t("Assign them in Timetable → Add Slot or via the generator.", "तालिकाबाट तोक्नुहोस्।")}
                  action={{ label: t("Open Timetable", "तालिका खोल्नुहोस्"), href: "/dashboard/timetable" }}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr>
                        <th className="px-6 py-4 border border-[var(--w11-border-default)] bg-[var(--w11-surface-solid)] font-medium text-[color:var(--w11-text-secondary)] uppercase">
                          <Clock className="mr-2 inline h-4 w-4" /> {t("Time / Day", "समय / दिन")}
                        </th>
                        {periods.map((period) => (
                          <th key={period} className="px-6 py-4 border border-[var(--w11-border-default)] bg-[var(--w11-surface-solid)] font-medium text-center text-[color:var(--w11-text-secondary)]">P{period}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day, di) => (
                        <tr key={day} className="border-b border-[var(--w11-border-subtle)] transition-colors hover:bg-[var(--w11-control-hover)]">
                          <td className="px-6 py-4 border border-[var(--w11-border-subtle)] font-medium bg-[var(--w11-control-hover)] whitespace-nowrap">
                            {lang === "ne" ? daysNe[di] : day}
                          </td>
                          {periods.map((period) => {
                            const slot = slots.find(
                              (item) => item.day_of_week === day && Number(item.period_number) === period
                            );

                            return (
                              <td key={`${day}-${period}`} className="px-4 py-3 border border-[var(--w11-border-subtle)] text-center relative group">
                                {slot ? (
                                  <div
                                    className="flex flex-col items-center justify-center p-2 rounded-[var(--w11-radius-md)] border"
                                    style={{
                                      background: "var(--w11-accent-light)",
                                      borderColor: "var(--w11-accent)",
                                    }}
                                  >
                                    <span className="font-semibold">
                                      {[slot.class_name, slot.section_name].filter(Boolean).join(" ") || t("Assigned", "तोकिएको")}
                                    </span>
                                    <span className="text-xs text-[color:var(--w11-text-secondary)]">{slot.subject_name || slot.subject || t("Subject", "विषय")}</span>
                                    {slot.time && <span className="text-[11px] text-[color:var(--w11-text-tertiary)]">{slot.time}</span>}
                                  </div>
                                ) : (
                                  <div className="text-[color:var(--w11-text-tertiary)] text-xs">{t("Free", "खाली")}</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DataPanel>
          </>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
