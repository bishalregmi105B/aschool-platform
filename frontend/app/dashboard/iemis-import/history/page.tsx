"use client";

import { useQuery } from "@tanstack/react-query";
import { getHistory, type ImportLog } from "@/lib/services/iemis.service";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { History, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4" style={{ color: "#107c10" }} />,
  partial: <AlertTriangle className="h-4 w-4" style={{ color: "#d83b01" }} />,
  failed: <XCircle className="h-4 w-4" style={{ color: "#c42b1c" }} />,
  processing: <Clock className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
  pending: <Clock className="h-4 w-4" style={{ color: "#8a6116" }} />,
};

const STATUS_TONE: Record<string, string> = {
  completed: "success",
  partial: "warning",
  failed: "error",
  processing: "accent",
  pending: "subtle",
};

const FORMAT_LABELS: Record<string, string> = {
  student_namewise: "Students",
  school_level: "School Data",
};

export default function IemisHistoryPage() {
  const { data: logs, isLoading, isError, refetch } = useQuery({
    queryKey: ["iemis-history"],
    queryFn: async () => {
      const res = await getHistory(1);
      return (res.items ?? []) as ImportLog[];
    },
    retry: 1,
  });

  const LOG_COLUMNS: Column<any>[] = [
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (l) => l.status ?? "",
      render: (l) => (
        <span className={`win11-chip ${STATUS_TONE[l.status] ?? "subtle"} inline-flex items-center gap-1`}>
          {STATUS_ICON[l.status]}
          {l.status}
        </span>
      ),
    },
    { key: "format", label: "Format", value: (l) => FORMAT_LABELS[l.format_code] ?? l.format_code ?? "", render: (l) => <span className="text-sm">{FORMAT_LABELS[l.format_code] ?? l.format_code}</span> },
    { key: "filename", label: "File", value: (l) => l.filename ?? "", render: (l) => <span className="text-xs max-w-[160px] truncate block" style={{ color: "var(--w11-text-secondary)" }}>{l.filename ?? "—"}</span> },
    { key: "total_rows", label: "Total", align: "right", sortable: true, value: (l) => l.total_rows ?? 0 },
    { key: "imported_rows", label: "Imported", align: "right", sortable: true, value: (l) => l.imported_rows ?? 0, render: (l) => <span className="text-sm font-medium" style={{ color: "#107c10" }}>{l.imported_rows}</span> },
    { key: "skipped_rows", label: "Skipped", align: "right", sortable: true, value: (l) => l.skipped_rows ?? 0, render: (l) => <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{l.skipped_rows}</span> },
    { key: "error_rows", label: "Errors", align: "right", sortable: true, value: (l) => l.error_rows ?? 0, render: (l) => <span className="text-sm" style={{ color: "#c42b1c" }}>{l.error_rows}</span> },
    {
      key: "date",
      label: "Date",
      sortable: true,
      value: (l) => l.completed_at ?? l.created_at ?? "",
      render: (l) => (
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--w11-text-secondary)" }}>
          {l.completed_at ? new Date(l.completed_at).toLocaleString() : new Date(l.created_at).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<History className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="IEMIS Import History"
        subtitle={`All import jobs for this school${logs?.length ? ` · ${logs.length} total` : ""}`}
        actions={
          <Link href="/dashboard/iemis-import">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="max-w-5xl w-full mx-auto">
          {isError ? (
            <DataPanel>
              <div className="py-12 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load import history. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          ) : isLoading ? (
            <AOSModuleLoadingState label="Loading import history…" />
          ) : !logs?.length ? (
            <DataPanel>
              <AOSEmptyState
                icon={<History className="h-10 w-10" />}
                title="No imports yet"
                action={
                  <Link href="/dashboard/iemis-import">
                    <Button className="mt-2" size="sm">Start First Import</Button>
                  </Link>
                }
              />
            </DataPanel>
          ) : (
            <DataPanel bodyClassName="p-0">
              <DataTable
                columns={LOG_COLUMNS}
                rows={logs}
                rowKey={(l) => l.id}
                searchable
                searchPlaceholder="Search imports…"
                exportFileName="iemis-import-history"
                dense
              />
            </DataPanel>
          )}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
