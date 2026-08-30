"use client";

import { useQuery } from "@tanstack/react-query";
import { getHistory, type ImportLog } from "@/lib/services/iemis.service";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { History, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  partial: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  processing: <Clock className="h-4 w-4 text-blue-500" />,
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  partial: "bg-orange-100 text-orange-800",
  failed: "bg-red-100 text-red-800",
  processing: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
};

const FORMAT_LABELS: Record<string, string> = {
  student_namewise: "Students",
  school_level: "School Data",
};

export default function IemisHistoryPage() {
  const { data: logs, isLoading, isError, refetch } = useQuery({
    queryKey: ["iemis-history"],
    queryFn: async () => {
      const res = await getHistory(1);
      return (res.items ?? []) as ImportLog[];
    },
    retry: 1,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/iemis-import">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" /> IEMIS Import History
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">All import jobs for this school</p>
        </div>
      </div>

      {isError ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load import history. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <PageLoader />
      ) : !logs?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No imports yet.</p>
            <Link href="/dashboard/iemis-import">
              <Button className="mt-4" size="sm">Start First Import</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Imported</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[log.status] ?? ""}`}>
                        {STATUS_ICON[log.status]}
                        {log.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{FORMAT_LABELS[log.format_code] ?? log.format_code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                      {log.filename ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">{log.total_rows}</TableCell>
                    <TableCell className="text-right text-sm text-green-700 font-medium">{log.imported_rows}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{log.skipped_rows}</TableCell>
                    <TableCell className="text-right text-sm text-red-600">{log.error_rows}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.completed_at
                        ? new Date(log.completed_at).toLocaleString()
                        : new Date(log.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
