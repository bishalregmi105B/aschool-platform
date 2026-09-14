"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listFormats,
  validateImport,
  runImport,
  getHistory,
  getTemplateUrl,
  type ImportPreview,
  type ImportLog,
} from "@/lib/services/iemis.service";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wizard } from "@/components/ui/wizard";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  FileSpreadsheet,
  FolderOpen,
  Upload,
  CheckCircle2,
  AlertTriangle,
  History,
  Download,
} from "lucide-react";
import { FilePicker } from "@/components/files/FilePicker";
import {
  fetchManagedFileAsFile,
  type ManagedFile,
} from "@/lib/services/files.service";
import Link from "next/link";
import { useAOSRouteParams } from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";

/**
 * IEMIS Importer — A4 wizard (plan 34-42/4.3-6; NN/g import guidance:
 * validate before commit, plain-language per-row errors, retry without
 * restarting).
 *
 * Three steps: Upload → Detect (server dry-run summary: format, counts,
 * warnings) → Preview & Commit (per-row grid + honest consequence line).
 * The government workbook usually arrives by e-mail/USB, so step 1 accepts
 * both a local file and a vault file via FilePicker. Detection is the real
 * `/iemis/validate` dry run — nothing is guessed client-side and nothing is
 * written before the final step.
 */

const FORMAT_LABELS: Record<string, { en: string; ne: string }> = {
  student_namewise: { en: "Student Name-wise Report", ne: "विद्यार्थी नाम-अनुसार प्रतिवेदन" },
  school_level: { en: "School Level Report", ne: "विद्यालय-स्तर प्रतिवेदन" },
  staff_details: { en: "Staff Details Report", ne: "कर्मचारी विवरण प्रतिवेदन" },
};

export default function IemisImportPage() {
  return (
    <AppGate slug="iemis_importer">
      <IemisImportContent />
    </AppGate>
  );
}

