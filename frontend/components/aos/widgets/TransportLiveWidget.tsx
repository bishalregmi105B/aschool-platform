"use client";

import { useQuery } from "@tanstack/react-query";
import { Bus, MapPin, Sunrise, Sunset } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { DataPanel, StatusChip, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { WidgetLink, WidgetError, type AOSWidgetProps } from "./shared";

interface Trip {
  id: string;
  name: string | null;
  route_name: string | null;
  bus: string | null;
  direction: "morning" | "afternoon";
  weekdays: number[];
  first_stop_time: string | null;
  stop_to_stop_avg_mins: number | null;
  status: "active" | "retired";
}

interface BusItem {
  id: string;
  vehicle_number: string;
  capacity: number;
  gps_device_id?: string;
  route_id?: string;
  is_active: boolean;
}

interface TransportSnapshot {
  activeBuses: number;
  totalBuses: number;
  gpsTracked: number;
  morningTrips: Trip[];
  afternoonTrips: Trip[];
}

/** "07:30:00" → "07:30"; passes through null/odd values untouched. */
function shortTime(iso: string | null): string {
  if (!iso) return "—";
  const match = /^(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : iso;
}

/**
 * transport-live — today's transport pulse from /transport/trips +
 * /transport/buses: active/GPS-tracked bus counts and today's upcoming trips
 * (weekday-matched, sorted by first stop) with morning/afternoon splits.
 */
export default function TransportLiveWidget({
  compact = false,
  onOpenRoute,
}: AOSWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["aos-widget", "transport-live"],
    queryFn: async (): Promise<TransportSnapshot> => {
      const [tripsRes, busesRes] = await Promise.all([
        api.get<ApiResponse<{ trips: Trip[] }>>("/transport/trips", {
          params: { per_page: 100 },
        }),
        api.get<ApiResponse<BusItem[]>>("/transport/buses"),
      ]);

      const buses = Array.isArray(busesRes.data?.data) ? busesRes.data.data : [];
      const trips = tripsRes.data?.data?.trips ?? [];

      // Backend weekdays are ISO ints (Mon=0 … Sun=6); JS getDay() is Sun=0.
      const todayIso = (new Date().getDay() + 6) % 7;
      const todayTrips = trips
        .filter((trip) => trip.status === "active")
        .filter((trip) => !trip.weekdays || trip.weekdays.length === 0 || trip.weekdays.includes(todayIso))
        .sort((a, b) => (a.first_stop_time ?? "99").localeCompare(b.first_stop_time ?? "99"));

      return {
        activeBuses: buses.filter((b) => b.is_active).length,
        totalBuses: buses.length,
        gpsTracked: buses.filter((b) => b.gps_device_id).length,
        morningTrips: todayTrips.filter((t) => t.direction === "morning"),
        afternoonTrips: todayTrips.filter((t) => t.direction === "afternoon"),
      };
    },
    staleTime: 60_000,
    retry: 1,
  });

  const nextTrips = data
    ? [...data.morningTrips, ...data.afternoonTrips]
        .sort((a, b) => (a.first_stop_time ?? "99").localeCompare(b.first_stop_time ?? "99"))
        .slice(0, compact ? 3 : 5)
    : [];

  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <Bus className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
          Transport Today
        </span>
      }
      actions={
        <WidgetLink
          href="/dashboard/transport"
          onOpenRoute={onOpenRoute}
          className="text-[11px] hover:underline"
          style={{ color: "var(--w11-accent)" }}
        >
          Open
        </WidgetLink>
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 flex-1" />
          </div>
          <SkeletonText lines={compact ? 2 : 4} />
        </div>
      ) : isError ? (
        <WidgetError
          title="Couldn't load transport"
          body="The trip and bus summaries are unavailable right now."
          onRetry={() => refetch()}
        />
      ) : !data || (data.totalBuses === 0 && nextTrips.length === 0) ? (
        <AOSEmptyState
          icon={<Bus className="h-6 w-6" />}
          title="No transport set up"
          description="Trips and buses appear once the transport plugin is configured."
          action={
            <WidgetLink
              href="/dashboard/transport"
              onOpenRoute={onOpenRoute}
              className="win11-chip"
              style={{ color: "var(--w11-accent)" }}
            >
              Open transport
            </WidgetLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusChip status="active" label={`${data.activeBuses}/${data.totalBuses} buses active`} />
            <StatusChip
              status={data.gpsTracked > 0 ? "active" : "pending"}
              label={`${data.gpsTracked} GPS tracked`}
            />
          </div>
          {nextTrips.length > 0 ? (
            <div className="flex flex-col gap-1">
              {nextTrips.map((trip) => (
                <div key={trip.id} className="flex items-center justify-between gap-3 py-0.5">
                  <span
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px]"
                    style={{ color: "var(--w11-text-primary)" }}
                    title={trip.name ?? trip.route_name ?? undefined}
                  >
                    {trip.direction === "morning" ? (
                      <Sunrise className="h-3 w-3 shrink-0" style={{ color: "var(--w11-accent)" }} />
                    ) : (
                      <Sunset className="h-3 w-3 shrink-0" style={{ color: "#d83b01" }} />
                    )}
                    <span className="truncate">
                      {trip.name || trip.route_name || "Trip"}
                      {trip.bus && !compact && (
                        <span style={{ color: "var(--w11-text-secondary)" }}> · {trip.bus}</span>
                      )}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-[11px] font-semibold tabular-nums"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    {shortTime(trip.first_stop_time)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              No trips scheduled today.
            </p>
          )}
          {!compact && (
            <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              <MapPin className="h-3 w-3 shrink-0" />
              {data.morningTrips.length} morning · {data.afternoonTrips.length} afternoon trips today
            </p>
          )}
        </div>
      )}
    </DataPanel>
  );
}
