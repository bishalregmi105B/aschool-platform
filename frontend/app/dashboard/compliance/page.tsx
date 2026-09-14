"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SimpleSelect } from "@/components/ui/advanced-select";
import { Spinner } from "@/components/ui/spinner";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { useUrlFilters } from "@/components/ui/filter-bar";
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
import {
  ShieldCheck,
  FileDown,
  FileText,
  Download,
  Upload,
  Plus,
  ScrollText,
} from "lucide-react";

/**
 * Compliance & IEMIS — rebuilt against the REAL API contract (plan 34-41,
 * 4.3-6, DUPLICATION_MATRIX §4).
 *
 * The previous page rendered a "requirement / category / due date" table for
 * rows the API never returns: GET /compliance/reports yields
 * {report_type, academic_year, data, status, notes, submitted_at, …} and the
 * dead "Generate MoE Report" button had no handler at all. Every column now
 * maps to a serializer field in app/api/v1/compliance.py. Export = the real
 * EMIS history (GET /compliance/emis) with download links that appear only
 * when `file_url` is present; Import links to the /iemis-import wizard; the
 * audit-log tab surfaces GET /compliance/audit-logs, which was previously
 * invisible in the admin UI.
 */

interface ComplianceReport {
  id: string;
  report_type: string;
  academic_year: string | null;
  data: Record<string, unknown> | null;
  status: string;
  notes: string | null;
  submitted_at: string | null;
  submitted_by_name: string | null;
  created_at: string;
}

interface EmisExport {
  id: string;
  academic_year: string | null;
  export_data: Record<string, unknown> | null;
  file_url: string | null;
  generated_at: string | null;
}

interface AuditLog {
  id: string;
  user_name: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  created_at: string;
}

const REPORT_TYPES = [
  { value: "emis", en: "EMIS" },
  { value: "moe", en: "MoE Report" },
  { value: "district", en: "District Report" },
];

export default function CompliancePage() {
  return (
    <AppGate slug="compliance">
      <ComplianceContent />
    </AppGate>
  );
}

function ComplianceContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { values, setValues } = useUrlFilters(["tab"]);
  const tab = values.tab || "reports";
  const [page, setPage] = useState(1);
  const [emisPage, setEmisPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [genDialog, setGenDialog] = useState(false);
  const [genForm, setGenForm] = useState({ report_type: "emis", academic_year: "" });

  const { data: reports, isLoading, isError, refetch } = useQuery({
    queryKey: ["compliance-reports", page],
    queryFn: async () => {
      const r = await api.get<ApiResponse<ComplianceReport[]>>("/compliance/reports", {
        params: { page, per_page: 25 },
      });
      return { rows: r.data.data || [], pagination: r.data.meta?.pagination };
    },
    retry: 1,
  });

  const { data: emis, isLoading: emisLoading } = useQuery({
    queryKey: ["compliance-emis", emisPage],
    queryFn: async () => {
      const r = await api.get<ApiResponse<EmisExport[]>>("/compliance/emis", {
        params: { page: emisPage, per_page: 25 },
      });
      return { rows: r.data.data || [], pagination: r.data.meta?.pagination };
    },
    retry: 1,
  });

  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ["compliance-audit", auditPage],
    queryFn: async () => {
      const r = await api.get<ApiResponse<AuditLog[]>>("/compliance/audit-logs", {
        params: { page: auditPage, per_page: 25 },
      });
      return { rows: r.data.data || [], pagination: r.data.meta?.pagination };
    },
    retry: 1,
  });

  const generate = useMutation({
    mutationFn: () =>
      api.post("/compliance/reports/generate", {
        report_type: genForm.report_type,
        academic_year: genForm.academic_year || undefined,
      }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["compliance-reports"] });
      toast.success(
        t(
          `Draft created — ${r.data?.data?.total_students ?? 0} students, ${r.data?.data?.total_staff ?? 0} staff counted`,
          `ड्राफ्ट बन्यो — ${r.data?.data?.total_students ?? 0} विद्यार्थी, ${r.data?.data?.total_staff ?? 0} कर्मचारी`
        )
      );
      setGenDialog(false);
      setValues({ tab: "reports" });
    },
    onError: () => toast.error(t("Generation failed", "उत्पन्न गर्न असफल")),
  });

  const markSubmitted = useMutation({
    mutationFn: (id: string) => api.put(`/compliance/reports/${id}`, { status: "submitted" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-reports"] });
      toast.success(t("Marked as submitted", "पेश गरिएको चिन्ह"));
    },
    onError: () => toast.error(t("Update failed", "अपडेट असफल")),
  });

  const download = async (e: EmisExport) => {
    try {
      const r = await api.get(`/compliance/emis/${e.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `emis-${e.academic_year || "export"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(
        t(
          "The export file is not on storage yet — the EMIS CSV writer task is not wired server-side.",
          "निर्यात फाइल भण्डारणमा छैन — EMIS CSV लेखर कार्य अहिलेसम्म जोडिएको छैन।"
        )
      );
    }
  };

  const reportColumns: Column<ComplianceReport>[] = [
    {
      key: "report_type",
      label: t("Report", "राप्रति"),
      render: (r) => {
        const meta = REPORT_TYPES.find((x) => x.value === r.report_type);
        return (
          <span className="inline-flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" style={{ color: "var(--w11-text-secondary)" }} />
            <span className="text-[13px] font-medium">{meta ? t(meta.en, meta.en) : r.report_type}</span>
          </span>
        );
      },
      value: (r) => r.report_type,
    },
    {
      key: "academic_year",
      label: t("Academic Year", "शैक्षिक सत्र"),
      width: 120,
      render: (r) => <span className="text-[12px]">{r.academic_year || "—"}</span>,
      value: (r) => r.academic_year || "",
    },
    {
      key: "counts",
      label: t("Snapshot", "तथ्याङ्क"),
      render: (r) => {
        const d = r.data || {};
        return (
          <span className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
            {d.total_students != null
              ? t(`${d.total_students} students · ${d.total_staff} staff`, `${d.total_students} विद्यार्थी · ${d.total_staff} कर्मचारी`)
              : r.notes || "—"}
          </span>
        );
      },
      value: (r) => String(r.data?.total_students ?? ""),
    },
    {
      key: "status",
      label: t("Status", "स्थिति"),
      width: 120,
      render: (r) => (
        <StatusChip
          status={r.status === "submitted" ? "approved" : r.status === "draft" ? "pending" : r.status}
          label={
            r.status === "submitted"
              ? t("Submitted", "पेश भएको")
              : r.status === "draft"
                ? t("Draft", "ड्राफ्ट")
                : r.status
          }
        />
      ),
      value: (r) => r.status,
    },
    {
      key: "submitted",
      label: t("Submitted by", "पेशकर्ता"),
      render: (r) =>
        r.submitted_at ? (
          <span className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
            {r.submitted_by_name || "—"} · {displayBS(r.submitted_at)}
          </span>
        ) : (
          <span className="text-[12px]" style={{ color: "var(--w11-text-tertiary)" }}>—</span>
        ),
      value: (r) => r.submitted_by_name || "",
    },
    {
      key: "actions",
      label: "",
      width: 110,
      noExport: true,
      render: (r) =>
        r.status === "draft" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => markSubmitted.mutate(r.id)}
            disabled={markSubmitted.isPending}
          >
            {t("Mark submitted", "पेश गरिएको चिन्ह")}
          </Button>
        ) : null,
    },
  ];

  const emisColumns: Column<EmisExport>[] = [
    {
      key: "academic_year",
      label: t("Academic Year", "शैक्षिक सत्र"),
      render: (e) => <span className="text-[13px] font-medium">{e.academic_year || "—"}</span>,
      value: (e) => e.academic_year || "",
    },
    {
      key: "generated_at",
      label: t("Generated (BS)", "उत्पन्न (बि.सं.)"),
      render: (e) => (
        <span className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
          {e.generated_at ? displayBS(e.generated_at) : "—"}
        </span>
      ),
      value: (e) => e.generated_at || "",
    },
    {
      key: "payload",
      label: t("Contents", "विषयवस्तु"),
      render: (e) => (
        <span className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
          {e.export_data && Object.keys(e.export_data).length
            ? `${Object.keys(e.export_data).length} field groups`
            : t("Record only (no data captured)", "रेकर्ड मात्र (तथ्याङ्क छैन)")}
        </span>
      ),
      value: (e) => String(Object.keys(e.export_data || {}).length),
    },
    {
      key: "actions",
      label: "",
      width: 130,
      noExport: true,
      render: (e) =>
        e.file_url ? (
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => download(e)}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> {t("Download CSV", "CSV डाउनलोड")}
          </Button>
        ) : (
          <span
            className="win11-chip subtle text-[10px]"
            title={t("CSV writer task (export_emis_data) has no caller yet", "CSV लेखर कार्य अहिलेसम्म जोडिएको छैन")}
          >
            {t("No file yet", "फाइल छैन")}
          </span>
        ),
    },
  ];

  const auditColumns: Column<AuditLog>[] = [
    {
      key: "created_at",
      label: t("When (BS)", "कहिले (बि.सं.)"),
      width: 160,
      render: (a) => <span className="text-[12px]">{displayBS(a.created_at)}</span>,
      value: (a) => a.created_at,
    },
    {
      key: "user_name",
      label: t("User", "प्रयोगकर्ता"),
      render: (a) => <span className="text-[12px]">{a.user_name || t("Platform", "प्लेटफर्म")}</span>,
      value: (a) => a.user_name || "",
    },
    {
      key: "action",
      label: t("Action", "कार्य"),
      width: 140,
      render: (a) => <span className="win11-chip subtle">{a.action}</span>,
      value: (a) => a.action,
    },
    {
      key: "resource_type",
      label: t("Resource", "स्रोत"),
      render: (a) => (
        <span className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
          {a.resource_type || "—"}
        </span>
      ),
      value: (a) => a.resource_type || "",
    },
    {
      key: "ip_address",
      label: t("IP", "IP"),
      width: 140,
      render: (a) => <span className="text-[12px] font-mono">{a.ip_address || "—"}</span>,
      value: (a) => a.ip_address || "",
    },
  ];

  const reportList = reports?.rows || [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ShieldCheck className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Compliance & IEMIS", "अनुपालन र IEMIS")}
        subtitle={t(
          "Government reporting: EMIS exports, MoE reports, and the audit trail",
          "सरकारी प्रतिवेदन: EMIS निर्यात, शिक्षा मन्त्रालय राप्रति र अडिट रेकर्ड"
        )}
        actions={
          <Button onClick={() => setGenDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("Generate Report", "राप्रति बनाउनुहोस्")}
          </Button>
        }
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard
            label={t("Reports", "राप्रतिहरू")}
            value={reports?.pagination?.total ?? reportList.length}
            icon={<FileText className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Submitted", "पेश भएको")}
            value={reportList.filter((r) => r.status === "submitted").length}
            color="#107c10"
            icon={<ShieldCheck className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label={t("EMIS Exports", "EMIS निर्यात")}
            value={emis?.pagination?.total ?? (emis?.rows?.length || 0)}
            icon={<FileDown className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
        </StatGrid>

        <QuickLinks
          section="Reports"
          links={[
            { label: t("IEMIS Import", "IEMIS आयात"), icon: "Upload", href: "/dashboard/iemis-import" },
            { label: t("Import History", "आयात इतिहास"), icon: "ScrollText", href: "/dashboard/iemis-import/history" },
          ]}
        />

        <Tabs value={tab} onValueChange={(v) => setValues({ tab: v })}>
          <TabsList>
            <TabsTrigger value="reports">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> {t("Reports", "राप्रति")}
            </TabsTrigger>
            <TabsTrigger value="export" badge={emis?.pagination?.total || undefined}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> {t("EMIS Export", "EMIS निर्यात")}
            </TabsTrigger>
            <TabsTrigger value="audit">
              <ScrollText className="h-3.5 w-3.5 mr-1.5" /> {t("Audit Log", "अडिट लग")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <div className="mt-3">
              <DataPanel>
                <DataTable
                  columns={reportColumns}
                  rows={reportList}
                  rowKey={(r) => r.id}
                  loading={isLoading}
                  error={isError ? t("Failed to load reports", "राप्रति लोड गर्न असफल") : null}
                  onRetry={() => refetch()}
                  pagination={reports?.pagination}
                  onPageChange={setPage}
                  exportFileName="compliance-reports"
                  empty={{
                    icon: FileText,
                    title: t("No compliance reports yet", "अझै अनुपालन राप्रति छैन"),
                    body: t(
                      "Generate a draft to snapshot current student and staff counts for the academic year.",
                      "शैक्षिक सत्रको विद्यार्थी र कर्मचारी गणनाको स्न्यापसट बनाउन ड्राफ्ट उत्पन्न गर्नुहोस्।"
                    ),
                    action: {
                      label: t("Generate Report", "राप्रति बनाउनुहोस्"),
                      onClick: () => setGenDialog(true),
                    },
                  }}
                />
              </DataPanel>
            </div>
          </TabsContent>

          <TabsContent value="export">
            <div className="mt-3 space-y-3">
              <div className="win11-infobar info flex items-start gap-2 text-[12px]" style={{ padding: "8px 12px" }}>
                <Upload className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {t(
                    "Record the academic year you submitted to EMIS; downloads appear once the CSV writer task is wired (backend follow-up flagged in the rewrite report). Import school data from the IEMIS Import app.",
                    "EMIS मा पेश गरेको शैक्षिक सत्र रेकर्ड गर्नुहोस्; CSV लेखर कार्य जोडिएपछि डाउनलोड देखिनेछ।"
                  )}
                </span>
              </div>
              <DataPanel>
                <DataTable
                  columns={emisColumns}
                  rows={emis?.rows || []}
                  rowKey={(e) => e.id}
                  loading={emisLoading}
                  pagination={emis?.pagination}
                  onPageChange={setEmisPage}
                  empty={{
                    icon: Download,
                    title: t("No EMIS exports recorded", "EMIS निर्यात रेकर्ड छैन"),
                    body: t(
                      "Generate a report first, then register its EMIS submission here.",
                      "पहिले राप्रति बनाउनुहोस्, अनि त्यसको EMIS पेस रेकर्ड यहाँ गर्नुहोस्।"
                    ),
                    action: { label: t("Generate Report", "राप्रति बनाउनुहोस्"), onClick: () => setGenDialog(true) },
                  }}
                />
              </DataPanel>
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <div className="mt-3">
              <DataPanel>
                <DataTable
                  columns={auditColumns}
                  rows={audit?.rows || []}
                  rowKey={(a) => a.id}
                  loading={auditLoading}
                  pagination={audit?.pagination}
                  onPageChange={setAuditPage}
                  exportFileName="audit-log"
                  empty={{
                    icon: ScrollText,
                    title: t("Nothing audited yet", "अझै कुनै अडिट छैन"),
                  }}
                />
              </DataPanel>
            </div>
          </TabsContent>
        </Tabs>

        {/* Generate dialog — wired to POST /compliance/reports/generate */}
        <Dialog open={genDialog} onOpenChange={setGenDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("Generate Compliance Report", "अनुपालन राप्रति बनाउनुहोस्")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                generate.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label>{t("Report type", "राप्रति प्रकार")}</Label>
                <SimpleSelect
                  value={genForm.report_type}
                  onChange={(v) => setGenForm({ ...genForm, report_type: v })}
                  options={REPORT_TYPES.map((r) => ({ value: r.value, label: t(r.en, r.en) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ay">{t("Academic year (BS)", "शैक्षिक सत्र (बि.सं.)")}</Label>
                <Input
                  id="ay"
                  placeholder="2082"
                  value={genForm.academic_year}
                  onChange={(e) => setGenForm({ ...genForm, academic_year: e.target.value })}
                />
                <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                  {t(
                    "Creates a draft snapshot of current student and staff counts.",
                    "वर्तमान विद्यार्थी र कर्मचारी गणनाको ड्राफ्ट स्न्यापसट बनाउँछ।"
                  )}
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setGenDialog(false)}>
                  {t("Cancel", "रद्द")}
                </Button>
                <Button type="submit" disabled={generate.isPending}>
                  {generate.isPending ? <Spinner size="sm" /> : t("Generate", "बनाउनुहोस्")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
