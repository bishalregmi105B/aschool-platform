"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { QrCode, UserCheck, Clock } from "lucide-react";

export default function DismissalPage() {
  return <PluginGate slug="dismissal"><DismissalContent /></PluginGate>;
}

function DismissalContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [qrCode, setQrCode] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dismissals", search],
    queryFn: async () => { const r = await api.get("/dismissal/records", { params: { date: new Date().toISOString().split("T")[0], search: search || undefined } }); return r.data; },
  });

  const queue = data?.data || [];
  const stats = data?.stats || {};

  const verify = useMutation({
    // The QR encodes "aschool:pickup:<parent_user_id>:<student_id>" (parent
    // app) — the backend resolves the active pickup authorization from it.
    mutationFn: async (code: string) => (await api.post("/dismissal/verify-qr", { qr_code: code })).data,
    onSuccess: (d) => { queryClient.invalidateQueries({ queryKey: ["dismissals"] }); toast.success(`${d?.data?.student_name || "Student"} released to ${d?.data?.picked_up_by || "guardian"}`); setQrCode(""); },
    onError: () => toast.error("Verification failed — invalid or expired QR"),
  });

  const DISMISSAL_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (q) => q.student_name ?? "", render: (q) => <span className="font-medium">{q.student_name || "—"}</span> },
    { key: "class_name", label: "Class", sortable: true, value: (q) => q.class_name ?? "", render: (q) => q.class_name || "—" },
    { key: "picked_up_by", label: "Guardian", value: (q) => q.picked_up_by ?? "", render: (q) => q.picked_up_by || "—" },
    { key: "dismissed_at", label: "Time", sortable: true, value: (q) => q.dismissed_at ?? "", render: (q) => (q.dismissed_at ? new Date(q.dismissed_at).toLocaleTimeString() : "—") },
    // A DismissalRecord only exists once the student has been released
    { key: "status", label: "Status", value: () => "released", render: () => <span className="win11-chip success">released</span> },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading dismissals…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<QrCode className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Student Dismissal"
        subtitle={`QR-verified safe pickup · ${stats.released || queue.filter((q: any) => q.status === "released").length} released today`}
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard label="Waiting" value={stats.waiting || queue.filter((q: any) => q.status === "waiting").length} icon={<Clock className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />} />
          <KpiCard label="Released" value={stats.released || queue.filter((q: any) => q.status === "released").length} color="#107c10" icon={<UserCheck className="h-4 w-4" style={{ color: "#107c10" }} />} />
          <KpiCard label="Total Today" value={stats.total || queue.length} />
        </StatGrid>

        <DataPanel className="mb-4" title={
          <span className="flex items-center gap-2">
            <QrCode className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /> Scan QR Code
          </span>
        }>
          <div className="flex gap-2">
            <Input value={qrCode} onChange={(e) => setQrCode(e.target.value)} placeholder="Enter or scan QR..." onKeyDown={(e) => e.key === "Enter" && qrCode && verify.mutate(qrCode)} />
            <Button onClick={() => verify.mutate(qrCode)} disabled={!qrCode || verify.isPending}>{verify.isPending ? <Spinner /> : "Verify"}</Button>
          </div>
        </DataPanel>

        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={DISMISSAL_COLUMNS}
            rows={queue}
            rowKey={(q: any) => q.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search student..."
            exportFileName="dismissals-today"
            empty={{ icon: UserCheck, title: "No dismissal records today", body: "Records appear as students are released via QR verification." }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
