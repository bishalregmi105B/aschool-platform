"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { ScrollText } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function BiometricLogsPage() {
  return <PluginGate slug="biometric"><LogsContent /></PluginGate>;
}

function LogsContent() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["biometric-logs", search, status],
    queryFn: async () => { const r = await api.get("/attendance/biometric/logs", { params: { search: search || undefined, status: status !== "all" ? status : undefined } }); return r.data?.data ?? r.data; },
  });

  const logs: any[] = Array.isArray(data) ? data : data?.items ?? [];

  if (isLoading) return <AOSModuleLoadingState label="Loading sync logs…" />;
    if (isError) {
      return (
        <AOSPage>
          <AOSPageHeader title="Biometric Sync Logs" />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load biometric logs. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          </AOSPageBody>
        </AOSPage>
      );
    }

  const LOG_COLUMNS: Column<any>[] = [
    { key: "created_at", label: "Date/Time", sortable: true, value: (l) => l.created_at ?? "", render: (l) => (l.created_at ? displayBS(l.created_at) : "—") },
    { key: "device", label: "Device", sortable: true, value: (l) => l.device_name ?? l.device_id ?? "", render: (l) => <span className="font-medium">{l.device_name ?? l.device_id ?? "—"}</span> },
    { key: "records_synced", label: "Records Synced", align: "right", sortable: true, value: (l) => l.records_synced ?? 0, render: (l) => <span style={{ color: "#107c10" }}>{l.records_synced ?? 0}</span> },
    { key: "records_failed", label: "Records Failed", align: "right", sortable: true, value: (l) => l.records_failed ?? 0, render: (l) => <span style={{ color: "#c42b1c" }}>{l.records_failed ?? 0}</span> },
    { key: "duration_seconds", label: "Duration", align: "right", sortable: true, value: (l) => l.duration_seconds ?? 0, render: (l) => (l.duration_seconds != null ? `${l.duration_seconds}s` : "—") },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (l) => l.status ?? "unknown",
      render: (l) => (
        <StatusChip status={l.status === "success" ? "completed" : l.status === "failed" ? "failed" : l.status ?? "unknown"} label={l.status ?? "unknown"} />
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ScrollText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Biometric Sync Logs"
        subtitle={`${logs.length} device synchronisation ${logs.length === 1 ? "entry" : "entries"}`}
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={LOG_COLUMNS}
            rows={logs}
            rowKey={(l: any) => l.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by device or user..."
            exportFileName="biometric-logs"
            toolbar={
              <AdvancedSelect
                className="w-36"
                value={status}
                onChange={setStatus}
                clearable
                placeholder="All Status"
                options={[
                  { value: "success", label: "Success" },
                  { value: "failed", label: "Failed" },
                  { value: "partial", label: "Partial" },
                ]}
              />
            }
            empty={{ icon: ScrollText, title: "No sync logs found" }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
