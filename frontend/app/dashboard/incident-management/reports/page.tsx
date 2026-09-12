"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { FileText, AlertOctagon } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function IncidentReportsPage() {
  return <PluginGate slug="incident_management"><ReportsContent /></PluginGate>;
}

function ReportsContent() {
  const [period, setPeriod] = useState("this_month");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["incident-reports", period],
    queryFn: async () => { const r = await api.get("/incidents/management/reports", { params: { period } }); return r.data?.data ?? r.data; },
    retry: 1,
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading incident reports…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Incident Reports" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load incident reports. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const stats = data?.summary ?? {};
  const byType: any[] = data?.by_type ?? [];
  const resolved: any[] = data?.resolved_cases ?? [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Incident Reports"
        subtitle="Analytics and resolved case history"
        actions={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <AOSPageBody>
        <StatGrid>
          {[
            { label: "Total Incidents", value: stats.total ?? "—" },
            { label: "Resolved", value: stats.resolved ?? "—", color: "#107c10" },
            { label: "Escalated", value: stats.escalated ?? "—", color: "#d83b01" },
            { label: "Avg Resolution Days", value: stats.avg_resolution_days ?? "—" },
          ].map((s) => (
            <KpiCard key={s.label} label={s.label} value={s.value} color={s.color} />
          ))}
        </StatGrid>

        {byType.length > 0 && (
          <DataPanel
            className="mb-4"
            title={
              <span className="flex items-center gap-2">
                <AlertOctagon className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />Incidents by Type
              </span>
            }
          >
            <div className="space-y-3">
              {byType.map((t: any) => (
                <div key={t.type} className="flex items-center gap-4">
                  <span className="w-28 text-sm capitalize" style={{ color: "var(--w11-text-primary)" }}>{t.type}</span>
                  <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: "var(--w11-control-hover)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(t.count / (stats.total || 1)) * 100}%`, background: "var(--w11-accent)" }} />
                  </div>
                  <span className="text-sm font-medium w-8 text-right" style={{ color: "var(--w11-text-primary)" }}>{t.count}</span>
                </div>
              ))}
            </div>
          </DataPanel>
        )}

        <DataPanel title="Resolved Cases" bodyClassName="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Student</TableHead><TableHead>Resolved On</TableHead><TableHead>Resolution</TableHead></TableRow></TableHeader>
            <TableBody>
              {resolved.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6" style={{ color: "var(--w11-text-secondary)" }}>No resolved cases in this period</TableCell></TableRow>
              ) : resolved.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell><span className="win11-chip subtle">{c.type}</span></TableCell>
                  <TableCell>{c.student_name ?? "—"}</TableCell>
                  <TableCell>{c.resolved_at ? displayBS(c.resolved_at) : "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate" style={{ color: "var(--w11-text-secondary)" }}>{c.resolution ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
