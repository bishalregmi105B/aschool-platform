"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Activity, Bus } from "lucide-react";

export default function GpsLogsPage() {
  return <PluginGate slug="gps_tracking"><GpsLogsContent /></PluginGate>;
}

function GpsLogsContent() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["transport-gps-logs"],
    queryFn: async () => (await api.get("/transport/gps-logs")).data?.data || [],
    refetchInterval: 30000,
  });

  const { data: busesData } = useQuery({
    queryKey: ["transport-buses"],
    queryFn: async () => (await api.get("/transport/buses")).data?.data || [],
  });
  const busLabelById = Object.fromEntries(
    ((busesData || []) as any[]).map((b) => [b.id, b.vehicle_number || "Bus"])
  );
  const logs: any[] = (data || []).filter((l: any) =>
    (busLabelById[l.bus_id] || "").toLowerCase().includes(search.toLowerCase())
  );

  const LOG_COLUMNS: Column<any>[] = [
    { key: "bus", label: "Bus", sortable: true, value: (l) => busLabelById[l.bus_id] ?? "", render: (l) => <div className="flex items-center gap-2 font-medium"><Bus className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />{busLabelById[l.bus_id] || l.bus_id}</div> },
    { key: "latitude", label: "Latitude", align: "right", value: (l) => l.latitude ?? 0, render: (l) => <span className="text-sm font-mono">{l.latitude?.toFixed(6) || "—"}</span> },
    { key: "longitude", label: "Longitude", align: "right", value: (l) => l.longitude ?? 0, render: (l) => <span className="text-sm font-mono">{l.longitude?.toFixed(6) || "—"}</span> },
    { key: "speed", label: "Speed", align: "right", sortable: true, value: (l) => l.speed_kmh ?? 0, render: (l) => (l.speed_kmh != null ? `${l.speed_kmh} km/h` : "—") },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (l) => ((l.speed_kmh ?? 0) > 1 ? "moving" : "stationary"),
      render: (l) => (
        <StatusChip
          status={(l.speed_kmh ?? 0) > 1 ? "active" : "inactive"}
          label={(l.speed_kmh ?? 0) > 1 ? "Moving" : "Stationary"}
        />
      ),
    },
    {
      key: "timestamp",
      label: "Timestamp",
      sortable: true,
      value: (l) => l.timestamp ?? "",
      render: (l) => <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{l.timestamp ? new Date(l.timestamp).toLocaleString("ne-NP") : "—"}</span>,
    },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading GPS logs…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="GPS Logs" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load GPS logs. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Activity className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="GPS Logs"
        subtitle={`${logs.length} ${logs.length === 1 ? "entry" : "entries"} — refreshes every 30s`}
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={LOG_COLUMNS}
            rows={logs}
            rowKey={(l: any) => l.id || `log-${l.timestamp}`}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by bus or driver..."
            exportFileName="gps-logs"
            empty={{ icon: Bus, title: "No GPS logs available", body: "Logs stream in as buses report their position." }}
            dense
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
