"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { BarChart3 } from "lucide-react";

const REPORTS = [
  { key: "popular", label: "Most borrowed" },
  { key: "overdue_by_class", label: "Overdue by class" },
  { key: "fines_collected", label: "Fines by status" },
  { key: "dead_stock", label: "Never borrowed" },
  { key: "collection_stats", label: "Collection summary" },
] as const;

type ReportKey = (typeof REPORTS)[number]["key"];

export default function LibraryReportsPage() {
  return <PluginGate slug="library"><ReportsContent /></PluginGate>;
}

function ReportsContent() {
  const [report, setReport] = useState<ReportKey>("popular");

  const { data, isLoading } = useQuery({
    queryKey: ["library-report", report],
    queryFn: async () => (await api.get(`/library/reports/${report}`)).data?.data,
  });

  const rows: any[] = Array.isArray(data) ? data : data ? [data] : [];
  const columns: Column<any>[] =
    rows.length > 0
      ? Object.keys(rows[0]).map((k) => ({
          key: k,
          label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          value: (r: any) => (typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k] ?? ""),
        }))
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Library Reports</h1>
        <p className="text-muted-foreground">Circulation, popularity, overdue and collection insights</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <Button key={r.key} size="sm" variant={report === r.key ? "default" : "outline"}
            onClick={() => setReport(r.key)}>
            {r.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> {REPORTS.find((r) => r.key === report)?.label}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoader />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r: any) => String(r.id ?? r.title ?? r.status ?? Math.random())}
              exportFileName={`library-${report}`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
