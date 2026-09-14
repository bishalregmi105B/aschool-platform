"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { History, Eye, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { displayBS } from "@/lib/nepali_date";

interface ImportLog {
  id: string;
  format_code: string;
  filename?: string;
  status: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows?: number;
  error_rows: number;
  errors: Array<{ row?: number; error: string } | string>;
  created_at: string;
}

/**
 * Bulk import history — A1 (plan 34-49 "history(A1)"). Shared /iemis/history
 * store; every run's per-row error list opens in a detail dialog.
 */
export default function ImportHistoryPage() {
  const { t } = useI18n();
  const [selectedLog, setSelectedLog] = useState<ImportLog | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["import-history", page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ImportLog[]>>("/iemis/history", {
        params: { page, per_page: 25 },
      });
      return { rows: res.data.data ?? [], pagination: res.data.meta?.pagination };
    },
    retry: 1,
  });

  const logs = data?.rows || [];

  const columns: Column<ImportLog>[] = [
    {
      key: "created_at",
      label: t("Date (BS)", "मिति (बि.सं.)"),
      width: 140,
      render: (l) => (
        <span className="text-[12px]">{l.created_at ? displayBS(l.created_at) : "—"}</span>
      ),
      value: (l) => l.created_at,
    },
    {
      key: "filename",
      label: t("Import", "आयात"),
      render: (l) => (
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet className="h-4 w-4 shrink-0" style={{ color: "var(--w11-text-secondary)" }} />
          <div className="min-w-0">
            <p className="text-[12px] font-medium truncate">{l.filename || l.format_code}</p>
            <p className="text-[11px] capitalize truncate" style={{ color: "var(--w11-text-secondary)" }}>
              {(l.format_code || "").replace(/_/g, " ")}
            </p>
          </div>
        </div>
      ),
      value: (l) => l.filename || l.format_code,
    },
    {
      key: "status",
      label: t("Status", "स्थिति"),
      width: 110,
      render: (l) => (
        <StatusChip
          status={
            l.status === "completed" ? "completed" : l.status === "failed" ? "failed" : l.status === "partial" ? "partial" : "pending"
          }
          label={l.status}
        />
      ),
      value: (l) => l.status,
    },
    {
      key: "total_rows",
      label: t("Processed", "प्रशोधित"),
      align: "right",
      width: 90,
      value: (l) => l.total_rows ?? 0,
    },
    {
      key: "imported_rows",
      label: t("Success", "सफल"),
      align: "right",
      width: 80,
      render: (l) => (
        <span className="font-semibold" style={{ color: "#107c10" }}>{l.imported_rows ?? 0}</span>
      ),
      value: (l) => l.imported_rows ?? 0,
    },
    {
      key: "error_rows",
      label: t("Failed", "असफल"),
      align: "right",
      width: 80,
      render: (l) => (
        <span className="font-semibold" style={{ color: (l.error_rows ?? 0) > 0 ? "#c42b1c" : "var(--w11-text-secondary)" }}>
          {l.error_rows ?? 0}
        </span>
      ),
      value: (l) => l.error_rows ?? 0,
    },
    {
      key: "actions",
      label: "",
      width: 90,
      noExport: true,
      render: (l) => (
        <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setSelectedLog(l)}>
          <Eye className="h-3.5 w-3.5 mr-1.5" /> {t("Details", "विवरण")}
        </Button>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<History className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Import History", "आयात इतिहास")}
        subtitle={t(
          "Every bulk upload with its per-row error log",
          "प्रत्येक बल्क अपलोड र पङ्क्तिगत त्रुटि लग"
        )}
      />
      <AOSPageBody>
        <DataPanel>
          <DataTable
            columns={columns}
            rows={logs}
            rowKey={(l) => l.id}
            loading={isLoading}
            error={isError ? t("Failed to load import history", "इतिहास लोड गर्न असफल") : null}
            onRetry={() => refetch()}
            pagination={data?.pagination}
            onPageChange={setPage}
            exportFileName="import-history"
            empty={{
              icon: History,
              title: t("No imports yet", "अझै आयात छैन"),
              body: t("Runs from the CSV and IEMIS importers appear here.", "CSV र IEMIS आयातका कार्यहरू यहाँ देखिन्छन्।"),
            }}
          />
        </DataPanel>

        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("Import Details", "आयात विवरण")}</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div
                  className="grid grid-cols-2 gap-4 border border-[var(--w11-border-subtle)] rounded-lg p-4"
                  style={{ background: "var(--w11-control-hover)" }}
                >
                  <div>
                    <span className="text-sm block" style={{ color: "var(--w11-text-secondary)" }}>
                      {t("Format", "ढाँचा")}
                    </span>
                    <span className="font-medium capitalize">
                      {(selectedLog.format_code || "").replace(/_/g, " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm block" style={{ color: "var(--w11-text-secondary)" }}>
                      {t("Date (BS)", "मिति (बि.सं.)")}
                    </span>
                    <span className="font-medium">{displayBS(selectedLog.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-sm block" style={{ color: "var(--w11-text-secondary)" }}>
                      {t("Status", "स्थिति")}
                    </span>
                    <StatusChip
                      status={selectedLog.status === "completed" ? "completed" : "failed"}
                      label={selectedLog.status}
                    />
                  </div>
                  <div>
                    <span className="text-sm block" style={{ color: "var(--w11-text-secondary)" }}>
                      {t("Processed", "प्रशोधित")}
                    </span>
                    <span className="font-medium">{selectedLog.total_rows ?? 0}</span>
                  </div>
                </div>

                {selectedLog.errors && selectedLog.errors.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2" style={{ color: "#c42b1c" }}>
                      {t("Per-row errors", "पङ्क्तिगत त्रुटिहरू")} ({selectedLog.error_rows ?? selectedLog.errors.length})
                    </h3>
                    <div
                      className="p-4 rounded-lg text-sm max-h-60 overflow-y-auto"
                      style={{ background: "rgba(196,43,28,0.08)", color: "#c42b1c" }}
                    >
                      <ul className="pl-4 space-y-1">
                        {selectedLog.errors.map((err, i) =>
                          typeof err === "string" ? (
                            <li key={i}>{err}</li>
                          ) : (
                            <li key={i}>
                              {err.row != null ? t(`Row ${err.row}`, `पङ्क्ति ${err.row}`) + ": " : ""}
                              {err.error}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {(selectedLog.imported_rows ?? 0) > 0 && (selectedLog.error_rows ?? 0) === 0 && (
                  <div
                    className="p-4 rounded-lg text-center"
                    style={{ background: "rgba(16,124,16,0.08)", color: "#107c10" }}
                  >
                    {t(
                      `All ${selectedLog.imported_rows} records were imported successfully. No errors found.`,
                      `${selectedLog.imported_rows} रेकर्ड सफलतापूर्वक आयात भए। कुनै त्रुटि भेटिएन।`
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
