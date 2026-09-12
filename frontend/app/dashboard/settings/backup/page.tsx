"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Database, Download, RefreshCw, Clock, CheckCircle, AlertCircle, HardDrive,
} from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

interface BackupStatus {
  last_backup_at: string | null;
  backup_destination: string;
  scheduled_time: string;
  status: string;
}

export default function DatabaseBackupPage() {
  const [isTriggering, setIsTriggering] = useState(false);

  const { data: status, isLoading, isError, refetch } = useQuery({
    queryKey: ["database-backup-status"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BackupStatus>>("/database-backup");
      return res.data.data;
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  // Hooks must run unconditionally — before any early return below.
  const triggerMutation = useMutation({
    mutationFn: () => api.post("/database-backup/trigger"),
    onMutate: () => setIsTriggering(true),
    onSuccess: () => {
      toast.success("Backup task queued successfully. It will run in the background.");
      setTimeout(() => {
        setIsTriggering(false);
        refetch();
      }, 3000);
    },
    onError: () => {
      toast.error("Failed to trigger backup");
      setIsTriggering(false);
    },
  });

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Database Backup" subtitle="Manage and monitor automated database backups" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                Failed to load backup status. Please try again.
              </p>
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
        icon={<Database className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Database Backup"
        subtitle="Manage and monitor automated database backups"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button
              onClick={() => triggerMutation.mutate()}
              disabled={isTriggering || triggerMutation.isPending}
            >
              {isTriggering ? <Spinner size="sm" className="mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              {isTriggering ? "Queuing Backup..." : "Trigger Backup Now"}
            </Button>
          </div>
        }
      />
      <AOSPageBody>
        <div className="space-y-4">
          {/* Status Cards */}
          <StatGrid min={200}>
            <KpiCard
              icon={<CheckCircle className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
              label="Last Backup"
              value={
                isLoading
                  ? "…"
                  : status?.last_backup_at
                    ? new Date(status.last_backup_at).toLocaleString()
                    : "None yet"
              }
              footnote={status?.last_backup_at ? "" : "No backup recorded yet"}
            />
            <KpiCard
              icon={<Clock className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
              label="Scheduled"
              value={status?.scheduled_time ?? "03:00 UTC daily"}
            />
            <KpiCard
              icon={<HardDrive className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
              label="Destination"
              value={<span className="capitalize">{status?.backup_destination ?? "—"}</span>}
            />
          </StatGrid>

          {/* Backup configuration info */}
          <DataPanel title="Backup Configuration">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-[var(--w11-border-subtle)]">
                  <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>Method</span>
                  <Badge>pg_dump + gzip</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--w11-border-subtle)]">
                  <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>Schedule</span>
                  <span className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>Daily at 03:00 UTC</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--w11-border-subtle)]">
                  <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>Storage</span>
                  <Badge variant="outline" className="capitalize">
                    {status?.backup_destination ?? "Cloudflare R2"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>Status</span>
                  <StatusChip status={status?.status?.toLowerCase() || "active"} label={status?.status ?? "Configured"} />
                </div>
              </div>

              <div
                className="rounded-lg p-4 space-y-2"
                style={{ background: "var(--w11-control-hover)" }}
              >
                <h4 className="font-medium text-sm" style={{ color: "var(--w11-text-primary)" }}>How Backups Work</h4>
                <ul className="text-xs space-y-1.5 list-disc list-inside" style={{ color: "var(--w11-text-secondary)" }}>
                  <li>Automated daily backups run at 03:00 UTC via Celery Beat</li>
                  <li>Database is exported using <code
                    className="px-1 rounded"
                    style={{
                      background: "var(--w11-surface-solid)",
                      fontFamily: "var(--w11-font-mono)",
                    }}
                  >pg_dump</code> and compressed with gzip</li>
                  <li>Compressed file is uploaded to Cloudflare R2 or local storage</li>
                  <li>Filename format: <code
                    className="px-1 rounded"
                    style={{
                      background: "var(--w11-surface-solid)",
                      fontFamily: "var(--w11-font-mono)",
                    }}
                  >backup_YYYY-MM-DD.sql.gz</code></li>
                  <li>Trigger manual backup using the button above</li>
                </ul>
              </div>
            </div>
          </DataPanel>

          {/* Warning note */}
          <div className="win11-infobar warning">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Important</p>
              <p className="text-xs mt-1">
                Manual backups are queued asynchronously via Celery. Ensure the Celery worker is running.
                For production restore procedures, contact your system administrator.
              </p>
            </div>
          </div>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
