"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { History, Eye, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ImportLog {
  id: string;
  /** serializer key — the FE previously read `format`, which does not exist */
  format_code: string;
  status: string;
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  errors: Array<Record<string, unknown> | string>;
  created_at: string;
  filename?: string;
}

export default function ImportHistoryPage() {
  const [selectedLog, setSelectedLog] = useState<ImportLog | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["import-history"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ImportLog[]>>("/iemis/history");
      return res.data.data;
    },
    retry: 1,
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading import history…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Import History" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load import history. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const logs = data || [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<History className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Import History"
        subtitle={`${logs.length} bulk upload ${logs.length === 1 ? "job" : "jobs"} with error logs`}
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date &amp; Time</TableHead>
                <TableHead>Import Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right" style={{ color: "#107c10" }}>Success</TableHead>
                <TableHead className="text-right" style={{ color: "#c42b1c" }}>Failed</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: ImportLog) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {log.created_at ? format(new Date(log.created_at), "MMM d, yyyy HH:mm") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />
                      <span className="capitalize">{(log.format_code || "").replace(/_/g, " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      status={log.status === "completed" ? "completed" : log.status === "failed" ? "failed" : "pending"}
                      label={log.status}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">{log.total_rows ?? 0}</TableCell>
                  <TableCell className="text-right font-semibold" style={{ color: "#107c10" }}>{log.imported_rows ?? 0}</TableCell>
                  <TableCell className="text-right font-semibold" style={{ color: "#c42b1c" }}>{log.error_rows ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                      <Eye className="h-4 w-4 mr-2" /> Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>
                    No import history found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataPanel>

        <Dialog open={!!selectedLog} onOpenChange={(open) => {
          if (!open) setSelectedLog(null);
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Details</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div
                  className="grid grid-cols-2 gap-4 border border-[var(--w11-border-subtle)] rounded-lg p-4"
                  style={{ background: "var(--w11-control-hover)" }}
                >
                  <div>
                    <span className="text-sm block" style={{ color: "var(--w11-text-secondary)" }}>Format</span>
                    <span className="font-medium capitalize">{(selectedLog.format_code || "").replace(/_/g, " ")}</span>
                  </div>
                  <div>
                    <span className="text-sm block" style={{ color: "var(--w11-text-secondary)" }}>Date</span>
                    <span className="font-medium">
                      {selectedLog.created_at ? format(new Date(selectedLog.created_at), "PPP p") : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm block" style={{ color: "var(--w11-text-secondary)" }}>Status</span>
                    <StatusChip
                      status={selectedLog.status === "completed" ? "completed" : "failed"}
                      label={selectedLog.status}
                    />
                  </div>
                  <div>
                    <span className="text-sm block" style={{ color: "var(--w11-text-secondary)" }}>Total Processed</span>
                    <span className="font-medium">{selectedLog.total_rows ?? 0}</span>
                  </div>
                </div>

                {selectedLog.errors && selectedLog.errors.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2" style={{ color: "#c42b1c" }}>Error Log ({selectedLog.error_rows ?? selectedLog.errors.length} failed items)</h3>
                    <div
                      className="p-4 rounded-lg text-sm max-h-60 overflow-y-auto"
                      style={{ background: "rgba(196,43,28,0.08)", color: "#c42b1c" }}
                    >
                      <ul className="list-disc pl-4 space-y-1">
                        {selectedLog.errors.map((err, i) => {
                          const errorMsg = typeof err === 'string' ? err : JSON.stringify(err);
                          return <li key={i}>{errorMsg}</li>;
                        })}
                      </ul>
                    </div>
                  </div>
                )}

                {(selectedLog.imported_rows ?? 0) > 0 && (selectedLog.error_rows ?? 0) === 0 && (
                  <div
                    className="p-4 rounded-lg text-center"
                    style={{ background: "rgba(16,124,16,0.08)", color: "#107c10" }}
                  >
                    All {selectedLog.imported_rows} records were imported successfully. No errors found.
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
