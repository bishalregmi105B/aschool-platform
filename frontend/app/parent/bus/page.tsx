"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";

type BusInfo = {
  bus_id?: string;
  bus_number?: string;
  driver_name?: string;
  name?: string;
};

type BusLocation = {
  bus_id?: string;
  lat?: number;
  lng?: number;
  speed_kmph?: number;
  updated_at?: string;
  recorded_at?: string;
};

/** Parent → Bus. Backed by GET /parent/bus-info + /parent/bus-location/<bus_id>. */
export default function ParentBusPage() {
  const info = useQuery({
    queryKey: ["parent-bus-info"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BusInfo[] | BusInfo>>("/parent/bus-info");
      const payload = res.data.data;
      return Array.isArray(payload) ? payload[0] : payload;
    },
  });

  const busId = info.data?.bus_id;
  const location = useQuery({
    queryKey: ["parent-bus-location", busId],
    enabled: Boolean(busId),
    refetchInterval: 15_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<BusLocation>>(`/parent/bus-location/${busId}`);
      return res.data.data;
    },
  });

  if (info.isLoading) return <PageLoader />;
  if (info.isError)
    return <ErrorState title="Couldn't load bus info" onRetry={() => info.refetch()} />;

  return (
    <div className="space-y-6">
      <PortalHeader portal="parent" title="Bus Tracker" />
      <Card>
        <CardHeader><CardTitle>{info.data?.bus_number || info.data?.name || "Assigned bus"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {info.data?.driver_name && (
            <p className="text-sm text-muted-foreground">Driver: {info.data.driver_name}</p>
          )}
          {!busId && (
            <p className="text-sm text-muted-foreground">
              Your child is not assigned to a bus route yet — contact the school office.
            </p>
          )}
          {busId && location.isLoading && <PageLoader />}
          {busId && location.data?.lat != null && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="success">Live</Badge>
                <span className="text-sm">
                  {location.data.lat?.toFixed(5)}, {location.data.lng?.toFixed(5)}
                </span>
              </div>
              {location.data.speed_kmph != null && (
                <p className="text-sm text-muted-foreground">
                  Speed: {location.data.speed_kmph} km/h
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Updated {location.data.updated_at || location.data.recorded_at || "—"}
              </p>
            </div>
          )}
          {busId && location.data?.lat == null && !location.isLoading && (
            <p className="text-sm text-muted-foreground">
              No live location right now — the bus may be off-route or the device offline.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
