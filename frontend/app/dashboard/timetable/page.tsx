"use client";

/**
 * Timetable — A6 workspace grid (plan 34 row 6, 8.3).
 *
 * Research (timetable grid UIs — Mighty's dynamic grid editing, Feishu/
 * Clockwise-style clash surfacing): a weekly grid is read first, edited by
 * exception (add/remove slot), and conflicts must be VISIBLE without opening
 * anything — grey badges on the clashing cell, not a post-hoc toast.
 * Applied here:
 * - Class/section scope in the URL (?class=&section=) — a shared link opens
 *   the same grid; back button walks scopes.
 * - Teacher clash detection for the fetched scope (a teacher booked in two
 *   sections at the same day+period shows a ⚠ chip on both cells).
 * - Quick-links strip → header actions (AI Generate + Teacher view) — the
 *   1-card "Quick Links" panel was pure ceremony.
 * - Dependency empty state when no class exists; skeleton while loading;
 *   bilingual chrome. Grid keeps the compact A–F six-day Nepali school week.
 * Endpoints/payloads unchanged (/timetable, /timetable/slots).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { useConfirm, undoableDelete } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, DependencyMissingEmptyState } from "@/components/ui/empty-state";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  FormSection,
  StatGrid,
  KpiCard,
} from "@/components/aos/kit/page-kit";
import {
  Calendar, CalendarDays, Clock, Layers, Wand2, Plus, Trash2, UserCog, AlertTriangle, Inbox,
} from "lucide-react";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";

interface TimetableSlot {
  id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  subject_name?: string;
  teacher_id: string;
  teacher_name?: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS_NE = ["आइतबार", "सोमबार", "मङ्लबार", "बुधबार", "बिहीबार", "शुक्रबार"];

export default function TimetablePage() {
  return (
    <AppGate slug="timetable">
      <TimetableContent />
    </AppGate>
  );
}

function TimetableContent() {
  const { t, lang } = useI18n();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/timetable";

  const classId = routeParams.get("class") ?? "";
  const sectionId = routeParams.get("section") ?? "";
  const [showAddSlot, setShowAddSlot] = useState(false);

  function setScope(patch: Record<string, string>) {
    const next = new URLSearchParams(routeParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    navigate(`${pathname}?${next.toString()}`);
  }

  const { data: classes, isError: classesError, refetch: refetchClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/academics/classes");
      return (res.data.data as Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }>) || [];
    },
    retry: 1,
  });

  const selectedClass = classes?.find((c: any) => c.id === classId);

  const { data: slots, isLoading, isError, refetch } = useQuery({
    queryKey: ["timetable", classId, sectionId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classId) params.set("class_id", classId);
      if (sectionId) params.set("section_id", sectionId);
      const res = await api.get<ApiResponse>(`/timetable?${params}`);
      return (res.data.data as TimetableSlot[]) || [];
    },
    enabled: !!classId,
    retry: 1,
  });

  const deleteSlotMut = useMutation({
    mutationFn: async (slotId: string) => api.delete(`/timetable/slots/${slotId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
    },
    onError: () => toast.error(t("Failed to remove slot", "हटाउन सकिएन")),
  });

  // Group slots by day
  const grouped: Record<string, TimetableSlot[]> = {};
  DAYS.forEach((d) => { grouped[d] = []; });
  slots?.forEach((s) => {
    if (grouped[s.day_of_week]) grouped[s.day_of_week].push(s);
  });

  const maxPeriods = Math.max(8, ...Object.values(grouped).map((arr) => arr.length));

  // Clash detection for the fetched scope: same teacher booked twice in the
  // same day+period (visible when viewing "All Sections").
  const clashKeys = useMemo(() => {
    const byKey = new Map<string, number>();
    (slots || []).forEach((s: TimetableSlot) => {
      if (!s.teacher_id) return;
      const key = `${s.day_of_week}|${s.period_number}|${s.teacher_id}`;
      byKey.set(key, (byKey.get(key) || 0) + 1);
    });
    return new Set(Array.from(byKey.entries()).filter(([, n]) => n > 1).map(([k]) => k));
  }, [slots]);

  const dayLabel = (d: string, i: number) => (lang === "ne" ? DAYS_NE[i] : d);

  // Dashboard KPIs — derived from the queries this page already runs.
  const classesCount = classes?.length ?? 0;
  const sectionsCount = (classes || []).reduce((sum, c) => sum + (c.sections?.length ?? 0), 0);
  // Saturday (6) sits outside the six-day school week — no periods today.
  const todayName = new Date().getDay() < DAYS.length ? DAYS[new Date().getDay()] : null;
  const periodsToday = todayName
    ? (slots?.filter((s: any) => s.day_of_week === todayName).length ?? 0)
    : 0;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Calendar className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Timetable", "समय तालिका")}
        subtitle={t(
          "View, edit and auto-generate class timetables",
          "कक्षा समय तालिका हेर्ने, सम्पादन गर्ने र स्वतः बनाउने",
        )}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/dashboard/timetable/teacher")}>
              <UserCog className="h-4 w-4 mr-2" /> {t("Per-teacher view", "शिक्षकअनुसार")}
            </Button>
            <Button variant="outline" onClick={() => setShowAddSlot(true)} disabled={!classId}>
              <Plus className="h-4 w-4 mr-2" /> {t("Add Slot", "स्लट थप्नुहोस्")}
            </Button>
            <Button onClick={() => navigate("/dashboard/timetable/generate")}>
              <Wand2 className="h-4 w-4 mr-2" /> {t("Auto Generate", "स्वतः बनाउने")}
            </Button>
          </>
        }
      />
      <AOSPageBody>
        <StatGrid min={170}>
          <KpiCard
            label={t("Classes", "कक्षा")}
            value={classesCount}
            icon={<Calendar className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Sections", "सेक्सन")}
            value={sectionsCount}
            color="var(--w11-text-primary)"
            icon={<Layers className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
          <KpiCard
            label={t("Weekly Slots", "साप्ताहिक स्लट")}
            value={!classId ? "—" : slots ? slots.length : "—"}
            footnote={classId ? `${selectedClass?.name ?? t("Class", "कक्षा")}${sectionId ? ` · ${selectedClass?.sections?.find((s: any) => s.id === sectionId)?.name ?? ""}` : ` · ${t("all sections", "सबै")}`}` : t("select a class below", "तल कक्षा छान्नुहोस्")}
            icon={<Clock className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            color="var(--w11-text-primary)"
          />
          <KpiCard
            label={t("Periods Today", "आजका पिरियड")}
            value={classId && slots ? periodsToday : "—"}
            footnote={todayName ?? t("Saturday — school closed", "शनि — विद्यालय बन्द")}
            icon={<CalendarDays className="h-4 w-4" style={{ color: "#107c10" }} />}
            color="#107c10"
          />
        </StatGrid>

        <FilterCommandBar>
          <Select value={classId} onValueChange={(v) => setScope({ class: v, section: "" })}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("Select Class", "कक्षा छान्नुहोस्")} /></SelectTrigger>
            <SelectContent>
              {classes?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedClass && (
            <Select value={sectionId || "all"} onValueChange={(v) => setScope({ section: v === "all" ? "" : v })}>
              <SelectTrigger className="w-48"><SelectValue placeholder={t("All Sections", "सबै सेक्सन")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Sections", "सबै सेक्सन")}</SelectItem>
                {selectedClass.sections?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </FilterCommandBar>

        {classesError ? (
          <ErrorState
            body={t("Failed to load classes.", "कक्षा लोड हुन सकेन।")}
            onRetry={() => void refetchClasses()}
          />
        ) : isError ? (
          <ErrorState
            body={t("Failed to load the timetable.", "तालिका लोड हुन सकेन।")}
            onRetry={() => void refetch()}
          />
        ) : !classId ? (
          (classes || []).length === 0 ? (
            <div className="win11-card">
              <DependencyMissingEmptyState
                icon={Inbox}
                title={t("No classes yet", "अझै कक्षा छैन")}
                body={t("A timetable schedules subjects for a class — create classes first.", "तालिकाका लागि कक्षा चाहिन्छ।")}
                prerequisiteName={t("Classes", "कक्षा")}
                setupHref="/dashboard/academics"
                setupLabel={t("Create your first class →", "पहिलो कक्षा बनाउनुहोस् →")}
              />
            </div>
          ) : (
            <div className="win11-card">
              <EmptyState
                icon={Calendar}
                title={t("Pick a class to see its grid", "कक्षा छान्नुहोस्")}
                body={t("The weekly period grid for that class renders here.", "साप्ताहिक ग्रिड यहाँ देखिन्छ।")}
              />
            </div>
          )
        ) : isLoading ? (
          <SkeletonTable rows={6} columns={9} />
        ) : (
          <DataPanel
            bodyClassName="p-4"
            actions={
              clashKeys.size > 0 ? (
                <span className="win11-chip error inline-flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t("teacher clashes visible", "शिक्षक द्वन्द्व")}
                </span>
              ) : undefined
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border p-2 text-left border-[var(--w11-border-default)] bg-[var(--w11-surface-solid)] text-[color:var(--w11-text-secondary)]">
                      {t("Day / Period", "दिन / पिरियड")}
                    </th>
                    {Array.from({ length: maxPeriods }, (_, i) => (
                      <th key={i} className="border p-2 text-center border-[var(--w11-border-default)] bg-[var(--w11-surface-solid)] text-[color:var(--w11-text-secondary)]">P{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, di) => (
                    <tr key={day}>
                      <td className="border p-2 font-medium border-[var(--w11-border-subtle)] bg-[var(--w11-control-hover)] whitespace-nowrap">
                        {dayLabel(day, di)}
                      </td>
                      {Array.from({ length: maxPeriods }, (_, i) => {
                        const slot = grouped[day]?.find((s) => s.period_number === i + 1);
                        const clash = slot?.teacher_id
                          ? clashKeys.has(`${day}|${i + 1}|${slot.teacher_id}`)
                          : false;
                        return (
                          <td key={i} className="border p-2 text-center text-xs border-[var(--w11-border-subtle)]">
                            {slot ? (
                              <div className="group relative">
                                {clash && (
                                  <span
                                    className="win11-chip error mb-1"
                                    title={t("This teacher is booked in another section at the same time", "यही शिक्षक अर्को सेक्सनमा एउटै समयमा छन्")}
                                  >
                                    ⚠ {t("clash", "द्वन्द्व")}
                                  </span>
                                )}
                                <p className="font-medium pr-4">{slot.subject_name || t("Unassigned", "अनटोकिएको")}</p>
                                <p className="text-[color:var(--w11-text-secondary)]">{slot.teacher_name || ""}</p>
                                {(slot.start_time || slot.end_time) && (
                                  <p className="text-[10px] text-[color:var(--w11-text-tertiary)]">
                                    {slot.start_time?.slice(0, 5) || ""}{slot.end_time ? ` - ${slot.end_time.slice(0, 5)}` : ""}
                                  </p>
                                )}
                                <button
                                  aria-label={`Remove slot ${day} P${slot.period_number}`}
                                  className="absolute top-0 right-0 hidden group-hover:block"
                                  style={{ color: "#c42b1c" }}
                                  disabled={deleteSlotMut.isPending}
                                  onClick={() => {
                                    void (async () => {
                                      const ok = await confirm({
                                        title: t("Remove slot", "स्लट हटाउने"),
                                        body: t(`Remove ${slot.subject_name || t("this slot", "यो")} on ${day} (P${slot.period_number})?`, `${day} P${slot.period_number} हटाउने?`),
                                        confirmLabel: t("Remove", "हटाउनुहोस्"),
                                        tone: "danger",
                                      });
                                      if (!ok) return;
                                      undoableDelete({
                                        label: t(`${slot.subject_name || "slot"}`, "स्लट"),
                                        commit: async () => { await deleteSlotMut.mutateAsync(slot.id); },
                                        rollback: () => queryClient.invalidateQueries({ queryKey: ["timetable"] }),
                                      });
                                    })();
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[color:var(--w11-text-tertiary)]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {(slots || []).length === 0 && (
                <div className="pt-2">
                  <EmptyState
                    size="sm"
                    icon={Calendar}
                    title={t("This class has no slots yet", "यस कक्षामा स्लट छैन")}
                    body={t("Add one manually or let AI Generate build the week.", "थप्नुहोस् वा AI बाट बनाउनुहोस्।")}
                    action={{ label: t("Auto Generate", "स्वतः बनाउने"), href: "/dashboard/timetable/generate" }}
                    secondaryAction={{ label: t("Add Slot", "स्लट थप्नुहोस्"), onClick: () => setShowAddSlot(true) }}
                  />
                </div>
              )}
            </div>
          </DataPanel>
        )}

        <AddSlotDialog
          open={showAddSlot}
          onOpenChange={setShowAddSlot}
          classId={classId}
          classes={classes || []}
        />
      </AOSPageBody>
    </AOSPage>
  );
}

function AddSlotDialog({
  open,
  onOpenChange,
  classId,
  classes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  classes: Array<{ id: string; name: string; sections?: Array<{ id: string; name: string }> }>;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [day, setDay] = useState(DAYS[0] ?? "Sunday");
  const [period, setPeriod] = useState("1");
  const selectedClass = classes.find((c) => c.id === classId);

  const { data: subjects } = useQuery({
    queryKey: ["class-subjects", classId],
    queryFn: async () => {
      const res = await api.get<ApiResponse>(`/academics/classes/${classId}/subjects`);
      return (res.data.data as Array<{ id: string; name: string }>) || [];
    },
    enabled: open && !!classId,
  });

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/users?role=teacher");
      return (res.data.data as Array<{ id: string; full_name: string }>) || [];
    },
    enabled: open,
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        class_id: classId,
        section_id: fd.get("section_id") || undefined,
        subject_id: fd.get("subject_id") || undefined,
        teacher_id: fd.get("teacher_id") || undefined,
        day_of_week: fd.get("day_of_week"),
        period_number: Number(fd.get("period_number")),
      };
      const start = fd.get("start_time");
      const end = fd.get("end_time");
      if (start) payload.start_time = start;
      if (end) payload.end_time = end;
      await api.post("/timetable/slots", payload);
      toast.success(t("Slot added", "स्लट थपियो"));
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      onOpenChange(false);
    } catch (err: unknown) {
      // Backend returns 409 with a specific clash message — show it directly.
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2?.response?.data?.error || t("Failed to add slot", "स्लट बनेन"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add Timetable Slot", "स्लट थप्नुहोस्")}</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="win11-infobar error">
            <p className="text-[13px]">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSection title={t("Assignment", "तोक्का")}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("Subject", "विषय")}</Label>
                  <AdvancedSelect
                    value={subjectId}
                    onChange={setSubjectId}
                    clearable
                    placeholder={t("None", "कुनै पनि होइन")}
                    options={(subjects || []).map((s) => ({ value: s.id, label: s.name }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Teacher", "शिक्षक")}</Label>
                  <AdvancedSelect
                    value={teacherId}
                    onChange={setTeacherId}
                    clearable
                    searchable
                    placeholder={t("None", "कुनै पनि होइन")}
                    options={(teachers || []).map((tc) => ({ value: tc.id, label: tc.full_name }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("Section", "सेक्सन")}</Label>
                  <AdvancedSelect
                    value={sectionId}
                    onChange={setSectionId}
                    clearable
                    placeholder={t("All sections", "सबै सेक्सन")}
                    options={(selectedClass?.sections || []).map((s) => ({ value: s.id, label: s.name }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Period", "पिरियड")}</Label>
                  <AdvancedSelect
                    value={period}
                    onChange={setPeriod}
                    options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `P${i + 1}` }))}
                  />
                </div>
              </div>
            </div>
          </FormSection>
          <FormSection title={t("When", "समय")}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Day", "दिन")}</Label>
                <AdvancedSelect
                  value={day}
                  onChange={setDay}
                  options={DAYS.map((d, i) => ({ value: d, label: t(d, DAYS_NE[i]) }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>{t("Start", "सुरु")}</Label>
                  <TimePicker name="start_time" placeholder="10:00" step={5} />
                </div>
                <div className="space-y-2">
                  <Label>{t("End", "अन्त्य")}</Label>
                  <TimePicker name="end_time" placeholder="10:45" step={5} />
                </div>
              </div>
            </div>
          </FormSection>
          {/* Hidden inputs keep FormData-based submit working with controlled selects */}
          <input type="hidden" name="subject_id" value={subjectId} />
          <input type="hidden" name="teacher_id" value={teacherId} />
          <input type="hidden" name="section_id" value={sectionId} />
          <input type="hidden" name="day_of_week" value={day} />
          <input type="hidden" name="period_number" value={period} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "रद्द")}</Button>
            <Button type="submit" disabled={saving || !classId}>
              {saving ? t("Saving…", "सुरक्षित…") : t("Add Slot", "स्लट थप्नुहोस्")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
