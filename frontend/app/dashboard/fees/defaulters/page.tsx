"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoader } from "@/components/ui/spinner";
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
    { key: "total_due", label: "Due Amount", align: "right", sortable: true, value: (d) => d.total_due || 0, render: (d) => <span className="font-bold text-red-600">Rs. {d.total_due?.toLocaleString()}</span> },
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

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load defaulters list. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Fee Defaulters</h1><p className="text-muted-foreground">Students with overdue fee payments</p></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Defaulters</p><p className="text-2xl font-bold text-red-600">{defaulters.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Outstanding</p><p className="text-2xl font-bold">Rs. {totalDue.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Average Due</p><p className="text-2xl font-bold">Rs. {defaulters.length ? Math.round(totalDue / defaulters.length).toLocaleString() : 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" /> Defaulters List</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={DEFAULTER_COLUMNS}
            rows={defaulters}
            rowKey={(d: any) => d.id}
            searchable
            searchPlaceholder="Search students…"
            exportFileName="fee-defaulters"
            empty={{ icon: AlertTriangle, title: "No defaulters — great!", body: "Every student is up to date on fees." }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
