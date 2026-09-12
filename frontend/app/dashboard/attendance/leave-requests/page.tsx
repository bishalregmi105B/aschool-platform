"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import { CheckCircle2, XCircle, Clock, CalendarDays, CalendarClock } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface LeaveRequest {
  id: string;
  user_id: string | null;
  staff_name: string | null;
  leave_type: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
}

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: "Sick",
  casual: "Casual",
  earned: "Earned",
  maternity: "Maternity",
};

function leaveDays(lr: LeaveRequest): number {
  const start = new Date(lr.start_date);
  const end = new Date(lr.end_date);
  const ms = end.getTime() - start.getTime();
  if (Number.isNaN(ms) || ms < 0) return 1;
  return Math.floor(ms / 86_400_000) + 1;
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function LeaveRequestsPage() {
  return (
    <PluginGate slug="attendance">
      <LeaveRequestsInner />
    </PluginGate>
  );
}

function LeaveRequestsInner() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leave-requests", statusFilter],
    queryFn: async () => {
      const params = statusFilter === "all" ? {} : { status: statusFilter };
      const res = await api.get("/attendance/leave-requests", { params });
      return (res.data?.data || []) as LeaveRequest[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) =>
      api.post(`/attendance/leave-requests/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      toast.success(
        "Leave approved — attendance stamped for the date range",
      );
    },
    onError: () => toast.error("Failed to approve leave"),
  });

  const reject = useMutation({
    mutationFn: async (payload: { id: string; reason: string }) =>
      api.post(`/attendance/leave-requests/${payload.id}/reject`, {
        rejection_reason: payload.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      setRejecting(null);
      setRejectionReason("");
      toast.success("Leave rejected");
    },
    onError: () => toast.error("Failed to reject leave"),
  });

  const requests = data || [];
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const REQUEST_COLUMNS: Column<any>[] = [
    { key: "staff_name", label: "Staff", sortable: true, value: (lr) => lr.staff_name ?? "", render: (lr) => <span className="font-medium">{lr.staff_name || "Unknown staff"}</span> },
    { key: "leave_type", label: "Type", sortable: true, value: (lr) => lr.leave_type ?? "", render: (lr) => LEAVE_TYPE_LABELS[lr.leave_type || ""] || lr.leave_type || "—" },
    { key: "dates", label: "Dates", sortable: true, value: (lr) => lr.start_date ?? "", render: (lr) => <span className="whitespace-nowrap">{lr.start_date} → {lr.end_date}</span> },
    { key: "days", label: "Days", align: "right", sortable: true, value: (lr) => leaveDays(lr), render: (lr) => leaveDays(lr) },
    { key: "reason", label: "Reason", value: (lr) => lr.reason ?? "", render: (lr) => <span className="max-w-[280px] truncate block">{lr.reason || "—"}</span> },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (lr) => lr.status ?? "",
      render: (lr) => (
        <StatusPill
          status={lr.status === "approved" ? "approved" : lr.status === "rejected" ? "rejected" : "pending"}
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (lr) =>
        lr.status === "pending" ? (
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={approve.isPending}
              onClick={(e) => { e.stopPropagation(); approve.mutate(lr.id); }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#107c10" }} />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={(e) => {
                e.stopPropagation();
                setRejecting(lr);
                setRejectionReason("");
              }}
            >
              <XCircle className="h-3.5 w-3.5" style={{ color: "#c42b1c" }} />
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-[color:var(--w11-text-secondary)] text-xs">
            {lr.status === "rejected" && lr.rejection_reason ? lr.rejection_reason : "—"}
          </span>
        ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<CalendarClock className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Leave Requests"
        subtitle="बिदा अनुरोध · Approve or reject staff leave requests. Approved leaves are written to the teacher attendance register."
        actions={
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />
      <AOSPageBody>
        <FilterCommandBar>
          <div className="flex items-center gap-1.5">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
                className="capitalize"
              >
                {s === "pending" && (
                  <Clock className="mr-1 h-3.5 w-3.5" style={{ color: "#d83b01" }} />
                )}
                {s}
              </Button>
            ))}
          </div>
        </FilterCommandBar>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Couldn't load leave requests"
            onRetry={() => refetch()}
          />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={
              statusFilter === "pending"
                ? "No pending leave requests"
                : `No ${statusFilter === "all" ? "" : statusFilter} leave requests`
            }
            body="Staff-submitted leave requests appear here for approval."
          />
        ) : (
          <DataPanel bodyClassName="p-0">
            <DataTable
              columns={REQUEST_COLUMNS}
              rows={requests}
              rowKey={(lr) => lr.id}
              searchable
              searchPlaceholder="Search leave requests…"
              exportFileName="leave-requests"
              dense
            />
          </DataPanel>
        )}

        {pendingCount > 0 && statusFilter === "pending" && (
          <p className="text-[color:var(--w11-text-secondary)] text-sm mt-4">
            {pendingCount} request{pendingCount === 1 ? "" : "s"} awaiting review
          </p>
        )}

        <Dialog
          open={rejecting !== null}
          onOpenChange={(open) => {
            if (!open) setRejecting(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reject this leave request?</DialogTitle>
              <DialogDescription>
                {rejecting?.staff_name &&
                  `${rejecting.staff_name} · ${rejecting?.start_date} → ${rejecting?.end_date}. `}
                The requester will see the rejection and your note. They can
                submit a new request afterwards.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Reason (shown to the requester)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejecting(null)}
              >
                Keep pending
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={reject.isPending}
                onClick={() => {
                  if (!rejecting) return;
                  reject.mutate({
                    id: rejecting.id,
                    reason: rejectionReason.trim(),
                  });
                }}
              >
                Reject request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
