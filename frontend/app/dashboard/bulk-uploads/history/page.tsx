"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/spinner";
import { History, Eye, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
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

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load import history. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  const logs = data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-6 w-6" /> Import History
        </h1>
        <p className="text-muted-foreground">Review previous bulk upload jobs and error logs</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Import Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right text-green-600">Success</TableHead>
                <TableHead className="text-right text-red-600">Failed</TableHead>
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
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{(log.format_code || "").replace(/_/g, " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      log.status === "completed" ? "success" :
                      log.status === "failed" ? "destructive" : "secondary"
                    }>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{log.total_rows ?? 0}</TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">{log.imported_rows ?? 0}</TableCell>
                  <TableCell className="text-right text-red-600 font-semibold">{log.error_rows ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                      <Eye className="h-4 w-4 mr-2" /> Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No import history found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => {
        if (!open) setSelectedLog(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/30">
                <div>
                  <span className="text-sm text-muted-foreground block">Format</span>
                  <span className="font-medium capitalize">{(selectedLog.format_code || "").replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground block">Date</span>
                  <span className="font-medium">
                    {selectedLog.created_at ? format(new Date(selectedLog.created_at), "PPP p") : ""}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground block">Status</span>
                  <Badge variant={selectedLog.status === "completed" ? "success" : "destructive"}>
                    {selectedLog.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground block">Total Processed</span>
                  <span className="font-medium">{selectedLog.total_rows ?? 0}</span>
                </div>
              </div>

              {selectedLog.errors && selectedLog.errors.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-600 mb-2">Error Log ({selectedLog.error_rows ?? selectedLog.errors.length} failed items)</h3>
                  <div className="bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 p-4 rounded-lg text-sm max-h-60 overflow-y-auto">
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
                <div className="bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 p-4 rounded-lg text-center">
                  All {selectedLog.imported_rows} records were imported successfully. No errors found.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
