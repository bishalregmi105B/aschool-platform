"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import Link from "next/link";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
} from "@/components/aos/kit/page-kit";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, History, ChevronRight } from "lucide-react";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";
import CsvUploadPage from "./csv/page";

// Quick links — the bulk-uploads subpages (CSV importer, IEMIS importer,
// import history).
const QUICK_LINKS = [
  { label: "CSV Import", desc: "Standard CSV template uploads", icon: "FileSpreadsheet", href: "/dashboard/bulk-uploads/csv" },
  { label: "IEMIS Import", desc: "Ministry IEMIS report importer", icon: "Database", href: "/dashboard/bulk-uploads/iemis" },
  { label: "Import History", desc: "Every past import run", icon: "History", href: "/dashboard/bulk-uploads/history" },
];

interface ImportLog {
  id: string;
  status: "pending" | "processing" | "completed" | "partial" | "failed";
  imported_rows: number;
  error_rows: number;
}

/** Bulk Uploads hub — dashboard (import-history KPIs + quick links to the
 * csv/iemis/history subpages) above the CSV uploader it has always opened. */
export default function BulkUploadsPage() {
  // Same endpoint/queryKey the history subpage uses — react-query dedupes.
  const { data: history } = useQuery({
    queryKey: ["import-history"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ImportLog[]>>("/iemis/history");
      return res.data.data ?? [];
    },
    retry: 1,
  });

  const logs = history ?? [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Upload className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Bulk Uploads"
        subtitle="Import students, staff and school data in bulk"
      />
      <AOSPageBody>
        {/* Dashboard — KPI stat grid from the import history */}
        <StatGrid>
          <KpiCard
            label="Imports Run"
            value={logs.length}
            icon={<FileSpreadsheet className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Completed"
            value={logs.filter((l) => l.status === "completed").length}
            color="#107c10"
            icon={<CheckCircle2 className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label="Needs Attention"
            value={logs.filter((l) => l.status === "failed" || l.status === "partial" || l.status === "processing").length}
            color="#d83b01"
            icon={<AlertTriangle className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
          <KpiCard
            label="Rows Imported"
            value={logs.reduce((a, l) => a + (l.imported_rows || 0), 0)}
            color="var(--w11-text-primary)"
            icon={<Upload className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
        </StatGrid>

        {/* Quick links — 44px gradient icon tile + label, as next/link */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {QUICK_LINKS.map((l) => {
            const Icon = ICON_MAP[l.icon] || ChevronRight;
            return (
              <Link key={l.href} href={l.href} className="block h-full">
                <div
                  className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                  style={{ cursor: "pointer", marginBottom: 0 }}
                >
                  <div
                    className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      background: SECTION_GRADIENTS.Operations,
                      boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                      {l.label}
                    </p>
                    <p className="text-[11px] leading-snug" style={{ color: "var(--w11-text-secondary)" }}>
                      {l.desc}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* The CSV uploader this hub has always shown, kept below */}
        <div style={{ height: 640 }}>
          <CsvUploadPage />
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
