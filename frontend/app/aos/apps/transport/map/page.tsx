"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Bus, Navigation } from "lucide-react";
import type { BusPosition } from "@/components/transport/LiveBusMap";
import { connectSocket, disconnectSocket, onGPSUpdate, joinSchoolRoom } from "@/lib/socket";

// Leaflet touches window at import time — client-only.
const LiveBusMap = dynamic(
  () => import("@/components/transport/LiveBusMap").then((m) => m.LiveBusMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[26rem] flex items-center justify-center text-muted-foreground bg-muted rounded-lg">
        Loading map…
      </div>
    ),
  }
);

export default function TransportMapPage() {
  return (
    <PluginGate slug="gps_tracking">
      <MapContent />
    </PluginGate>
  );
}

function MapContent() {
  const [livePositions, setLivePositions] = useState<Record<string, BusPosition>>({});

  // ── Live GPS stream (Socket.IO) ──────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();
    const unsubscribe = onGPSUpdate((payload: any) => {
      if (!payload?.bus_id || typeof payload.latitude !== "number") return;
      setLivePositions((prev) => ({
        ...prev,
        [payload.bus_id]: {
          busId: String(payload.bus_id),
          label: payload.vehicle_number || prev[payload.bus_id]?.label || "Bus",
          lat: Number(payload.latitude),
          lng: Number(payload.longitude),
          speed: typeof payload.speed === "number" ? payload.speed : null,
          updatedAt: payload.timestamp || new Date().toISOString(),
        },
      }));
    });
    return () => {
      unsubscribe();
      disconnectSocket();
    };
  }, []);

  // Join the school room once we know the tenant.
  const { data: busesData } = useQuery({
    queryKey: ["transport-buses"],
    queryFn: async () => (await api.get("/transport/buses")).data?.data || [],
  });

  useEffect(() => {
    const buses: any[] = busesData || [];
    const schoolId = buses[0]?.school_id;
    if (schoolId) joinSchoolRoom(schoolId);
  }, [busesData]);

  // ── Fallback poll (also seeds labels + last known positions) ─────────
  const { data: logsData, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["transport-gps-latest"],
    queryFn: async () => (await api.get("/transport/gps-logs")).data?.data || [],
    refetchInterval: 15000,
  });

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load bus locations. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  const logs: any[] = logsData || [];
  const buses: any[] = busesData || [];

  const labelByBus = Object.fromEntries(
    buses.map((b) => [b.id, b.vehicle_number || b.name || "Bus"])
  );

  const latestByBus: Record<string, any> = {};
  for (const log of logs) {
    const busId = log.bus_id || log.bus?.id;
    const at = log.timestamp || log.logged_at;
    if (!latestByBus[busId] || new Date(at) > new Date(latestByBus[busId].timestamp || latestByBus[busId].logged_at)) {
      latestByBus[busId] = log;
    }
  }

  // Merge polled history with pushed live events (live wins when fresher).
  const merged: Record<string, BusPosition> = {};
  for (const [busId, log] of Object.entries(latestByBus)) {
    if (log.latitude == null || log.longitude == null) continue;
    merged[busId] = {
      busId,
      label: labelByBus[busId] || "Bus",
      lat: Number(log.latitude),
      lng: Number(log.longitude),
      speed: log.speed_kmh ?? null,
      updatedAt: log.timestamp || log.logged_at || null,
    };
  }
  for (const [busId, live] of Object.entries(livePositions)) {
    merged[busId] = live;
  }

  const positions = Object.values(merged);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Navigation className="h-6 w-6" /> Live Map
        </h1>
        <p className="text-muted-foreground">
          Real-time bus locations — live via WebSocket, polling fallback every 15 seconds
        </p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-hidden">
          <LiveBusMap buses={positions} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {buses.map((bus: any) => {
          const pos = merged[bus.id];
          return (
            <Card key={bus.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bus className="h-4 w-4" /> {labelByBus[bus.id] || "Bus"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {pos ? (
                  <>
                    <p className="text-muted-foreground">
                      {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                    </p>
                    {typeof pos.speed === "number" && (
                      <p>Speed: {pos.speed.toFixed(0)} km/h</p>
                    )}
                    {pos.updatedAt && (
                      <p className="text-muted-foreground text-xs">
                        Last update: {new Date(pos.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">No GPS data yet — waiting for device…</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {buses.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-muted-foreground">
              No buses registered yet. Add buses under Transport → Buses to see them here.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
