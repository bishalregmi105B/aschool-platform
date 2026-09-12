"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FilterCommandBar,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
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
    <AOSPage>
      <AOSPageHeader
        icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Library Reports"
        subtitle="Circulation, popularity, overdue and collection insights"
      />
      <AOSPageBody>
        <FilterCommandBar>
          {REPORTS.map((r) => (
            <Button key={r.key} size="sm" variant={report === r.key ? "default" : "outline"}
              onClick={() => setReport(r.key)}>
              {r.label}
            </Button>
          ))}
        </FilterCommandBar>

        <DataPanel
          title={REPORTS.find((r) => r.key === report)?.label}
          bodyClassName="p-0"
        >
          {isLoading ? (
            <div className="py-10"><AOSModuleLoadingState label="Running report…" /></div>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r: any) => String(r.id ?? r.title ?? r.status ?? Math.random())}
              exportFileName={`library-${report}`}
            />
          )}
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
