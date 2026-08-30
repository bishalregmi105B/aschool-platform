"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Check, X, Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { displayBS } from "@/lib/nepali_date";

interface StaffOption {
  id: string;
  full_name: string;
  role: string;
}

function daysBetween(from: string, to: string): number | null {
  if (!from || !to) return null;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return Math.round((end - start) / 86400000) + 1;
}

export default function LeavesPage() {
  return <PluginGate slug="hr"><LeavesContent /></PluginGate>;
}

function LeavesContent() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [showApply, setShowApply] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["leaves", filter],
    queryFn: async () => { const r = await api.get("/hr/leaves", { params: { status: filter !== "all" ? filter : undefined } }); return r.data; },
    retry: 1,
  });

  const leaves = data?.data || [];

  const approve = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => (await api.patch(`/hr/leaves/${id}`, { status: action })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leaves"] }); toast.success("Updated!"); },
    onError: () => toast.error("Action failed"),
  });

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hr"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold">Leave Management</h1>
        </div>
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load leave requests. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hr"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1"><h1 className="text-2xl font-bold">Leave Management</h1><p className="text-muted-foreground">Review and manage staff leave requests</p></div>
        <Button onClick={() => setShowApply(true)}><Plus className="h-4 w-4 mr-2" /> Apply Leave</Button>
      </div>

      <div className="flex gap-2">
        {["pending", "approved", "rejected", "all"].map((f: any) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {leaves.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No leave requests</TableCell></TableRow>
              ) : leaves.map((l: any) => {
                const days = l.days || (l.from_date && l.to_date ? Math.ceil((new Date(l.to_date).getTime() - new Date(l.from_date).getTime()) / 86400000) + 1 : 1);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.staff_name}</TableCell>
                    <TableCell><Badge variant="outline">{l.leave_type || l.type}</Badge></TableCell>
                    <TableCell>{l.from_date ? displayBS(l.from_date) : "—"}</TableCell>
                    <TableCell>{l.to_date ? displayBS(l.to_date) : "—"}</TableCell>
                    <TableCell>{days}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{l.reason || "—"}</TableCell>
                    <TableCell><Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge></TableCell>
                    <TableCell>
                      {l.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="text-green-600" onClick={() => approve.mutate({ id: l.id, action: "approved" })}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-600" onClick={() => approve.mutate({ id: l.id, action: "rejected" })}><X className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showApply ? (
        <ApplyLeaveDialog onClose={() => setShowApply(false)} />
      ) : null}
    </div>
  );
}

function ApplyLeaveDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [staffId, setStaffId] = useState("");
  const [leaveType, setLeaveType] = useState("sick");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: staffData } = useQuery<any>({
    queryKey: ["staff-options-leave"],
    queryFn: async () => {
      const r = await api.get("/staff", { params: { per_page: 100 } });
      return (r.data?.data || []) as StaffOption[];
    },
  });
  const staffOptions: StaffOption[] = staffData || [];
  const days = daysBetween(fromDate, toDate);

  const apply = useMutation({
    mutationFn: async () =>
      (
        await api.post("/hr/leave", {
          user_id: staffId,
          leave_type: leaveType,
          start_date: fromDate,
          end_date: toDate,
          days: days ?? 1,
          reason: reason.trim() || undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
      toast.success("Leave request submitted");
      onClose();
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.error || "Failed to submit leave request"),
  });

  const canSubmit = !!staffId && !!fromDate && !!toDate && days !== null && !apply.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply Leave</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Staff Member</Label>
            <select
              className="w-full border rounded-md p-2"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              <option value="">Select staff</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.role})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <select
                className="w-full border rounded-md p-2"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
              >
                <option value="sick">Sick</option>
                <option value="casual">Casual</option>
                <option value="emergency">Emergency</option>
                <option value="maternity">Maternity</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Days</Label>
              <Input value={days ?? "—"} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Brief reason for the leave"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => apply.mutate()} disabled={!canSubmit}>
            {apply.isPending ? <Spinner size="sm" className="mr-2" /> : null}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
