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
import { CalendarOff, CheckCircle2, XCircle, Clock, Download, Check, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useUrlFilters } from "@/components/ui/filter-bar";
import { ErrorState } from "@/components/ui/empty-state";
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

const REQUEST_COLUMNS = (
  t: (en: string, ne: string) => string,
  decide: (l: LeaveRequest, status: "approved" | "rejected") => void,
): Column<LeaveRequest>[] => [
  { key: "staff_name", label: t("Staff Name", "कर्मचारी नाम"), sortable: true, value: (l) => l.staff_name, render: (l) => <span className="font-medium">{l.staff_name || t("Unknown Staff", "अज्ञात")}</span> },
  { key: "leave_type", label: t("Type", "प्रकार"), sortable: true, value: (l) => l.leave_type, render: (l) => <span className="capitalize">{l.leave_type}</span> },
  { key: "duration", label: t("Duration", "अवधि"), value: (l) => l.start_date, render: (l) => (
    <span className="text-sm whitespace-nowrap">
      {l.start_date ? displayBS(l.start_date) : "—"} - {l.end_date ? displayBS(l.end_date) : "—"}
    </span>
  ) },
  { key: "days", label: t("Days", "दिन"), align: "right", sortable: true, value: (l) => l.days ?? 0, render: (l) => l.days || "—" },
  { key: "reason", label: t("Reason", "कारण"), value: (l) => l.reason ?? "", render: (l) => <span className="text-sm max-w-[200px] truncate block" style={{ color: "var(--w11-text-secondary)" }}>{l.reason || t("No reason provided", "कारण छैन")}</span> },
  {
    key: "status",
    label: t("Status", "अवस्था"),
    sortable: true,
    value: (l) => l.status,
    render: (l) => <StatusChip status={l.status} className="capitalize" />,
  },
  {
    key: "actions",
    label: t("Actions", "कार्य"),
    noExport: true,
    render: (l) =>
      l.status === "pending" ? (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={(e) => { e.stopPropagation(); decide(l, "approved"); }}>
            <Check className="h-3 w-3" style={{ color: "#107c10" }} /> {t("Approve", "स्वीकृति")}
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={(e) => { e.stopPropagation(); decide(l, "rejected"); }}>
            <XCircle className="h-3 w-3" style={{ color: "#c42b1c" }} /> {t("Reject", "अस्वीकृति")}
          </Button>
        </div>
      ) : null,
  },
];

