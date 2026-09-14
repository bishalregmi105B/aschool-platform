"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  DataPanel, StatusChip,
} from "@/components/aos/kit/page-kit";
import { ErrorState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { AlertTriangle, Loader2, Phone, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayBS } from "@/lib/nepali_date";

export default function DefaultersPage() {
  return <AppGate slug="fees"><DefaultersContent /></AppGate>;
}

function DefaultersContent() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["fee-defaulters"],
    queryFn: async () => { const r = await api.get("/fees/defaulters"); return r.data; },
  });

  const [remindingId, setRemindingId] = useState<string | null>(null);

  const remindMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const r = await api.post(`/fees/defaulters/${studentId}/remind`);
      return r.data;
    },
    onSuccess: (res) => {
      const payload = res?.data;
      const channel = payload?.channel === "sms" ? "SMS" : t("notification", "सूचना");
      toast.success(
        payload?.phone
          ? t(
              `Reminder sent via ${channel} to ${payload.phone} • Rs. ${Number(payload.amount || 0).toLocaleString()} pending`,
              `${channel} बाट सम्झाउने पठाइयो: ${payload.phone} • बाँकी रु. ${Number(payload.amount || 0).toLocaleString()}`
            )
          : t("Reminder sent successfully", "सम्झाउने पठाइयो"),
      );
      setRemindingId(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || error?.message || t("Could not send reminder", "सम्झाउने पठाउन सकिएन"),
      );
      setRemindingId(null);
    },
  });

  const handleRemind = (studentId: string) => {
    setRemindingId(studentId);
    remindMutation.mutate(studentId);
  };

  const defaulters = data?.data || [];
  const totalDue = defaulters.reduce((sum: number, d: any) => sum + (d.total_due || 0), 0);

  // Aging buckets from overdue_since (client view of AR age — plan 34-8).
  const daysOverdue = (d: any): number | null => {
    if (!d.overdue_since) return null;
    const ms = Date.now() - new Date(d.overdue_since).getTime();
    return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86400000)) : null;
  };
  const bucketOf = (d: any): string => {
    const days = daysOverdue(d);
    if (days === null) return "current";
    if (days <= 30) return "0-30";
    if (days <= 60) return "31-60";
    if (days <= 90) return "61-90";
    return "90+";
  };
  const BUCKET_STATUS: Record<string, { tone: string; label: string }> = {
    current: { tone: "pending", label: "new" },
    "0-30": { tone: "pending", label: "0–30 d" },
    "31-60": { tone: "due", label: "31–60 d" },
    "61-90": { tone: "late", label: "61–90 d" },
    "90+": { tone: "overdue", label: "90+ d" },
  };

  const DEFAULTER_COLUMNS: Column<any>[] = [
    { key: "student_name", label: t("Student", "विद्यार्थी"), sortable: true, value: (d) => d.student_name || "", render: (d) => <span className="font-medium">{d.student_name}</span> },
    { key: "class_name", label: t("Class", "कक्षा"), sortable: true, value: (d) => d.class_name ?? "", render: (d) => d.class_name || "—" },
    { key: "total_due", label: t("Due Amount", "बाँकी रकम"), align: "right", sortable: true, value: (d) => d.total_due || 0, render: (d) => <span className="font-bold tabular-nums" style={{ color: "#c42b1c" }}>Rs. {d.total_due?.toLocaleString()}</span> },
    {
      key: "overdue_since",
      label: t("Overdue Since", "ढिलादेखि"),
      sortable: true,
      value: (d) => d.overdue_since ?? "",
      render: (d) => (
        <div className="flex flex-col items-start gap-1">
          <span>{d.overdue_since ? displayBS(d.overdue_since) : "—"}</span>
          <StatusChip
            status={BUCKET_STATUS[bucketOf(d)].tone}
            label={BUCKET_STATUS[bucketOf(d)].label}
          />
        </div>
      ),
    },
    {
      key: "contact",
      label: t("Parent Contact", "अभिभावक सम्पर्क"),
      value: (d) => d.parent_phone || d.parent_email || "",
      render: (d) => (
        <div className="text-sm">
          {d.parent_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {d.parent_phone}</span>}
          {d.parent_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {d.parent_email}</span>}
        </div>
      ),
    },
    {
      key: "actions",
      label: t("Actions", "कार्य"),
      noExport: true,
      render: (d) => (
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={remindingId === d.id}
          onClick={(e) => {
            e.stopPropagation();
            handleRemind(d.id);
          }}
        >
          {remindingId === d.id ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          {remindingId === d.id ? t("Sending…", "पठाउँदै…") : t("Send Reminder", "सम्झाउने पठाउनुहोस्")}
        </Button>
      ),
    },
  ];

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title={t("Fee Defaulters", "बाँकी शुल्क")} subtitle={t("Students with overdue fee payments", "ढिलाई शुल्क बाँकी विद्यार्थी")} />
        <AOSPageBody className="max-w-2xl mx-auto">
          <div className="win11-card">
            <ErrorState onRetry={() => refetch()} />
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<AlertTriangle className="h-5 w-5" style={{ color: "#c42b1c" }} />}
        title={t("Fee Defaulters", "बाँकी शुल्क")}
        subtitle={t("Students with overdue fee payments", "ढिलाई शुल्क बाँकी विद्यार्थी")}
      />
      <AOSPageBody className="space-y-4">
        <StatGrid className="mb-0" min={180}>
          {isLoading ? (
            <><SkeletonTable className="col-span-3 h-24" rows={1} columns={3} /></>
          ) : (
            <>
              <KpiCard label={t("Total Defaulters", "कुल बाँकी")} value={defaulters.length} color="#c42b1c" />
              <KpiCard label={t("Total Outstanding", "कुल रकम")} value={`Rs. ${totalDue.toLocaleString()}`} color="var(--w11-text-primary)" />
              <KpiCard
                label={t("Average Due", "औसत")}
                value={defaulters.length ? `Rs. ${Math.round(totalDue / defaulters.length).toLocaleString()}` : "Rs. 0"}
                color="var(--w11-text-primary)"
              />
            </>
          )}
        </StatGrid>

        <DataPanel
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" style={{ color: "#c42b1c" }} /> {t("Defaulters List", "बाँकी सूची")}
            </span>
          }
        >
          <DataTable
            columns={DEFAULTER_COLUMNS}
            rows={defaulters}
            rowKey={(d: any) => d.id}
            searchable
            searchPlaceholder={t("Search students…", "विद्यार्थी खोज्नुहोस्…")}
            exportFileName="fee-defaulters"
            empty={{ icon: AlertTriangle, title: t("No defaulters — great!", "कुनै बाँकी छैन — राम्रो!"), body: t("Every student is up to date on fees.", "सबै विद्यार्थीको शुल्क तिरेको छ।") }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
