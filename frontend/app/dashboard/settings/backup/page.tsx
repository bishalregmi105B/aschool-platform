"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Database, Download, RefreshCw, Clock, CheckCircle, AlertCircle, HardDrive,
} from "lucide-react";

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

  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load backup status. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" /> Database Backup
          </h1>
          <p className="text-muted-foreground">
            Manage and monitor automated database backups
          </p>
        </div>
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
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Last Backup</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {isLoading
                    ? "Loading..."
                    : status?.last_backup_at
                      ? new Date(status.last_backup_at).toLocaleString()
                      : "No backup recorded yet"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Scheduled</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {status?.scheduled_time ?? "03:00 UTC daily"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <HardDrive className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Destination</p>
                <p className="text-muted-foreground text-sm mt-1 capitalize">
                  {status?.backup_destination ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup configuration info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup Configuration</CardTitle>
          <CardDescription>Current backup settings and schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Method</span>
                <Badge>pg_dump + gzip</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Schedule</span>
                <span className="text-sm font-medium">Daily at 03:00 UTC</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Storage</span>
                <Badge variant="outline" className="capitalize">
                  {status?.backup_destination ?? "Cloudflare R2"}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {status?.status ?? "Configured"}
                </Badge>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">How Backups Work</h4>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Automated daily backups run at 03:00 UTC via Celery Beat</li>
                <li>Database is exported using <code className="bg-muted px-1 rounded">pg_dump</code> and compressed with gzip</li>
                <li>Compressed file is uploaded to Cloudflare R2 or local storage</li>
                <li>Filename format: <code className="bg-muted px-1 rounded">backup_YYYY-MM-DD.sql.gz</code></li>
                <li>Trigger manual backup using the button above</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning note */}
      <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Important</p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                Manual backups are queued asynchronously via Celery. Ensure the Celery worker is running.
                For production restore procedures, contact your system administrator.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
