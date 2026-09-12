"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  DataPanel, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { AlertTriangle, Loader2, Phone, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayBS } from "@/lib/nepali_date";

export default function DefaultersPage() {
  return <PluginGate slug="fees"><DefaultersContent /></PluginGate>;
}

function DefaultersContent() {
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
      const channel = payload?.channel === "sms" ? "via SMS" : "via notification";
      toast.success(
        payload?.phone
          ? `Reminder sent ${channel} to ${payload.phone} • Rs. ${Number(payload.amount || 0).toLocaleString()} pending`
          : "Reminder sent successfully",
      );
      setRemindingId(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || error?.message || "Could not send reminder",
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

  const DEFAULTER_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (d) => d.student_name || "", render: (d) => <span className="font-medium">{d.student_name}</span> },
    { key: "class_name", label: "Class", sortable: true, value: (d) => d.class_name ?? "", render: (d) => d.class_name || "—" },
    { key: "total_due", label: "Due Amount", align: "right", sortable: true, value: (d) => d.total_due || 0, render: (d) => <span className="font-bold" style={{ color: "#c42b1c" }}>Rs. {d.total_due?.toLocaleString()}</span> },
    { key: "overdue_since", label: "Overdue Since", sortable: true, value: (d) => d.overdue_since ?? "", render: (d) => (d.overdue_since ? displayBS(d.overdue_since) : "—") },
    {
      key: "contact",
      label: "Parent Contact",
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
      label: "Actions",
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
          {remindingId === d.id ? "Sending…" : "Send Reminder"}
        </Button>
      ),
    },
  ];

  if (isLoading) return <AOSPage><AOSModuleLoadingState label="Loading defaulters…" /></AOSPage>;
    if (isError) {
      return (
        <AOSPage>
          <AOSPageHeader title="Fee Defaulters" subtitle="Students with overdue fee payments" />
          <AOSPageBody className="max-w-2xl mx-auto">
            <div className="win11-card flex flex-col items-center justify-center gap-3 py-10 text-center">
              <p className="text-sm text-[#c42b1c]">Failed to load defaulters list. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </AOSPageBody>
        </AOSPage>
      );
    }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<AlertTriangle className="h-5 w-5" style={{ color: "#c42b1c" }} />}
        title="Fee Defaulters"
        subtitle="Students with overdue fee payments"
      />
      <AOSPageBody className="space-y-4">
        <StatGrid className="mb-0" min={180}>
          <KpiCard label="Total Defaulters" value={defaulters.length} color="#c42b1c" />
          <KpiCard label="Total Outstanding" value={`Rs. ${totalDue.toLocaleString()}`} color="var(--w11-text-primary)" />
          <KpiCard
            label="Average Due"
            value={defaulters.length ? `Rs. ${Math.round(totalDue / defaulters.length).toLocaleString()}` : "Rs. 0"}
            color="var(--w11-text-primary)"
          />
        </StatGrid>

        <DataPanel
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" style={{ color: "#c42b1c" }} /> Defaulters List
            </span>
          }
        >
          <DataTable
            columns={DEFAULTER_COLUMNS}
            rows={defaulters}
            rowKey={(d: any) => d.id}
            searchable
            searchPlaceholder="Search students…"
            exportFileName="fee-defaulters"
            empty={{ icon: AlertTriangle, title: "No defaulters — great!", body: "Every student is up to date on fees." }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
