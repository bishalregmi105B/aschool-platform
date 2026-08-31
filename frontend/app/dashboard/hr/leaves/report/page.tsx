"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { CalendarOff, CheckCircle2, XCircle, Clock, Download } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { displayBS } from "@/lib/nepali_date";

interface LeaveRequest {
  id: string;
  staff_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
}

export default function LeaveReportPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Per-staff aggregate period (server-side /hr/leave-report route).
  const [reportYear, setReportYear] = useState<number>(
    () => new Date().getFullYear(),
  );
  const [reportMonth, setReportMonth] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: allLeaves, isLoading, isError, refetch } = useQuery<any>({
    // Aggregate cards must reflect every request, not just the filtered
    // slice — fetch the full list once and compute both from it.
    queryKey: ["staff-leaves", "report"],
    queryFn: async () => {
      // per_page is capped at 100 server-side — request the max so the
      // aggregates cover as much history as the list endpoint serves.
      const res = await api.get<ApiResponse<LeaveRequest[]>>("/hr/leaves", {
        params: { per_page: 100 },
      });
      return res.data.data || [];
    },
    retry: 1,
  });

  // Server-side per-staff aggregation: totals by leave type for the selected
  // month/year, plus a ?format=csv download of exactly this table.
  const reportParams = {
    year: reportYear,
    month: reportMonth !== "all" ? Number(reportMonth) : undefined,
  };
  const { data: staffReport, isLoading: reportLoading } = useQuery<any>({
    queryKey: ["leave-report", reportYear, reportMonth],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/hr/leave-report", {
        params: reportParams,
      });
      return res.data.data || {};
    },
    retry: 1,
  });
  const staffRows: Array<{
    user_id: string;
    staff_name: string;
    by_type: Record<string, { days: number; requests: number }>;
    total_days: number;
    requests: number;
  }> = staffReport?.staff || [];
  const reportTypes: string[] = staffReport?.leave_types || [];

  const exportSummaryCsv = async () => {
    try {
      const res = await api.get("/hr/leave-report", {
        params: { ...reportParams, format: "csv" },
        responseType: "blob",
      });
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "text/csv;charset=utf-8;" }),
      );
      const a = document.createElement("a");
      a.href = url;
      const period =
        reportMonth !== "all"
          ? `${reportYear}-${String(reportMonth).padStart(2, "0")}`
          : `${reportYear}`;
      a.download = `leave_report_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Per-staff leave summary exported");
    } catch {
      toast.error("Failed to export leave summary");
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/hr/leaves/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-leaves"] });
      toast.success("Leave status updated");
    },
    onError: () => toast.error("Failed to update leave status"),
  });

  const leaves = allLeaves || [];
  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? leaves
        : leaves.filter((l: LeaveRequest) => l.status === statusFilter),
    [leaves, statusFilter],
  );

  const stats = useMemo(() => {
    const byStatus = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    const byType: Record<string, { requests: number; days: number }> = {};
    let totalDays = 0;
    (leaves as LeaveRequest[]).forEach((l) => {
      if (l.status && l.status in byStatus) {
        byStatus[l.status as keyof typeof byStatus] += 1;
      }
      const type = (l.leave_type || "unknown").toLowerCase();
      if (!byType[type]) byType[type] = { requests: 0, days: 0 };
      byType[type].requests += 1;
      const days = Number(l.days) || 0;
      byType[type].days += days;
      totalDays += days;
    });
    return { byStatus, byType, totalDays };
  }, [leaves]);

  const exportCsv = () => {
    const headers = [
      "Staff Name", "Leave Type", "Start Date", "End Date", "Days", "Status", "Reason",
    ];
    const escape = (value: unknown) => {
      const str = value === null || value === undefined ? "" : String(value);
      // Guard against CSV formula injection and keep commas/quotes intact.
      const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = filtered.map((l: LeaveRequest) =>
      [
        escape(l.staff_name || "Unknown Staff"),
        escape(l.leave_type),
        escape(l.start_date ? displayBS(l.start_date) : ""),
        escape(l.end_date ? displayBS(l.end_date) : ""),
        escape(l.days ?? ""),
        escape(l.status),
        escape(l.reason || ""),
      ].join(","),
    );
    const csv = [headers.map(escape).join(","), ...rows].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave_report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} row${filtered.length === 1 ? "" : "s"}`);
  };

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load leave requests. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarOff className="h-6 w-6" /> Leave Report & Approvals
        </h1>
        <p className="text-muted-foreground">Staff time-off summary, export and approvals</p>
      </div>

      {/* Status summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <CalendarOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaves.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{stats.byStatus.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.byStatus.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.byStatus.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Leave-days breakdown by type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Leave Days by Type</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(stats.byType).length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No leave data yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(stats.byType).map(([type, agg]) => (
                <div
                  key={type}
                  className="rounded-lg border bg-muted/30 px-4 py-3"
                >
                  <p className="text-sm font-medium capitalize">{type}</p>
                  <p className="text-2xl font-bold">{agg.days}</p>
                  <p className="text-xs text-muted-foreground">
                    days across {agg.requests} request{agg.requests === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Total leave days across all requests: <span className="font-semibold text-foreground">{stats.totalDays}</span>
          </p>
        </CardContent>
      </Card>

      {/* Per-staff aggregate for a month/year — served by GET /hr/leave-report */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Leave Days per Staff</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Aggregated leave totals by type for the selected period
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={reportMonth}
              onValueChange={setReportMonth}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Whole year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Whole year</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i, 1).toLocaleString(undefined, { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(reportYear)}
              onValueChange={(val) => setReportYear(Number(val))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => {
                  const y = new Date().getFullYear() - i;
                  return (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportSummaryCsv} disabled={reportLoading}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                {reportTypes.map((t) => (
                  <TableHead key={t} className="capitalize">{t}</TableHead>
                ))}
                <TableHead>Total Days</TableHead>
                <TableHead>Requests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportLoading ? (
                <TableRow>
                  <TableCell colSpan={reportTypes.length + 3} className="text-center py-6">
                    <Spinner size="sm" className="mx-auto" />
                  </TableCell>
                </TableRow>
              ) : staffRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={reportTypes.length + 3} className="text-center py-8 text-muted-foreground">
                    No leave records for this period.
                  </TableCell>
                </TableRow>
              ) : (
                staffRows.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-medium">{row.staff_name}</TableCell>
                    {reportTypes.map((t) => (
                      <TableCell key={t}>{row.by_type?.[t]?.days ?? 0}</TableCell>
                    ))}
                    <TableCell className="font-semibold">{row.total_days}</TableCell>
                    <TableCell>{row.requests}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter by Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l: LeaveRequest) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.staff_name || "Unknown Staff"}</TableCell>
                  <TableCell className="capitalize">{l.leave_type}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {l.start_date ? displayBS(l.start_date) : "—"} -{" "}
                    {l.end_date ? displayBS(l.end_date) : "—"}
                  </TableCell>
                  <TableCell>{l.days || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {l.reason || "No reason provided"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      l.status === "approved" ? "success" :
                      l.status === "rejected" ? "destructive" : "secondary"
                    }>
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {l.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => updateStatusMutation.mutate({ id: l.id, status: "approved" })}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => updateStatusMutation.mutate({ id: l.id, status: "rejected" })}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No leave requests found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