function IemisImportContent() {
  const { t } = useI18n();
  const searchParams = useAOSRouteParams();
  const initialFormat = searchParams.get("format") || "";
  const [selectedFormat] = useState<string>(
    FORMAT_LABELS[initialFormat] ? initialFormat : ""
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [doneLog, setDoneLog] = useState<ImportLog | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: formatsData, isLoading: formatsLoading } = useQuery({
    queryKey: ["iemis-formats"],
    queryFn: () => listFormats(),
  });

  const { data: historyData } = useQuery({
    queryKey: ["iemis-history"],
    queryFn: async () => {
      const res = await getHistory(1);
      return res.items ?? [];
    },
  });

  const importMutation = useMutation({
    mutationFn: ({ file, format }: { file: File; format: string }) =>
      runImport(file, format || undefined),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["iemis-history"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setDoneLog(data);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || t("Import failed", "आयात असफल"));
    },
  });

  const handleManagedFileSelect = async (files: ManagedFile[]) => {
    const mf = files[0];
    try {
      const file = await fetchManagedFileAsFile(mf);
      setSelectedFile(file);
      setPreview(null);
    } catch {
      toast.error(
        t("Failed to load file from the file manager", "फाइल म्यानेजरबाट फाइल लोड गर्न सकिएन")
      );
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setPreview(null);
    setDoneLog(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const invalidRows = preview ? Math.max(0, preview.total_rows - preview.valid_rows) : 0;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileSpreadsheet className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("IEMIS Data Importer", "IEMIS डाटा आयात")}
        subtitle={t(
          "Import Nepal MoE IEMIS reports — validated row by row before anything is written",
          "नेपाल शिक्षा मन्त्रालयका IEMIS प्रतिवेदन आयात — लेख्नुअघि प्रत्येक पङ्क्ति जाँचिन्छ"
        )}
        actions={
          <Link href="/dashboard/iemis-import/history">
            <Button variant="outline" size="sm">
              <History className="h-4 w-4 mr-2" />
              {t("Import History", "आयात इतिहास")}
            </Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="max-w-5xl w-full mx-auto">
          <StatGrid>
            <KpiCard
              label={t("Imports Run", "आयातहरू")}
              value={(historyData || []).length}
              icon={<FileSpreadsheet className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
            />
            <KpiCard
              label={t("Completed", "सफल")}
              value={(historyData || []).filter((l) => l.status === "completed").length}
              color="#107c10"
              icon={<CheckCircle2 className="h-4 w-4" style={{ color: "#107c10" }} />}
            />
            <KpiCard
              label={t("Needs Attention", "ध्यान आवश्यक")}
              value={(historyData || []).filter((l) =>
                ["failed", "partial", "processing"].includes(l.status)
              ).length}
              color="#d83b01"
              icon={<AlertTriangle className="h-4 w-4" style={{ color: "#d83b01" }} />}
            />
            <KpiCard
              label={t("Rows Imported", "आयात पङ्क्तिहरू")}
              value={(historyData || []).reduce((a, l) => a + (l.imported_rows || 0), 0)}
              color="var(--w11-text-primary)"
            />
          </StatGrid>

          <QuickLinks
            section="Operations"
            links={[
              { label: t("Import Students", "विद्यार्थी आयात"), icon: "Users", href: "/dashboard/iemis-import?format=student_namewise" },
              { label: t("Import School Data", "विद्यालय डाटा आयात"), icon: "Building2", href: "/dashboard/iemis-import?format=school_level" },
              { label: t("Import History", "आयात इतिहास"), icon: "History", href: "/dashboard/iemis-import/history" },
              { label: t("Compliance & EMIS", "अनुपालन र EMIS"), icon: "ShieldCheck", href: "/dashboard/compliance" },
            ]}
          />

          <Tabs defaultValue="import">
            <TabsList>
              <TabsTrigger value="import">{t("Import Data", "डाटा आयात")}</TabsTrigger>
              <TabsTrigger value="formats">{t("Supported Formats", "समर्थित ढाँचाहरू")}</TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="mt-4">
              {doneLog ? (
                <ImportResult log={doneLog} onReset={reset} />
              ) : (
                <Wizard
                  finishLabel={t(
                    `Import ${preview?.valid_rows ?? 0} Rows`,
                    `${preview?.valid_rows ?? 0} पङ्क्ति आयात`
                  )}
                  onFinish={async () => {
                    if (!selectedFile) return;
                    await importMutation.mutateAsync({
                      file: selectedFile,
                      format: selectedFormat,
                    });
                  }}
                  steps={[
                    {
                      key: "upload",
                      title: t("Upload", "अपलोड"),
                      description: t(
                        "Choose the government Excel file",
                        "सरकारी Excel फाइल छान्नुहोस्"
                      ),
                      validate: () =>
                        selectedFile
                          ? null
                          : t("Please choose a file first", "कृपया पहिले फाइल छान्नुहोस्"),
                      validateAsync: async () => {
                        if (!selectedFile)
                          return t("Please choose a file first", "कृपया पहिले फाइल छान्नुहोस्");
                        if (preview && preview.filename === selectedFile.name) return null;
                        try {
                          const p = await validateImport(selectedFile, selectedFormat || undefined);
                          setPreview(p);
                          return null;
                        } catch (err: unknown) {
                          const e = err as { response?: { data?: { error?: string } } };
                          return (
                            e?.response?.data?.error ||
                            t("The file could not be read", "फाइल पढ्न सकिएन")
                          );
                        }
                      },
                      content: (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Upload className="h-3.5 w-3.5 mr-1.5" />
                              {t("Choose from this device", "यही यन्त्रबाट छान्नुहोस्")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowFilePicker(true)}
                            >
                              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                              {t("Choose from File Manager", "फाइल म्यानेजरबाट छान्नुहोस्")}
                            </Button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                setSelectedFile(f);
                                setPreview(null);
                              }}
                            />
                          </div>

                          <div
                            className="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
                            style={{
                              borderColor: "var(--w11-border-strong)",
                              background: "var(--w11-control-hover)",
                            }}
                          >
                            <FileSpreadsheet
                              className="h-8 w-8 mx-auto mb-2"
                              style={{ color: "var(--w11-text-secondary)" }}
                            />
                            {selectedFile ? (
                              <p className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                                {selectedFile.name}
                              </p>
                            ) : (
                              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                                {t("No file chosen yet", "अहिलेसम्म फाइल छानिएको छैन")}
                              </p>
                            )}
                            <p className="text-xs mt-1" style={{ color: "var(--w11-text-secondary)" }}>
                              {t(
                                "Supports .xlsx, .xls, .csv — max 20 MB. Format is auto-detected.",
                                ".xlsx, .xls, .csv समर्थित — अधिकतम 20 MB। ढाँचा स्वचालित पहिचान हुन्छ।"
                              )}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                              {t("Blank government templates:", "खाली सरकारी ढाँचाहरू:")}
                            </span>
                            {Object.keys(FORMAT_LABELS).map((code) => (
                              <a
                                key={code}
                                href={getTemplateUrl(code)}
                                className="inline-flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1"
                                style={{
                                  color: "var(--w11-accent)",
                                  background: "var(--w11-accent-light)",
                                  border: "1px solid var(--w11-accent)",
                                }}
                              >
                                <Download className="h-3 w-3" />
                                {t(FORMAT_LABELS[code].en, FORMAT_LABELS[code].ne)}
                              </a>
                            ))}
                          </div>
                          <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                            {t(
                              "Next runs a server-side dry-run validation — nothing is written yet.",
                              "Next ले सर्भर-साइड ड्राई-रन जाँच गर्छ — अहिलेसम्म केही लेखिएको छैन।"
                            )}
                          </p>
                        </div>
                      ),
                    },
                    {
                      key: "detect",
                      title: t("Detect", "पहिचान"),
                      description: t("Server dry-run results", "सर्भर ड्राई-रन नतिजा"),
                      validate: () =>
                        preview
                          ? null
                          : t(
                              "Validation did not run — go back and press Next again",
                              "जाँच भएन — पछाडि फर्केर Next थिच्नुहोस्"
                            ),
                      content: preview ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <StatBox
                              label={t("Detected format", "पहिचान ढाँचा")}
                              value={
                                FORMAT_LABELS[preview.format]
                                  ? t(FORMAT_LABELS[preview.format].en, FORMAT_LABELS[preview.format].ne)
                                  : preview.format
                              }
                            />
                            <StatBox label={t("File", "फाइल")} value={preview.filename} />
                            <StatBox
                              label={t("Total rows", "कुल पङ्क्ति")}
                              value={String(preview.total_rows)}
                            />
                            <StatBox
                              label={t("Valid rows", "मान्य पङ्क्ति")}
                              value={String(preview.valid_rows)}
                              highlight
                            />
                          </div>
                          {invalidRows > 0 && (
                            <div
                              className="win11-infobar error text-[12px]"
                              style={{ padding: "8px 12px" }}
                            >
                              {t(
                                `${invalidRows} row(s) will be skipped — the exact reason per row is reported after the run in History.`,
                                `${invalidRows} पङ्क्ति छोडिनेछ — प्रत्येक पङ्क्तिको कारण आयातपछि इतिहासमा हेर्नुहोस्।`
                              )}
                            </div>
                          )}
                          {preview.warnings.length > 0 && (
                            <div
                              className="win11-infobar warning text-[12px]"
                              style={{ padding: "8px 12px" }}
                            >
                              <p className="font-medium mb-1">
                                {t(
                                  `Warnings (${preview.warnings.length})`,
                                  `चेतावनी (${preview.warnings.length})`
                                )}
                              </p>
                              <ul className="space-y-0.5">
                                {preview.warnings.map((w, i) => (
                                  <li key={i}>• {w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : null,
                    },
                    {
                      key: "preview",
                      title: t("Preview & Commit", "पूर्वावलोकन र पुष्टि"),
                      description: t(
                        "Check the rows, then import",
                        "पङ्क्तिहरू हेर्नुहोस्, अनि आयात"
                      ),
                      content: preview ? (
                        <div className="space-y-3">
                          <DataPanel
                            bodyClassName="overflow-x-auto p-0"
                            title={
                              <span
                                className="text-[12px]"
                                style={{ color: "var(--w11-text-secondary)" }}
                              >
                                {t(
                                  `Preview — first ${preview.preview.length} valid rows`,
                                  `पूर्वावलोकन — पहिलो ${preview.preview.length} मान्य पङ्क्ति`
                                )}
                              </span>
                            }
                          >
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {Object.keys(preview.preview[0] || { full_name: "" })
                                    .filter((k) => k !== "row")
                                    .map((k) => (
                                      <TableHead key={k} className="text-xs whitespace-nowrap">
                                        {k}
                                      </TableHead>
                                    ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {preview.preview.map((row, i) => (
                                  <TableRow key={i}>
                                    {Object.entries(row)
                                      .filter(([k]) => k !== "row")
                                      .map(([k, v]) => (
                                        <TableCell
                                          key={k}
                                          className="text-xs whitespace-nowrap max-w-[160px] truncate"
                                        >
                                          {v != null ? String(v) : "—"}
                                        </TableCell>
                                      ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </DataPanel>
                          <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                            {t(
                              "Importing writes to live records and cannot be undone from this screen — a full per-row log is kept in History.",
                              "आयातले प्रत्यक्ष रेकर्डमा लेख्छ — पूर्ण लग इतिहासमा राखिन्छ।"
                            )}
                          </p>
                        </div>
                      ) : null,
                    },
                  ]}
                />
              )}
            </TabsContent>

            <TabsContent value="formats" className="mt-4">
              {formatsLoading ? (
                <AOSModuleLoadingState label={t("Loading formats…", "ढाँचा लोड हुँदैछ…")} />
              ) : (
                <div className="space-y-4">
                  {(formatsData ?? []).map((fmt) => (
                    <DataPanel
                      key={fmt.code}
                      title={
                        <span className="text-[13px] flex items-center gap-2">
                          <FileSpreadsheet
                            className="h-4 w-4"
                            style={{ color: "var(--w11-accent)" }}
                          />
                          {fmt.name}
                          <span className="win11-chip subtle text-xs font-mono">{fmt.code}</span>
                        </span>
                      }
                    >
                      <p className="text-xs mb-3" style={{ color: "var(--w11-text-secondary)" }}>
                        {t("Sheet", "सिट")}: {fmt.sheet}
                      </p>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">
                                {t("IEMIS Column", "IEMIS पङ्क्तिशीर्षक")}
                              </TableHead>
                              <TableHead className="text-xs">
                                {t("ASchool Field", "ASchool फिल्ड")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {fmt.columns.map((col) => (
                              <TableRow key={col.iemis_column}>
                                <TableCell
                                  className="text-xs font-mono"
                                  style={{ color: "var(--w11-text-secondary)" }}
                                >
                                  {col.iemis_column}
                                </TableCell>
                                <TableCell
                                  className="text-xs font-mono"
                                  style={{ color: "var(--w11-accent)" }}
                                >
                                  {col.aschool_field}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </DataPanel>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <FilePicker
          open={showFilePicker}
          onOpenChange={setShowFilePicker}
          onSelect={handleManagedFileSelect}
          title={t("Select IEMIS Spreadsheet", "IEMIS स्प्रेडसिट छान्नुहोस्")}
        />
      </AOSPageBody>
    </AOSPage>
  );
}

function ImportResult({ log, onReset }: { log: ImportLog; onReset: () => void }) {
  const { t } = useI18n();
  const errors = log.errors || [];
  const ok = log.status === "completed";
  return (
    <DataPanel>
      <div className="py-8 text-center space-y-3">
        <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: ok ? "#107c10" : "#d83b01" }} />
        <p className="font-semibold text-lg" style={{ color: "var(--w11-text-primary)" }}>
          {ok
            ? t("Import complete", "आयात सम्पन्न")
            : t("Import finished with problems", "केही समस्यासहित आयात सम्पन्न")}
        </p>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {t(
            `${log.imported_rows} imported · ${log.skipped_rows} skipped · ${log.error_rows} errors`,
            `${log.imported_rows} आयात · ${log.skipped_rows} छोडिएको · ${log.error_rows} त्रुटि`
          )}
        </p>
        {errors.length > 0 && (
          <div className="max-w-md mx-auto text-left">
            <div className="win11-infobar error text-[12px]" style={{ padding: "8px 12px" }}>
              <p className="font-medium mb-1">
                {t("Per-row errors", "पङ्क्ति-अनुसार त्रुटिहरू")}:
              </p>
              <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                {errors.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    {e.row != null ? t(`Row ${e.row}`, `पङ्क्ति ${e.row}`) : "#"}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <Button onClick={onReset}>
            {t("Import another file", "अर्को फाइल आयात")}
          </Button>
          <Link href="/dashboard/iemis-import/history">
            <Button variant="outline">{t("View History", "इतिहास हेर्नुहोस्")}</Button>
          </Link>
        </div>
      </div>
    </DataPanel>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-3 border text-center"
      style={
        highlight
          ? { background: "rgba(16,124,16,0.08)", borderColor: "rgba(16,124,16,0.35)" }
          : { background: "var(--w11-control-hover)", borderColor: "var(--w11-border-subtle)" }
      }
    >
      <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
        {label}
      </p>
      <p
        className="text-sm font-semibold truncate"
        style={{ color: highlight ? "#107c10" : "var(--w11-text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}