export default function LeaveReportPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const { values: urlFilters, setValues: setUrlFilters } = useUrlFilters(["status"]);
  const statusFilter = urlFilters.status || "all";
  const setStatusFilter = (v: string) => setUrlFilters({ status: v === "all" ? "" : v });
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
      toast.success(t("Per-staff leave summary exported", "सारांश निर्यात भयो"));
    } catch {
      toast.error(t("Failed to export leave summary", "निर्यात गर्न सकिएन"));
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/hr/leaves/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leave-report"] });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      toast.success(t("Leave status updated", "अवस्था अद्यावधिक भयो"));
    },
    onError: () => toast.error(t("Failed to update leave status", "अद्यावधिक गर्न सकिएन")),
  });

  // Inline pending→approved/rejected with confirm on rejection (plan 34-31).
  const decide = (l: LeaveRequest, status: "approved" | "rejected") => {
    const run = () => updateStatusMutation.mutate({ id: l.id, status });
    if (status === "rejected") {
      void confirm({
        title: t("Reject this leave request?", "बिदा अनुरोध अस्वीकृत गर्ने?"),
        body: t(
          `Reject ${l.staff_name}'s ${l.days || ""} day(s) leave? They will be notified.`,
          `${l.staff_name} को ${l.days || ""} दिनको बिदा अस्वीकृत गर्ने?`
        ),
        confirmLabel: t("Reject", "अस्वीकृत"),
        tone: "danger",
      }).then((ok) => ok && run());
      return;
    }
    run();
  };

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

  const columns = REQUEST_COLUMNS(t, decide);

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title={t("Leave Report & Approvals", "बिदा प्रतिवेदन")} />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <ErrorState
              title={t("Failed to load leave requests.", "अनुरोध लोड गर्न सकिएन।")}
              onRetry={() => refetch()}
            />
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<CalendarOff className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Leave Report & Approvals", "बिदा प्रतिवेदन र स्वीकृति")}
        subtitle={`${leaves.length} ${t("requests", "अनुरोध")} · ${stats.totalDays} ${t("leave days", "बिदा दिन")} · ${stats.byStatus.pending} ${t("pending", "बाँकी")}`}
      />
      <AOSPageBody>
        {/* Status summary cards */}
        <StatGrid min={170}>
          <KpiCard
            label={t("Total Requests", "कुल अनुरोध")}
            value={leaves.length}
            icon={<CalendarOff className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
          <KpiCard
            label={t("Pending", "बाँकी")}
            value={stats.byStatus.pending}
            color="#d83b01"
            icon={<Clock className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
          <KpiCard
            label={t("Approved", "स्वीकृत")}
            value={stats.byStatus.approved}
            color="#107c10"
            icon={<CheckCircle2 className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label={t("Rejected", "अस्वीकृत")}
            value={stats.byStatus.rejected}
            color="#c42b1c"
            icon={<XCircle className="h-4 w-4" style={{ color: "#c42b1c" }} />}
          />
        </StatGrid>

        {/* Leave-days breakdown by type */}
        <DataPanel
          title={t("Leave Days by Type", "प्रकारअनुसार बिदा दिन")}
          className="mb-4"
        >
          {Object.keys(stats.byType).length === 0 ? (
            <p className="text-sm py-2" style={{ color: "var(--w11-text-secondary)" }}>
              {t("No leave data yet.", "अझै बिदा डाटा छैन।")}
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
                    {t("days", "दिन")} × {agg.requests}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm" style={{ color: "var(--w11-text-secondary)" }}>
            {t("Total leave days:", "कुल बिदा दिन:")} <span className="font-semibold tabular-nums" style={{ color: "var(--w11-text-primary)" }}>{stats.totalDays}</span>
          </p>
        </DataPanel>

        {/* Per-staff aggregate for a month/year — served by GET /hr/leave-report */}
        <DataPanel
          className="mb-4"
          bodyClassName="p-0"
          title={t("Leave Days per Staff", "कर्मचारीअनुसार बिदा दिन")}
          actions={
            <div className="flex items-center gap-2">
              <Select
                value={reportMonth}
                onValueChange={setReportMonth}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder={t("Whole year", "पूरो वर्ष")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("Whole year", "पूरो वर्ष")}</SelectItem>
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
                <Download className="h-4 w-4 mr-2" /> {t("Export CSV", "CSV निर्यात")}
              </Button>
            </div>
          }
        >
          <p className="px-4 pt-3 text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            {t("Aggregated leave totals by type for the selected period", "चयनित अवधिको प्रकारअनुसार जम्मा")}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Staff", "कर्मचारी")}</TableHead>
                {reportTypes.map((rt) => (
                  <TableHead key={rt} className="capitalize">{rt}</TableHead>
                ))}
                <TableHead>{t("Total Days", "कुल दिन")}</TableHead>
                <TableHead>{t("Requests", "अनुरोध")}</TableHead>
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
                    {t("No leave records for this period.", "यस अवधिको रेकर्ड छैन।")}
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
          <span className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>{t("Filter by Status:", "अवस्थाअनुसार:")}</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("All Statuses", "सबै अवस्था")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Statuses", "सबै अवस्था")}</SelectItem>
              <SelectItem value="pending">{t("Pending", "बाँकी")}</SelectItem>
              <SelectItem value="approved">{t("Approved", "स्वीकृत")}</SelectItem>
              <SelectItem value="rejected">{t("Rejected", "अस्वीकृत")}</SelectItem>
              <SelectItem value="cancelled">{t("Cancelled", "रद्द")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-2" /> {t("Export CSV", "CSV निर्यात")}
          </Button>
        </FilterCommandBar>

        <DataPanel bodyClassName="p-0">
          <DataTable<LeaveRequest>
            columns={columns}
            loading={isLoading}
            rows={filtered}
            rowKey={(l) => l.id}
            searchable
            searchPlaceholder={t("Search leave requests…", "खोज्नुहोस्…")}
            exportFileName="leave-requests"
            empty={{ icon: Plus, title: t("No leave requests found", "कुनै अनुरोध भेटिएन"), body: t("Requests from the staff leave page land here.", "स्टाफ बिदा पृष्ठबाट अनुरोध यहाँ आउँछ।") }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
