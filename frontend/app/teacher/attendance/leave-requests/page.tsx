"use client";

/**
 * Teacher → My Leave (44.1: "leave — my requests + balance").
 *
 * This route used to re-export the ADMIN student-leave-requests approval
 * page into the teacher frame (wrong object entirely: that queue is for
 * approving STUDENT leave). Teachers' own staff leave is the real task:
 * list mine + apply, via GET/POST /hr-payroll/leave (endpoints the mobile
 * teacher app already consumes). When the HR plugin isn't installed the
 * server answers 404 — we show that honestly instead of a dead grid.
 *
 * Research notes: approval journeys need a per-row status timeline
 * (submitted→approved) so "where is my request" never becomes a support
 * call — same StatusTimeline grammar as the dashboard.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Plane } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { displayBS } from "@/lib/nepali_date";
import { DataPanel, StatusChip } from "@/components/aos/kit/page-kit";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusTimeline } from "@/components/ui/status-timeline";

type Leave = {
  id: string;
  leave_type: string;
  start_date?: string | null;
  end_date?: string | null;
  days?: number | null;
  reason?: string | null;
  status: string;
  approved_at?: string | null;
};

const LEAVE_TYPES = [
  { value: "casual", label: "Casual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "earned", label: "Earned leave" },
  { value: "maternity", label: "Maternity / Paternity" },
  { value: "other", label: "Other" },
];

const FLOW = ["submitted", "approved", "rejected"];

export default function TeacherLeavePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);

  const mine = useQuery({
    queryKey: ["teacher-my-leave", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await api.get<ApiResponse<Leave[] | { items?: Leave[] }>>(
        `/hr-payroll/leave?user_id=${user!.id}&per_page=50`,
      );
      const p = res.data.data;
      return Array.isArray(p) ? p : p?.items || [];
    },
    retry: (failureCount, err) => {
      // Plugin not installed → honest empty state, not a retry storm.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });

  const pluginMissing =
    (mine.error as { response?: { status?: number } } | null)?.response?.status === 404;

  const rows = mine.data || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>My Leave</h1>
          <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
            Apply for staff leave and track what the office decides.
          </p>
        </div>
        <Button className="h-11" onClick={() => setApplyOpen(true)}>
          <Plane className="mr-1 h-4 w-4" /> Apply for leave
        </Button>
      </div>

      <DataPanel title="My requests">
        {mine.isLoading ? (
          <SkeletonList rows={4} />
        ) : pluginMissing ? (
          <EmptyState
            icon={CalendarClock}
            variant="dependency"
            title="HR & Payroll isn't enabled for this school"
            body="Ask the school admin to install the HR module from the Store; leave applications live there."
          />
        ) : mine.isError ? (
          <ErrorState title="Couldn't load your leave" onRetry={() => mine.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Plane}
            title="No leave requests yet"
            body="Approved leave shows up here with its decision date."
            action={{ label: "Apply for leave", onClick: () => setApplyOpen(true) }}
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--w11-border-subtle)" }}>
            {rows.map((l) => {
              const idx = l.status === "approved" ? 1 : l.status === "rejected" ? 2 : 0;
              return (
                <li key={l.id} className="flex flex-wrap items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize" style={{ color: "var(--w11-text-primary)" }}>
                      {l.leave_type} · {l.start_date ? displayBS(l.start_date.slice(0, 10)) : "—"}
                      {l.end_date && l.end_date !== l.start_date ? ` → ${displayBS(l.end_date.slice(0, 10))}` : ""}
                      {l.days != null ? ` (${l.days}d)` : ""}
                    </p>
                    {l.reason && (
                      <p className="mt-0.5 text-xs line-clamp-2" style={{ color: "var(--w11-text-secondary)" }}>{l.reason}</p>
                    )}
                    <div className="mt-2 max-w-xs">
                      <StatusTimeline
                        steps={FLOW.filter((s) => s !== "rejected" || idx === 2).map((s) => ({
                          label: s,
                          at: s === "approved" && l.approved_at ? displayBS(String(l.approved_at).slice(0, 10)) : null,
                        }))}
                        currentIndex={idx}
                        orientation="horizontal"
                      />
                    </div>
                  </div>
                  <StatusChip
                    status={l.status === "approved" ? "present" : l.status === "rejected" ? "absent" : "pending"}
                    label={l.status}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </DataPanel>

      <ApplyDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onDone={() => {
          setApplyOpen(false);
          qc.invalidateQueries({ queryKey: ["teacher-my-leave"] });
        }}
      />
    </div>
  );
}

function ApplyDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");

  const apply = useMutation({
    mutationFn: async () =>
      (
        await api.post("/hr-payroll/leave", {
          leave_type: type,
          start_date: from,
          end_date: to || from,
          reason: reason.trim() || undefined,
        })
      ).data,
    onSuccess: () => {
      toast.success("Leave submitted — the office will review it.");
      setType("");
      setFrom("");
      setTo("");
      setReason("");
      onDone();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : "Couldn't submit the request.");
    },
  });

  const valid = Boolean(type && from);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) apply.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Leave type *</Label>
            <AdvancedSelect value={type} onChange={setType} placeholder="Select…" options={LEAVE_TYPES} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From *</Label>
              <BSDateInput value={from} onChange={(v) => setFrom(v || "")} emit="ad" />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <BSDateInput value={to} onChange={(v) => setTo(v || "")} emit="ad" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-reason">Reason</Label>
            <Textarea id="l-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief note for the office" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!valid || apply.isPending}>
              {apply.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
