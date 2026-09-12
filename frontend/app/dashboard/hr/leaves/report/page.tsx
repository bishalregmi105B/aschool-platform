"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { CalendarOff, CheckCircle2, XCircle, Clock, Download } from "lucide-react";
import { format } from "date-fns";
import { displayBS } from "@/lib/nepali_date";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

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

const REQUEST_COLUMNS: Column<LeaveRequest>[] = [
  { key: "staff_name", label: "Staff Name", sortable: true, value: (l) => l.staff_name, render: (l) => <span className="font-medium">{l.staff_name || "Unknown Staff"}</span> },
  { key: "leave_type", label: "Type", sortable: true, value: (l) => l.leave_type, render: (l) => <span className="capitalize">{l.leave_type}</span> },
  { key: "duration", label: "Duration", value: (l) => l.start_date, render: (l) => (
    <span className="text-sm whitespace-nowrap">
      {l.start_date ? displayBS(l.start_date) : "—"} - {l.end_date ? displayBS(l.end_date) : "—"}
    </span>
  ) },
  { key: "days", label: "Days", align: "right", sortable: true, value: (l) => l.days ?? 0, render: (l) => l.days || "—" },
  { key: "reason", label: "Reason", value: (l) => l.reason ?? "", render: (l) => <span className="text-sm max-w-[200px] truncate block" style={{ color: "var(--w11-text-secondary)" }}>{l.reason || "No reason provided"}</span> },
  {
    key: "status",
    label: "Status",
    sortable: true,
    value: (l) => l.status,
    render: (l) => <StatusChip status={l.status} className="capitalize" />,
  },
];

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

  if (isLoading) return <AOSModuleLoadingState label="Loading leave report…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Leave Report & Approvals" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>
                Failed to load leave requests. Please try again.
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
        icon={<CalendarOff className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Leave Report & Approvals"
        subtitle={`${leaves.length} requests · ${stats.totalDays} leave days · ${stats.byStatus.pending} pending`}
      />
      <AOSPageBody>
        {/* Status summary cards */}
        <StatGrid min={170}>
          <KpiCard
            label="Total Requests"
            value={leaves.length}
            icon={<CalendarOff className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
          <KpiCard
            label="Pending"
            value={stats.byStatus.pending}
            color="#d83b01"
            icon={<Clock className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
          <KpiCard
            label="Approved"
            value={stats.byStatus.approved}
            color="#107c10"
            icon={<CheckCircle2 className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label="Rejected"
            value={stats.byStatus.rejected}
            color="#c42b1c"
            icon={<XCircle className="h-4 w-4" style={{ color: "#c42b1c" }} />}
          />
        </StatGrid>

        {/* Leave-days breakdown by type */}
        <DataPanel
          title="Leave Days by Type"
          className="mb-4"
        >
          {Object.keys(stats.byType).length === 0 ? (
            <p className="text-sm py-2" style={{ color: "var(--w11-text-secondary)" }}>
              No leave data yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(stats.byType).map(([type, agg]) => (
                <div
                  key={type}
                  className="rounded-lg border border-[var(--w11-border-subtle)] px-4 py-3"
                  style={{ background: "var(--w11-control-hover)" }}
                >
                  <p className="text-sm font-medium capitalize" style={{ color: "var(--w11-text-primary)" }}>{type}</p>
                  <p className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>{agg.days}</p>
                  <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                    days across {agg.requests} request{agg.requests === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm" style={{ color: "var(--w11-text-secondary)" }}>
            Total leave days across all requests: <span className="font-semibold" style={{ color: "var(--w11-text-primary)" }}>{stats.totalDays}</span>
          </p>
        </DataPanel>

        {/* Per-staff aggregate for a month/year — served by GET /hr/leave-report */}
        <DataPanel
          className="mb-4"
          bodyClassName="p-0"
          title="Leave Days per Staff"
          actions={
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
          }
        >
          <p className="px-4 pt-3 text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            Aggregated leave totals by type for the selected period
          </p>
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
                  <TableCell colSpan={reportTypes.length + 3} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>
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
        </DataPanel>

        <FilterCommandBar>
          <span className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>Filter by Status:</span>
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
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </FilterCommandBar>

        <DataPanel bodyClassName="p-0">
          <DataTable<LeaveRequest>
            columns={REQUEST_COLUMNS}
            rows={filtered}
            rowKey={(l) => l.id}
            searchable
            searchPlaceholder="Search leave requests…"
            exportFileName="leave-requests"
            empty={{ icon: Download, title: "No leave requests found" }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
