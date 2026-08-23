"use client";

/**
 * LiveBusMap — real Leaflet map bound to the live GPS stream.
 *
 * Data sources:
 *  - react-query poll of /transport/gps-logs (15 s fallback)
 *  - Socket.IO "gps_update" events pushed by the backend GPS worker
 *    (lib/socket.ts), which update positions the moment the device reports.
 */

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface BusPosition {
  busId: string;
  label: string;
  lat: number;
  lng: number;
  speed?: number | null;
  updatedAt?: string | null;
}

const KATHMANDU_CENTER: [number, number] = [27.7172, 85.324];

function busIcon(label: string, stale: boolean) {
  const color = stale ? "#9ca3af" : "#2563eb";
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="
          background:${color};color:#fff;border-radius:9999px;
          padding:3px 8px;font-size:11px;font-weight:700;white-space:nowrap;
          box-shadow:0 1px 4px rgba(0,0,0,.35);border:2px solid #fff">
          🚌 ${label}
        </div>
      </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 12],
  });
}

function isStale(updatedAt?: string | null): boolean {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > 5 * 60 * 1000;
}

function BusPopup({ bus }: { bus: BusPosition }) {
  return (
    <div style={{ minWidth: 160 }}>
      <strong>{bus.label}</strong>
      <div>
        {bus.lat.toFixed(5)}, {bus.lng.toFixed(5)}
      </div>
      {typeof bus.speed === "number" && <div>Speed: {bus.speed.toFixed(0)} km/h</div>}
      {bus.updatedAt && (
        <div style={{ color: "#6b7280", fontSize: 11 }}>
          Updated: {new Date(bus.updatedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export function LiveBusMap({ buses }: { buses: BusPosition[] }) {
  const [, setTick] = useState(0);

  // Re-evaluate staleness every minute.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Deduplicate to the latest fix per bus and drop invalid coordinates.
  const points = useMemo(() => {
    const byBus = new Map<string, BusPosition>();
    for (const b of buses) {
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) continue;
      const existing = byBus.get(b.busId);
      if (!existing || new Date(b.updatedAt ?? 0) > new Date(existing.updatedAt ?? 0)) {
        byBus.set(b.busId, b);
      }
    }
    return Array.from(byBus.values());
  }, [buses]);

  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : KATHMANDU_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      style={{ height: "26rem", width: "100%", borderRadius: "0.5rem", zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((bus) => {
        const stale = isStale(bus.updatedAt);
        return (
          <Marker key={bus.busId} position={[bus.lat, bus.lng]} icon={busIcon(bus.label, stale)}>
            <Popup>
              <BusPopup bus={bus} />
            </Popup>
          </Marker>
        );
      })}
      {points.map((bus) =>
        !isStale(bus.updatedAt) ? (
          <CircleMarker
            key={`halo-${bus.busId}`}
            center={[bus.lat, bus.lng]}
            radius={16}
            pathOptions={{ color: "#2563eb", fillOpacity: 0.06, weight: 1 }}
          />
        ) : null
      )}
    </MapContainer>
  );
}
