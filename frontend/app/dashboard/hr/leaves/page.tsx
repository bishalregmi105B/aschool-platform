"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { ErrorState } from "@/components/ui/empty-state";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FilterCommandBar,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Check, X, Calendar, Plus } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useUrlFilters } from "@/components/ui/filter-bar";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { values: urlFilters, setValues: setUrlFilters } = useUrlFilters(["status"]);
  const filter = urlFilters.status || "pending";
  const setFilter = (v: string) => setUrlFilters({ status: v === "pending" ? "" : v });
  const [showApply, setShowApply] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["leaves", filter],
    queryFn: async () => { const r = await api.get("/hr/leaves", { params: { status: filter !== "all" ? filter : undefined } }); return r.data; },
    retry: 1,
  });

  const leaves = data?.data || [];

  const decide = async (l: any, action: "approved" | "rejected") => {
    if (action === "rejected") {
      // Rejection is terminal for the applicant — confirm with the person
      // and dates named in the body (money-adjacent tone).
      const ok = await confirm({
        title: t("Reject this leave request?", "बिदा अनुरोध अस्वीकार गर्नु?"),
        body: t(
          `Reject the leave request of ${l.staff_name}${l.days ? ` (${l.days} days)` : ""}? They will be notified.`,
          `${l.staff_name} को बिदा अनुरोध अस्वीकार गर्ने।`
        ),
        confirmLabel: t("Reject", "अस्वीकार"),
        tone: "danger",
      });
      if (!ok) return;
    }
    try {
      await api.patch(`/hr/leaves/${l.id}`, { status: action });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      toast.success(
        action === "approved"
          ? t(`Approved for ${l.staff_name}`, `${l.staff_name} लाई स्वीकृत भए`)
          : t(`Rejected for ${l.staff_name}`, `${l.staff_name} लाई अस्वीकृत भए`)
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t("Action failed", "कार्य असफल"));
    }
  };

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title={t("Leave Management", "बिदा ब्यवस्थपन")} />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <ErrorState
              title={t("Failed to load leave requests.", "अनुरोध लोड सकिएन।")}
              onRetry={() => refetch()}
            />
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const pendingCount = filter === "all"
    ? leaves.filter((l: any) => l.status === "pending").length
    : filter === "pending" ? leaves.length : 0;

  const LEAVE_COLUMNS: Column<any>[] = [
    { key: "staff_name", label: t("Staff", "कर्मचारी"), sortable: true, value: (l) => l.staff_name ?? "", render: (l) => <span className="font-medium">{l.staff_name}</span> },
    { key: "leave_type", label: t("Type", "प्रकार"), sortable: true, value: (l) => l.leave_type ?? l.type ?? "", render: (l) => <span className="win11-chip subtle">{l.leave_type || l.type}</span> },
    { key: "from_date", label: t("From", "सुरु"), sortable: true, value: (l) => l.from_date ?? "", render: (l) => (l.from_date ? displayBS(l.from_date) : "—") },
    { key: "to_date", label: t("To", "सम्म"), sortable: true, value: (l) => l.to_date ?? "", render: (l) => (l.to_date ? displayBS(l.to_date) : "—") },
    {
      key: "days",
      label: t("Days", "दिन"),
      align: "right",
      sortable: true,
      value: (l) => l.days ?? 0,
      render: (l) => {
        const days = l.days || (l.from_date && l.to_date ? Math.ceil((new Date(l.to_date).getTime() - new Date(l.from_date).getTime()) / 86400000) + 1 : 1);
        return days;
      },
    },
    { key: "reason", label: t("Reason", "कारण"), value: (l) => l.reason ?? "", render: (l) => <span className="max-w-[200px] truncate block">{l.reason || "—"}</span> },
    {
      key: "status",
      label: t("Status", "अवस्था"),
      sortable: true,
      value: (l) => l.status ?? "",
      render: (l) => <StatusChip status={l.status} className="capitalize" />,
    },
    {
      key: "actions",
      label: t("Actions", "कार्य"),
      noExport: true,
      render: (l) =>
        l.status === "pending" ? (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" aria-label={t("Approve", "स्वीकार")} onClick={(e) => { e.stopPropagation(); decide(l, "approved"); }}><Check className="h-4 w-4" style={{ color: "#107c10" }} /></Button>
            <Button size="icon" variant="ghost" aria-label={t("Reject", "अस्वीकार")} onClick={(e) => { e.stopPropagation(); decide(l, "rejected"); }}><X className="h-4 w-4" style={{ color: "#c42b1c" }} /></Button>
          </div>
        ) : null,
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Calendar className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Leave Management", "बिदा ब्यवस्थपन")}
        subtitle={`${leaves.length} ${filter === "all" ? t("total requests", "कुल अनुरोध") : filter} ${pendingCount > 0 && filter !== "pending" ? `· ${pendingCount} ${t("pending", "बाँकी")}` : ""}`}
        actions={
          <Button onClick={() => setShowApply(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t("Apply Leave", "बिदा अनुरोध")}
          </Button>
        }
      />
      <AOSPageBody>
        <FilterCommandBar>
          {["pending", "approved", "rejected", "all"].map((f: string) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {t(f.charAt(0).toUpperCase() + f.slice(1), (({ pending: "बाँकी", approved: "स्वीकृत", rejected: "अस्वीकृत", all: "सबै" }) as Record<string, string>)[f] || f)}
            </Button>
          ))}
        </FilterCommandBar>

        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={LEAVE_COLUMNS}
            rows={leaves}
            rowKey={(l: any) => l.id}
            loading={isLoading}
            searchable
            searchPlaceholder={t("Search leave requests…", "खोज्नुहोस…")}
            exportFileName="hr-leaves"
            empty={{
              icon: Check,
              title: t("No leave requests", "कुनै अनुरोध छेन"),
              body: t("When staff apply for leave it will appear here for approval.", "कर्मचारीले अनुरोध परेप्छन—यहाँ देखिएन।"),
              action: { label: t("Apply Leave", "अनुरोध गर्नु"), onClick: () => setShowApply(true) },
            }}
          />
        </DataPanel>

        {showApply ? (
          <ApplyLeaveDialog onClose={() => setShowApply(false)} />
        ) : null}
      </AOSPageBody>
    </AOSPage>
  );
}

function ApplyLeaveDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
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
      toast.success(t("Leave request submitted", "अनुरोध पेराइ"));
      onClose();
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.error || t("Failed to submit leave request", "पेराउन सकिएन")),
  });

  const canSubmit = !!staffId && !!fromDate && !!toDate && days !== null && !apply.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Apply Leave", "बिदा अनुरोध")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("Staff Member", "कर्मचारी")}</Label>
            <AdvancedSelect
              value={staffId}
              onChange={(v) => setStaffId(v)}
              clearable
              searchable
              placeholder={t("Select staff", "कर्मचारी छान्नु")}
              options={staffOptions.map((s) => ({ value: s.id, label: `${s.full_name} (${s.role})` }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Leave Type", "बिदा प्रकार")}</Label>
              <AdvancedSelect
                value={leaveType}
                onChange={(v) => setLeaveType(v)}
                options={[
                  { value: "sick", label: t("Sick", "रोग") },
                  { value: "casual", label: t("Casual", "आफिर्न") },
                  { value: "emergency", label: t("Emergency", "रहत") },
                  { value: "maternity", label: t("Maternity", "सुतिकाल") },
                  { value: "other", label: t("Other", "अन्य") },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Days", "दिन")}</Label>
              <Input value={days ?? "—"} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("From", "सुरु")}</Label>
              <BSDateInput
                value={fromDate}
                onChange={(v) => setFromDate(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("To", "सम्म")}</Label>
              <BSDateInput
                value={toDate}
                onChange={(v) => setToDate(v)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("Reason", "कारण")}</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("Brief reason for the leave", "छोटो कारण")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Cancel", "रद्द")}
          </Button>
          <Button onClick={() => apply.mutate()} disabled={!canSubmit}>
            {apply.isPending ? <Spinner size="sm" className="mr-2" /> : null}
            {t("Submit Request", "अनुरोध पेरेन")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
