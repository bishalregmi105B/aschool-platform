"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle, Bus, History,
} from "lucide-react";

interface MissedPickup {
  student_id: string;
  student_name: string | null;
  date: string;
  date_bs: string | null;
  direction: "morning" | "afternoon";
  bus: string | null;
}

interface TripHistoryRow {
  instance_id: string;
  date: string;
  date_bs: string | null;
  direction: "morning" | "afternoon";
  bus: string | null;
  status: string;
  stops_total: number;
  stops_visited: number;
  stops_on_time: number;
  boarded: number;
  missed: number;
}

function localTodayAD(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function daysAgoAD(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function errMessage(err: unknown): string | null {
  const raw = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  if (typeof raw === "string") return raw;
  return raw?.message ?? (err instanceof Error ? err.message : null);
}

export default function TransportReportsPage() {
  return (
    <PluginGate slug="gps_tracking">
      <ReportsContent />
    </PluginGate>
  );
}

function DateRangePicker({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">From</Label>
        <BSDateInput emit="ad" value={from} onChange={onFrom} className="w-[170px]" placeholder="From date" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">To</Label>
        <BSDateInput emit="ad" value={to} onChange={onTo} className="w-[170px]" placeholder="To date" />
      </div>
    </div>
  );
}

function ReportsContent() {
  const [tab, setTab] = useState<"missed" | "history">("missed");
  const [missedFrom, setMissedFrom] = useState(daysAgoAD(7));
  const [missedTo, setMissedTo] = useState(localTodayAD());
  const [histFrom, setHistFrom] = useState(daysAgoAD(7));
  const [histTo, setHistTo] = useState(localTodayAD());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-6 w-6" /> Transport Reports
        </h1>
        <p className="text-muted-foreground">Missed pickups and per-trip history over a date range</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "missed" | "history")}>
        <TabsList>
          <TabsTrigger value="missed">Missed Pickups</TabsTrigger>
          <TabsTrigger value="history">Trip History</TabsTrigger>
        </TabsList>

        <TabsContent value="missed">
          <MissedPickupsReport from={missedFrom} to={missedTo} onFrom={setMissedFrom} onTo={setMissedTo} />
        </TabsContent>

        <TabsContent value="history">
          <TripHistoryReport from={histFrom} to={histTo} onFrom={setHistFrom} onTo={setHistTo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MissedPickupsReport({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["transport-missed-pickups", from, to],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ missed: MissedPickup[] }>>(
        "/transport/reports/missed-pickups",
        { params: { from: from || undefined, to: to || undefined } }
      );
      return res.data?.data?.missed || [];
    },
  });

  const errorMessage = errMessage(error);

  const COLUMNS: Column<MissedPickup>[] = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      value: (r) => r.date,
      render: (r) => (
        <div>
          <div className="font-medium">{r.date_bs || r.date}</div>
          {r.date_bs && <div className="text-xs text-muted-foreground tabular-nums">{r.date} AD</div>}
        </div>
      ),
    },
    {
      key: "student_name",
      label: "Student",
      sortable: true,
      value: (r) => r.student_name ?? "",
      render: (r) => r.student_name || <span className="text-muted-foreground">Unknown student</span>,
    },
    {
      key: "direction",
      label: "Direction",
      sortable: true,
      value: (r) => r.direction ?? "",
      render: (r) => (
        <Badge variant="outline" className="capitalize">
          {r.direction === "morning" ? "Morning" : "Afternoon"}
        </Badge>
      ),
    },
    {
      key: "bus",
      label: "Bus",
      sortable: true,
      value: (r) => r.bus ?? "",
      render: (r) => r.bus || "—",
    },
  ];

  return (
    <div className="space-y-4">
      <DateRangePicker from={from} to={to} onFrom={onFrom} onTo={onTo} />
      <Card>
        <CardContent className="p-0">
          <DataTable<MissedPickup>
            columns={COLUMNS}
            rows={data || []}
            rowKey={(r) => `${r.student_id}-${r.date}-${r.direction}`}
            loading={isLoading || isFetching}
            error={errorMessage}
            onRetry={() => refetch()}
            exportFileName="missed-pickups"
            empty={{
              icon: AlertTriangle,
              title: "No missed pickups in this range",
              body: "Every allocated student was picked up — nothing to report.",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TripHistoryReport({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["transport-trip-history", from, to],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ trips: TripHistoryRow[] }>>(
        "/transport/reports/trip-history",
        { params: { from: from || undefined, to: to || undefined } }
      );
      return res.data?.data?.trips || [];
    },
  });

  const errorMessage = errMessage(error);

  const statusVariant = (status: string) =>
    status === "running" ? "success" : status === "cancelled" ? "destructive" : status === "completed" ? "default" : "secondary";

  const COLUMNS: Column<TripHistoryRow>[] = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      value: (r) => r.date,
      render: (r) => (
        <div>
          <div className="font-medium">{r.date_bs || r.date}</div>
          {r.date_bs && <div className="text-xs text-muted-foreground tabular-nums">{r.date} AD</div>}
        </div>
      ),
    },
    {
      key: "direction",
      label: "Direction",
      sortable: true,
      value: (r) => r.direction ?? "",
      render: (r) => (
        <Badge variant="outline" className="capitalize">
          {r.direction === "morning" ? "Morning" : "Afternoon"}
        </Badge>
      ),
    },
    {
      key: "bus",
      label: "Bus",
      sortable: true,
      value: (r) => r.bus ?? "",
      render: (r) => r.bus || "—",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status ?? "",
      render: (r) => (
        <Badge variant={statusVariant(r.status)} className="capitalize">
          {r.status}
        </Badge>
      ),
    },
    {
      key: "stops_visited",
      label: "Stops",
      align: "center",
      sortable: true,
      value: (r) => r.stops_visited ?? 0,
      render: (r) => (
        <span className="tabular-nums">
          {r.stops_visited}/{r.stops_total}
        </span>
      ),
    },
    {
      key: "on_time_pct",
      label: "On-time",
      align: "right",
      sortable: true,
      value: (r) =>
        r.stops_visited > 0 ? Math.round((r.stops_on_time / r.stops_visited) * 100) : -1,
      render: (r) =>
        r.stops_visited > 0 ? (
          <span className="tabular-nums font-medium">
            {Math.round((r.stops_on_time / r.stops_visited) * 100)}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "boarded",
      label: "Boarded",
      align: "right",
      sortable: true,
      value: (r) => r.boarded ?? 0,
      render: (r) => <span className="tabular-nums">{r.boarded}</span>,
    },
    {
      key: "missed",
      label: "Missed",
      align: "right",
      sortable: true,
      value: (r) => r.missed ?? 0,
      render: (r) =>
        r.missed > 0 ? (
          <span className="font-medium tabular-nums text-destructive">{r.missed}</span>
        ) : (
          <span className="tabular-nums text-muted-foreground">0</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <DateRangePicker from={from} to={to} onFrom={onFrom} onTo={onTo} />
      <Card>
        <CardContent className="p-0">
          <DataTable<TripHistoryRow>
            columns={COLUMNS}
            rows={data || []}
            rowKey={(r) => r.instance_id}
            loading={isLoading || isFetching}
            error={errorMessage}
            onRetry={() => refetch()}
            exportFileName="trip-history"
            empty={{
              icon: Bus,
              title: "No trips in this range",
              body: "Trips appear here once runs are generated for these dates.",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
