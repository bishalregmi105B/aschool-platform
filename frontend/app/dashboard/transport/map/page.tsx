"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Bus, Navigation } from "lucide-react";
import type { BusPosition } from "@/components/transport/LiveBusMap";
import { connectSocket, disconnectSocket, onGPSUpdate, joinSchoolRoom } from "@/lib/socket";

// Leaflet touches window at import time — client-only.
const LiveBusMap = dynamic(
  () => import("@/components/transport/LiveBusMap").then((m) => m.LiveBusMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[26rem] flex items-center justify-center rounded-lg"
        style={{ background: "var(--w11-control-hover)", color: "var(--w11-text-secondary)" }}
      >
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

  if (isLoading) return <AOSModuleLoadingState label="Loading live map…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Live Map" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load bus locations. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
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
    <AOSPage>
      <AOSPageHeader
        icon={<Navigation className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Live Map"
        subtitle={`${positions.length} of ${buses.length} buses reporting — live via WebSocket, polling fallback every 15s`}
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0 overflow-hidden" className="mb-4">
          <LiveBusMap buses={positions} />
        </DataPanel>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buses.map((bus: any) => {
            const pos = merged[bus.id];
            return (
              <div key={bus.id} className="win11-card">
                <div className="flex items-center gap-2 mb-2">
                  <Bus className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                  <span className="text-base font-semibold" style={{ color: "var(--w11-text-primary)" }}>
                    {labelByBus[bus.id] || "Bus"}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  {pos ? (
                    <>
                      <p style={{ color: "var(--w11-text-secondary)" }}>
                        {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                      </p>
                      {typeof pos.speed === "number" && (
                        <p style={{ color: "var(--w11-text-primary)" }}>Speed: {pos.speed.toFixed(0)} km/h</p>
                      )}
                      {pos.updatedAt && (
                        <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                          Last update: {new Date(pos.updatedAt).toLocaleString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{ color: "var(--w11-text-secondary)" }}>No GPS data yet — waiting for device…</p>
                  )}
                </div>
              </div>
            );
          })}
          {buses.length === 0 && (
            <DataPanel className="md:col-span-2 lg:col-span-3">
              <div className="py-10 text-center" style={{ color: "var(--w11-text-secondary)" }}>
                No buses registered yet. Add buses under Transport → Buses to see them here.
              </div>
            </DataPanel>
          )}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
