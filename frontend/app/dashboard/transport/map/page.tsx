"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { MapPin, Bus, Navigation } from "lucide-react";

export default function TransportMapPage() {
  return <PluginGate slug="gps_tracking"><MapContent /></PluginGate>;
}

function MapContent() {
  const { data: logsData, isLoading } = useQuery({
    queryKey: ["transport-gps-latest"],
    queryFn: async () => (await api.get("/transport/gps-logs")).data?.data || [],
    refetchInterval: 15000,
  });

  const { data: busesData } = useQuery({
    queryKey: ["transport-buses"],
    queryFn: async () => (await api.get("/transport/buses")).data?.data || [],
  });

  if (isLoading) return <PageLoader />;

  const logs: any[] = logsData || [];
  const buses: any[] = busesData || [];

  // Latest log per bus
  const latestByBus: Record<string, any> = {};
  for (const log of logs) {
    const busId = log.bus_id || log.bus?.id;
    if (!latestByBus[busId] || new Date(log.logged_at) > new Date(latestByBus[busId].logged_at)) {
      latestByBus[busId] = log;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Navigation className="h-6 w-6" /> Live Map</h1>
        <p className="text-muted-foreground">Real-time bus locations — refreshes every 15 seconds</p>
      </div>

      {/* Map placeholder — replace with Leaflet or Google Maps integration */}
      <Card>
        <CardContent className="p-0">
          <div className="relative bg-muted rounded-lg h-96 flex items-center justify-center overflow-hidden">
            <div className="text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="font-medium">Map integration required</p>
              <p className="text-sm">Connect Leaflet.js or Google Maps with the GPS log coordinates below.</p>
            </div>
            {/* Overlay dots for each tracked bus */}
            {Object.values(latestByBus).map((log: any) => (
              log.latitude && log.longitude ? (
                <div key={log.id} className="absolute flex flex-col items-center" style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
                  <Bus className="h-6 w-6 text-primary" />
                  <span className="text-xs bg-primary text-primary-foreground px-1 rounded">{log.bus?.number_plate || "Bus"}</span>
                </div>
              ) : null
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {buses.map((bus: any) => {
          const latest = latestByBus[bus.id];
          return (
            <Card key={bus.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bus className="h-4 w-4" /> {bus.number_plate}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Driver</span>
                  <span>{bus.driver_name || "—"}</span>
                </div>
                {latest ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={latest.is_moving ? "default" : "secondary"} className="text-xs">
                        {latest.is_moving ? "Moving" : "Stationary"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Speed</span>
                      <span>{latest.speed_kmh != null ? `${latest.speed_kmh} km/h` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last update</span>
                      <span className="text-xs">{latest.logged_at ? new Date(latest.logged_at).toLocaleTimeString() : "—"}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">No location data</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {buses.length === 0 && (
          <p className="col-span-3 text-center text-muted-foreground py-8">No buses registered</p>
        )}
      </div>
    </div>
  );
}
