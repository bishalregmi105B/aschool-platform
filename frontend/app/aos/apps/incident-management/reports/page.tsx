"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { FileText, TrendingDown, AlertOctagon } from "lucide-react";
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

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load incident reports. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  const stats = data?.summary ?? {};
  const byType: any[] = data?.by_type ?? [];
  const resolved: any[] = data?.resolved_cases ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-blue-600" />
          <div><h1 className="text-2xl font-bold">Incident Reports</h1><p className="text-muted-foreground">Analytics and resolved case history</p></div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Incidents", value: stats.total ?? "—" },
          { label: "Resolved", value: stats.resolved ?? "—" },
          { label: "Escalated", value: stats.escalated ?? "—" },
          { label: "Avg Resolution Days", value: stats.avg_resolution_days ?? "—" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {byType.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertOctagon className="h-5 w-5" />Incidents by Type</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byType.map((t: any) => (
                <div key={t.type} className="flex items-center gap-4">
                  <span className="w-28 text-sm capitalize">{t.type}</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(t.count / (stats.total || 1)) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{t.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Resolved Cases</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Student</TableHead><TableHead>Resolved On</TableHead><TableHead>Resolution</TableHead></TableRow></TableHeader>
            <TableBody>
              {resolved.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No resolved cases in this period</TableCell></TableRow>
              ) : resolved.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                  <TableCell>{c.student_name ?? "—"}</TableCell>
                  <TableCell>{c.resolved_at ? displayBS(c.resolved_at) : "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">{c.resolution ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
