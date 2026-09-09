"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { QrCode, UserCheck, Clock, Search } from "lucide-react";

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
    { key: "status", label: "Status", value: () => "released", render: () => <Badge variant="default">released</Badge> },
  ];

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Student Dismissal</h1><p className="text-muted-foreground">QR-verified safe pickup and parent notification</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><Clock className="h-5 w-5 mb-2 text-muted-foreground" /><p className="text-2xl font-bold">{stats.waiting || queue.filter((q: any) => q.status === "waiting").length}</p><p className="text-sm text-muted-foreground">Waiting</p></CardContent></Card>
        <Card><CardContent className="pt-6"><UserCheck className="h-5 w-5 mb-2 text-green-600" /><p className="text-2xl font-bold text-green-600">{stats.released || queue.filter((q: any) => q.status === "released").length}</p><p className="text-sm text-muted-foreground">Released</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.total || queue.length}</p><p className="text-sm text-muted-foreground">Total Today</p></CardContent></Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6 space-y-2">
            <Label className="flex items-center gap-2"><QrCode className="h-4 w-4" /> Scan QR Code</Label>
            <div className="flex gap-2">
              <Input value={qrCode} onChange={(e) => setQrCode(e.target.value)} placeholder="Enter or scan QR..." onKeyDown={(e) => e.key === "Enter" && qrCode && verify.mutate(qrCode)} />
              <Button onClick={() => verify.mutate(qrCode)} disabled={!qrCode || verify.isPending}>{verify.isPending ? <Spinner /> : "Verify"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card>
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>
    </div>
  );
}
