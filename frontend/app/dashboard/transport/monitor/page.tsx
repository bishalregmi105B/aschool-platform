"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { useI18n } from "@/lib/i18n";
import { useServerTime } from "@/lib/use-server-time";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { DetailSheet } from "@/components/ui/sheet";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import {
  Bus, CheckCircle2, Circle, CircleDot, Flag, Navigation, Play,
  RefreshCw, Square, UserCheck, UserX,
} from "lucide-react";

interface InstanceStop {
  stop_id: string;
  stop_name: string | null;
  seq: number;
  planned_ts: string | null;
  actual_ts: string | null;
}

interface Passenger {
  student_id: string;
  student_name: string | null;
  ride_status: 0 | 1 | 2 | 3;
  boarded_at: string | null;
  dropped_at: string | null;
}

interface Instance {
  id: string;
  trip_id: string;
  date: string;
  date_bs: string | null;
  direction: "morning" | "afternoon";
  bus: string | null;
  status: "scheduled" | "running" | "completed" | "cancelled";
  started_at: string | null;
  ended_at: string | null;
  last_fix_at: string | null;
  last_speed_kmh: number | null;
  stops?: InstanceStop[];
  passengers?: Passenger[];
}

type StatusFilter = "all" | "scheduled" | "running" | "completed" | "cancelled";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function statusVariant(status: Instance["status"]) {
  switch (status) {
    case "running": return "success" as const;
    case "completed": return "default" as const;
    case "cancelled": return "destructive" as const;
    default: return "secondary" as const;
  }
}

function localTodayAD(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/** ride_status: 0 waiting | 1 onboard | 2 missed | 3 dropped */
const RIDE_STATUS: Record<number, { label: string; variant: "secondary" | "success" | "destructive" | "default" }> = {
  0: { label: "Waiting", variant: "secondary" },
  1: { label: "Onboard", variant: "success" },
  2: { label: "Missed", variant: "destructive" },
  3: { label: "Dropped", variant: "default" },
};

function errMessage(err: unknown, fallback?: string): string | null {
  const raw = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  if (typeof raw === "string") return raw;
  const msg = raw?.message ?? (err instanceof Error ? err.message : null);
  return msg ?? fallback ?? null;
}

export default function MonitorPage() {
  return (
    <PluginGate slug="gps_tracking">
      <MonitorContent />
    </PluginGate>
  );
}

function MonitorContent() {
  const { t } = useI18n();
  const serverTime = useServerTime();
  const [date, setDate] = useState<string>(localTodayAD());
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["transport-instances", date, status],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ date: string; instances: Instance[] }>>(
        "/transport/instances",
        { params: { date, status: status === "all" ? undefined : status, per_page: 100 } }
      );
      return res.data?.data?.instances || [];
    },
    refetchInterval: 20000,
  });

  const instances: Instance[] = data || [];
  const runningCount = instances.filter((i) => i.status === "running").length;

  const errorMessage = errMessage(error);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Navigation className="h-6 w-6" /> {t("Run Monitor", "रन मनिटर")}
          </h1>
          <p className="text-muted-foreground">
            {runningCount > 0
              ? t(`${runningCount} trip${runningCount > 1 ? "s" : ""} running now`, `${runningCount} ट्रिप चालु छ`)
              : t("Today's bus trips and live progress", "आजका बस ट्रिपहरू र प्रगति")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BSDateInput
            emit="ad"
            value={date}
            onChange={setDate}
            className="w-[180px]"
            placeholder={t("Pick date", "मिति छान्नुहोस्")}
          />
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Refresh">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={status === f.value ? "default" : "outline"}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i}><CardContent className="space-y-3 pt-6">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent></Card>
          ))}
        </div>
      ) : errorMessage ? (
        <ErrorState body={errorMessage} onRetry={() => refetch()} />
      ) : instances.length === 0 ? (
        <Card><CardContent className="pt-6">
          <EmptyState
            icon={Bus}
            title={t("No runs for this day", "यो दिनका रनहरू छैनन्")}
            body={t(
              "Trips scheduled for this weekday appear here. Check the date or trip schedules.",
              "यो बारका तालिकाबद्ध ट्रिपहरू यहाँ देखिन्छन्। मिति वा ट्रिप तालिका जाँच्नुहोस्।"
            )}
          />
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {instances.map((inst) => (
            <InstanceCard key={inst.id} inst={inst} onOpen={() => setOpenId(inst.id)} />
          ))}
        </div>
      )}

      <InstanceDrawer
        open={openId !== null}
        instanceId={openId}
        onOpenChange={(o) => { if (!o) setOpenId(null); }}
      />
    </div>
  );
}

