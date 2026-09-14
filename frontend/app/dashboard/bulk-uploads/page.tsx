"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { useI18n } from "@/lib/i18n";
import { displayBS } from "@/lib/nepali_date";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";

interface ImportLog {
  id: string;
  format_code: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "partial" | "failed";
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  created_at: string;
}

/**
 * Bulk Uploads hub — A5 (plan 34-49): KPI band + launcher grid + ONE
 * embeddable "most used" panel (the five latest import jobs). The hub used
 * to render the full CSV uploader page nested inside its own AOSPage body
 * (double header, double scroll); it now links to the two importers instead.
 */
export default function BulkUploadsPage() {
  const { t } = useI18n();

  const { data: history } = useQuery({
    queryKey: ["import-history"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ImportLog[]>>("/iemis/history", {
        params: { per_page: 5 },
      });
      return res.data.data ?? [];
    },
    retry: 1,
  });

  const logs = history ?? [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Upload className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Bulk Uploads", "बल्क अपलोड")}
        subtitle={t(
          "Import students, staff and school data in bulk — every run is validated and logged",
          "विद्यार्थी, कर्मचारी र विद्यालय डाटा बल्क आयात — हरेक पटक जाँचिएर लग हुन्छ"
        )}
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard
            label={t("Imports Run", "आयातहरू")}
            value={logs.length}
            icon={<FileSpreadsheet className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Completed", "सफल")}
            value={logs.filter((l) => l.status === "completed").length}
            color="#107c10"
            icon={<CheckCircle2 className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label={t("Needs Attention", "ध्यान आवश्यक")}
            value={logs.filter((l) => ["failed", "partial", "processing"].includes(l.status)).length}
            color="#d83b01"
            icon={<AlertTriangle className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
          <KpiCard
            label={t("Rows Imported (recent)", "आयात पङ्क्ति (हालको)")}
            value={logs.reduce((a, l) => a + (l.imported_rows || 0), 0)}
            color="var(--w11-text-primary)"
            icon={<Upload className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
        </StatGrid>

        <QuickLinks
          section="Operations"
          links={[
            { label: t("CSV Import", "CSV आयात"), icon: "FileText", href: "/dashboard/bulk-uploads/csv" },
            { label: t("IEMIS Import (Excel)", "IEMIS आयात (Excel)"), icon: "FileSpreadsheet", href: "/dashboard/iemis-import" },
            { label: t("Import History", "आयात इतिहास"), icon: "History", href: "/dashboard/bulk-uploads/history" },
            { label: t("Compliance & EMIS", "अनुपालन र EMIS"), icon: "ShieldCheck", href: "/dashboard/compliance" },
          ]}
        />

        <DataPanel
          title={t("Latest import jobs", "पछिल्ला आयात कार्यहरू")}
          actions={
            <Link href="/dashboard/bulk-uploads/history">
              <Button variant="ghost" size="sm">{t("View all", "सबै हेर्नुहोस्")}</Button>
            </Link>
          }
        >
          {logs.length === 0 ? (
            <p className="text-[12px] py-4 text-center" style={{ color: "var(--w11-text-secondary)" }}>
              {t("No imports yet — start with the CSV or IEMIS importer above.", "अझै आयात छैन — माथिको CSV वा IEMIS आयातबाट सुरु गर्नुहोस्।")}
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 border border-[var(--w11-border-subtle)]"
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" style={{ color: "var(--w11-text-secondary)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium truncate" style={{ color: "var(--w11-text-primary)" }}>
                      {l.filename || l.format_code}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                      {t(`${l.imported_rows} imported · ${l.error_rows} errors`, `${l.imported_rows} आयात · ${l.error_rows} त्रुटि`)}{" "}
                      · {displayBS(l.created_at)}
                    </p>
                  </div>
                  <StatusChip
                    status={l.status === "completed" ? "completed" : l.status === "failed" ? "failed" : l.status === "partial" ? "partial" : "pending"}
                    label={l.status}
                  />
                </div>
              ))}
            </div>
          )}
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