function InstanceCard({ inst, onOpen }: { inst: Instance; onOpen: () => void }) {
  const { t } = useI18n();
  const stops = inst.stops || [];
  const visited = stops.filter((s) => s.actual_ts).length;
  const pct = stops.length ? Math.round((visited / stops.length) * 100) : 0;
  const fix = timeAgo(inst.last_fix_at);

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
    >
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bus className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{inst.bus || t("Unassigned bus", "बस छैन")}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {inst.direction === "morning" ? t("Morning", "बिहान") : t("Afternoon", "दिउँसो")}
              </p>
            </div>
          </div>
          <Badge variant={statusVariant(inst.status)} className="capitalize shrink-0">
            {inst.status}
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("Stops", "स्टपहरू")}</span>
            <span className="font-medium tabular-nums text-foreground">{visited}/{stops.length}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CircleDot className="h-3 w-3" />
            {fix ? t(`GPS ${fix}`, `GPS ${fix}`) : t("No GPS fix", "GPS छैन")}
          </span>
          {inst.started_at && (
            <span className="tabular-nums">{t("Started", "सुरु")} {hhmm(inst.started_at)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InstanceDrawer({
  open,
  instanceId,
  onOpenChange,
}: {
  open: boolean;
  instanceId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["transport-instance", instanceId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Instance>>(`/transport/instances/${instanceId}`);
      return res.data?.data;
    },
    enabled: open && instanceId !== null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transport-instance", instanceId] });
    queryClient.invalidateQueries({ queryKey: ["transport-instances"] });
  };

  const start = useMutation({
    mutationFn: async () =>
      (await api.post(`/transport/instances/${instanceId}/start`)).data,
    onSuccess: () => { invalidate(); toast.success(t("Trip started", "ट्रिप सुरु भयो")); },
    onError: (err) => toast.error(errMessage(err, t("Failed to start trip", "ट्रिप सुरु गर्न सकिएन"))),
  });

  const end = useMutation({
    mutationFn: async () =>
      (await api.post(`/transport/instances/${instanceId}/end`)).data,
    onSuccess: () => { invalidate(); toast.success(t("Trip ended", "ट्रिप समाप्त भयो")); },
    onError: (err) => {
      // 409 while students are still onboard — surface the count.
      const e = err as { response?: { data?: { error?: { message?: string; onboard?: number } } } };
      const raw = e?.response?.data?.error;
      const message = typeof raw === "string" ? raw : raw?.message;
      const onboard = typeof raw === "object" && raw !== null ? raw.onboard : undefined;
      toast.error(message || t("Failed to end trip", "ट्रिप समाप्त गर्न सकिएन"), {
        description:
          onboard !== undefined
            ? t(`${onboard} student(s) still onboard`, `${onboard} विद्यार्थी अझै बसमा`)
            : undefined,
      });
    },
  });

  const pickup = useMutation({
    mutationFn: async ({ studentId, missed }: { studentId: string; missed: boolean }) =>
      (
        await api.post(`/transport/instances/${instanceId}/pickup`, {
          student_id: studentId,
          missed,
        })
      ).data,
    onSuccess: (_d, vars) => {
      invalidate();
      toast.success(vars.missed ? t("Marked as missed", "छुटेको चिन्हित भयो") : t("Student picked up", "विद्यार्थी चढाइयो"));
    },
    onError: (err) => toast.error(errMessage(err, t("Failed to update pickup", "पिकअप अद्यावधिक गर्न सकिएन"))),
  });

  const dropoff = useMutation({
    mutationFn: async (stopId: string) =>
      (
        await api.post(`/transport/instances/${instanceId}/dropoff`, { stop_id: stopId })
      ).data,
    onSuccess: () => { invalidate(); toast.success(t("Drop-off recorded", "ड्रप-अफ रेकर्ड भयो")); },
    onError: (err) => toast.error(errMessage(err, t("Failed to record drop-off", "ड्रप-अफ रेकर्ड गर्न सकिएन"))),
  });

  const inst = data;
  const stops = useMemo(() => [...(inst?.stops || [])].sort((a, b) => a.seq - b.seq), [inst]);
  const passengers = inst?.passengers || [];
  const isRunning = inst?.status === "running";
  const onboardCount = passengers.filter((p) => p.ride_status === 1).length;
  const visitedCount = stops.filter((s) => s.actual_ts).length;

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        inst
          ? `${inst.bus || t("Unassigned bus", "बस छैन")} — ${inst.direction === "morning" ? t("Morning", "बिहान") : t("Afternoon", "दिउँसो")}`
          : ""
      }
      subtitle={
        inst
          ? [inst.date_bs, inst.date].filter(Boolean).join(" · ")
          : undefined
      }
      footer={
        inst ? (
          <div className="flex w-full items-center justify-between gap-2">
            {inst.status === "scheduled" ? (
              <Button onClick={() => start.mutate()} disabled={start.isPending} className="w-full">
                {start.isPending ? <Spinner size="sm" className="mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {t("Start trip", "ट्रिप सुरु गर्नुहोस्")}
              </Button>
            ) : isRunning ? (
              <>
                <span className="text-[12px] text-muted-foreground">
                  {t(`${onboardCount} onboard`, `${onboardCount} बसमा`)}
                </span>
                <Button
                  variant="destructive"
                  onClick={() => end.mutate()}
                  disabled={end.isPending}
                >
                  {end.isPending ? <Spinner size="sm" className="mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                  {t("End trip", "ट्रिप समाप्त")}
                </Button>
              </>
            ) : (
              <Badge variant={statusVariant(inst.status)} className="capitalize">
                {inst.status === "completed" ? t("Completed", "समाप्त") : t("Cancelled", "रद्द")}
              </Badge>
            )}
          </div>
        ) : null
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : error ? (
        <ErrorState size="sm" body={errMessage(error) ?? undefined} onRetry={() => refetch()} />
      ) : !inst ? null : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("Stop timeline", "स्टप टाइमलाइन")}
              <span className="ml-2 font-normal normal-case">{visitedCount}/{stops.length}</span>
            </h3>
            {stops.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">{t("No stops on this route.", "यो बाटोमा स्टपहरू छैनन्।")}</p>
            ) : (
              <ol className="relative space-y-0">
                {stops.map((s, idx) => {
                  const done = Boolean(s.actual_ts);
                  const last = idx === stops.length - 1;
                  return (
                    <li key={s.stop_id} className="relative flex gap-3 pb-4">
                      {!last && (
                        <span
                          className={cn(
                            "absolute left-[7px] top-4 h-full w-0.5",
                            done ? "bg-primary/40" : "bg-muted"
                          )}
                          aria-hidden
                        />
                      )}
                      <span className="relative z-10 mt-0.5 shrink-0">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </span>
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn("truncate text-[13px] font-medium", !done && "text-muted-foreground")}>
                            {s.stop_name || `#${s.seq}`}
                          </p>
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {t("Planned", "योजना")} {hhmm(s.planned_ts)}
                            {done && (
                              <>
                                {" · "}
                                <span className="font-medium text-primary">
                                  {t("Actual", "वास्तविक")} {hhmm(s.actual_ts)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        {isRunning && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 shrink-0 text-[11px]"
                            disabled={dropoff.isPending}
                            onClick={() => dropoff.mutate(s.stop_id)}
                          >
                            {dropoff.isPending ? (
                              <Spinner size="sm" className="mr-1" />
                            ) : (
                              <Flag className="h-3 w-3 mr-1" />
                            )}
                            {t("Drop off", "ओराल्नु")}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("Passengers", "यात्रुहरू")}
              <span className="ml-2 font-normal normal-case">
                {t(`${passengers.filter((p) => p.ride_status === 1).length} onboard`, `${passengers.filter((p) => p.ride_status === 1).length} बसमा`)}
              </span>
            </h3>
            {passengers.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">{t("No students allocated to this trip.", "यो ट्रिपमा विद्यार्थी छुट्याइएको छैन।")}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {passengers.map((p) => {
                  const rs = RIDE_STATUS[p.ride_status] ?? RIDE_STATUS[0];
                  return (
                    <li key={p.student_id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{p.student_name || p.student_id}</p>
                        {(p.boarded_at || p.dropped_at) && (
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {p.boarded_at && `${t("On", "चढेको")} ${hhmm(p.boarded_at)}`}
                            {p.dropped_at && ` · ${t("Off", "ओर्लेको")} ${hhmm(p.dropped_at)}`}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant={rs.variant} className="text-[10px]">{rs.label}</Badge>
                        {isRunning && p.ride_status === 0 && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title={t("Pick up", "चढाउनुहोस्")}
                              disabled={pickup.isPending}
                              onClick={() => pickup.mutate({ studentId: p.student_id, missed: false })}
                            >
                              <UserCheck className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title={t("Mark missed", "छुटेको चिन्हित")}
                              disabled={pickup.isPending}
                              onClick={() => pickup.mutate({ studentId: p.student_id, missed: true })}
                            >
                              <UserX className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </DetailSheet>
  );
}
