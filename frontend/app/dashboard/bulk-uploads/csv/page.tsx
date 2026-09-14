"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wizard } from "@/components/ui/wizard";
import { SimpleSelect } from "@/components/ui/advanced-select";
import { FilePicker } from "@/components/files/FilePicker";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import type { ManagedFile } from "@/lib/services/files.service";
import {
  validateImport,
  runImport,
  getTemplateUrl,
  type ImportPreview,
  type ImportLog,
} from "@/lib/services/iemis.service";
import { UploadCloud, FileText, Download, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { QuickLinks } from "@/components/aos/kit/quick-links";

/**
 * Generic CSV import — A4 3-step wizard (plan 34-49).
 *
 * This page posts to the same /iemis importer endpoints as the dedicated
 * IEMIS app (the backend has one validated importer), so it reuses the
 * service layer and the dry-run validate → preview → commit flow instead of
 * the previous "pick a format, pray" one-shot upload with a response shape
 * the API does not return.
 */

const FORMATS = [
  { value: "student_namewise", en: "Students (IEMIS Name-wise)", ne: "विद्यार्थी (IEMIS नाम-अनुसार)" },
  { value: "staff_details", en: "Staff Details", ne: "कर्मचारी विवरण" },
  { value: "school_level", en: "School Level Report", ne: "विद्यालय-स्तर प्रतिवेदन" },
];

export default function CsvUploadPage() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [doneLog, setDoneLog] = useState<ImportLog | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: () => runImport(file as File, format),
    onSuccess: (log) => setDoneLog(log),
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || t("Import failed", "आयात असफल"));
    },
  });

  const handleManagedFileSelect = async (files: ManagedFile[]) => {
    const selected = files[0];
    try {
      const response = await fetch(selected.url);
      const blob = await response.blob();
      setFile(new File([blob], selected.original_name, { type: blob.type }));
      setPreview(null);
    } catch {
      toast.error(t("Could not load selected file from File Manager", "फाइल म्यानेजरबाट लोड गर्न सकिएन"));
    }
  };

  const { data: formats } = useQuery({
    queryKey: ["iemis-formats"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ code: string; name: string }[]>>("/iemis/formats");
      return res.data.data || [];
    },
    retry: 1,
  });

  const downloadTemplate = () => {
    if (!format) {
      toast.error(t("Choose an import type first", "पहिले आयात प्रकार छान्नुहोस्"));
      return;
    }
    window.open(getTemplateUrl(format), "_blank", "noopener");
  };

  if (doneLog) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title={t("CSV Import", "CSV आयात")}
        />
        <AOSPageBody>
          <div className="max-w-3xl mx-auto">
            <DataPanel>
              <div className="py-8 text-center space-y-3">
                <p
                  className="font-semibold text-lg"
                  style={{ color: doneLog.error_rows > 0 ? "#d83b01" : "#107c10" }}
                >
                  {doneLog.error_rows > 0
                    ? t("Import finished with errors", "त्रुटिसहित आयात सम्पन्न")
                    : t("Import complete", "आयात सम्पन्न")}
                </p>
                <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                  {t(
                    `${doneLog.imported_rows} imported · ${doneLog.skipped_rows ?? 0} skipped · ${doneLog.error_rows} errors`,
                    `${doneLog.imported_rows} आयात · ${doneLog.skipped_rows ?? 0} छोडिएको · ${doneLog.error_rows} त्रुटि`
                  )}
                </p>
                {(doneLog.errors?.length ?? 0) > 0 && (
                  <div className="win11-infobar error text-[12px] text-left" style={{ padding: "8px 12px" }}>
                    <ul className="max-h-40 overflow-y-auto space-y-0.5">
                      {doneLog.errors!.slice(0, 50).map((e, i) => (
                        <li key={i}>
                          {e.row != null ? t(`Row ${e.row}`, `पङ्क्ति ${e.row}`) : "#"}: {e.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 justify-center pt-2">
                  <Button
                    onClick={() => {
                      setDoneLog(null);
                      setFile(null);
                      setPreview(null);
                    }}
                  >
                    {t("Import another file", "अर्को फाइल आयात")}
                  </Button>
                  <Link href="/dashboard/bulk-uploads/history">
                    <Button variant="outline">{t("View History", "इतिहास हेर्नुहोस्")}</Button>
                  </Link>
                </div>
              </div>
            </DataPanel>
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("CSV Import", "CSV आयात")}
        subtitle={t(
          "Fill a template, upload, review row by row, then import",
          "ढाँचा भर्नुहोस्, अपलोड गर्नुहोस्, पङ्क्ति जाँच्नुहोस्, अनि आयात"
        )}
        actions={
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            {t("Download Template", "ढाँचा डाउनलोड")}
          </Button>
        }
      />
      <AOSPageBody>
        <div className="max-w-3xl mx-auto">
          <QuickLinks
            section="Operations"
            links={[
              { label: t("IEMIS Import (Excel)", "IEMIS आयात (Excel)"), icon: "FileSpreadsheet", href: "/dashboard/iemis-import" },
              { label: t("Import History", "आयात इतिहास"), icon: "History", href: "/dashboard/bulk-uploads/history" },
            ]}
          />
          <Wizard
            finishLabel={t("Import", "आयात")}
            onFinish={async () => {
              await importMutation.mutateAsync();
            }}
            steps={[
              {
                key: "upload",
                title: t("Upload", "अपलोड"),
                validate: () => {
                  if (!format) return t("Choose an import type", "आयात प्रकार छान्नुहोस्");
                  if (!file) return t("Choose a CSV file", "CSV फाइल छान्नुहोस्");
                  return null;
                },
                validateAsync: async () => {
                  if (!file || !format) return null;
                  if (preview?.filename === file.name) return null;
                  try {
                    setPreview(await validateImport(file, format));
                    return null;
                  } catch (err: unknown) {
                    const e = err as { response?: { data?: { error?: string } } };
                    return e?.response?.data?.error || t("The file could not be read", "फाइल पढ्न सकिएन");
                  }
                },
                content: (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>{t("Import type", "आयात प्रकार")}</Label>
                      <SimpleSelect
                        value={format}
                        onChange={setFormat}
                        placeholder={t("Select data type…", "डाटा प्रकार छान्नुहोस्…")}
                        options={FORMATS.map((f) => ({ value: f.value, label: t(f.en, f.ne) }))}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                        {t("Choose from this device", "यही यन्त्रबाट")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowFilePicker(true)}>
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        {t("Choose from File Manager", "फाइल म्यानेजरबाट")}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          setFile(e.target.files?.[0] || null);
                          setPreview(null);
                        }}
                      />
                    </div>
                    <div
                      className="border-2 border-dashed rounded-lg p-6 text-center"
                      style={{ borderColor: "var(--w11-border-strong)", background: "var(--w11-control-hover)" }}
                    >
                      <p className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                        {file ? file.name : t("No file selected", "फाइल छानिएको छैन")}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--w11-text-secondary)" }}>
                        {t(
                          "Keep the header row exactly as in the template · max 20 MB",
                          "हेडर पङ्क्ति ढाँचाजस्तै राख्नुहोस् · अधिकतम 20 MB"
                        )}
                      </p>
                      {formats && formats.length > 0 && (
                        <p className="text-[11px] mt-2" style={{ color: "var(--w11-text-tertiary)" }}>
                          {t("Loaded formats", "लोड ढाँचाहरू")}: {formats.map((f) => f.code).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: "detect",
                title: t("Detect", "पहिचान"),
                description: t("Dry-run validation on the server", "सर्भरमा ड्राई-रन जाँच"),
                validate: () => (preview ? null : t("Validation did not run", "जाँच भएन")),
                content: preview ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { l: t("Total rows", "कुल"), v: preview.total_rows, c: "var(--w11-text-primary)" },
                        { l: t("Valid", "मान्य"), v: preview.valid_rows, c: "#107c10" },
                        {
                          l: t("Skipped", "छोडिएको"),
                          v: Math.max(0, preview.total_rows - preview.valid_rows),
                          c: "#c42b1c",
                        },
                      ].map((s) => (
                        <div
                          key={s.l}
                          className="rounded-lg p-3 border border-[var(--w11-border-subtle)]"
                          style={{ background: "var(--w11-control-hover)" }}
                        >
                          <p className="text-2xl font-bold" style={{ color: s.c }}>{s.v}</p>
                          <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{s.l}</p>
                        </div>
                      ))}
                    </div>
                    {preview.warnings.length > 0 && (
                      <div className="win11-infobar warning text-[12px]" style={{ padding: "8px 12px" }}>
                        <p className="font-medium mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {t(`Warnings (${preview.warnings.length})`, `चेतावनी (${preview.warnings.length})`)}
                        </p>
                        <ul className="space-y-0.5">
                          {preview.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null,
              },
              {
                key: "preview",
                title: t("Preview & Commit", "पूर्वावलोकन र पुष्टि"),
                validate: () => (preview ? null : t("Validation did not run", "जाँच भएन")),
                content: preview ? (
                  <div className="space-y-3">
                    {preview.preview.length > 0 && (
                      <DataPanel bodyClassName="overflow-x-auto p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {Object.keys(preview.preview[0])
                                .filter((k) => k !== "row")
                                .slice(0, 6)
                                .map((k) => (
                                  <TableHead key={k} className="text-xs whitespace-nowrap">{k}</TableHead>
                                ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {preview.preview.map((row, i) => (
                              <TableRow key={i}>
                                {Object.entries(row)
                                  .filter(([k]) => k !== "row")
                                  .slice(0, 6)
                                  .map(([k, v]) => (
                                    <TableCell key={k} className="text-xs whitespace-nowrap max-w-[160px] truncate">
                                      {v != null ? String(v) : "—"}
                                    </TableCell>
                                  ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </DataPanel>
                    )}
                    <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                      {t(
                        `About to import ${preview.valid_rows} rows. This writes to live records; a full per-row log is kept in History.`,
                        `${preview.valid_rows} पङ्क्ति आयात हुँदैछ। पूर्ण लग इतिहासमा राखिन्छ।`
                      )}
                    </p>
                  </div>
                ) : null,
              },
            ]}
          />
        </div>
        <FilePicker
          open={showFilePicker}
          onOpenChange={setShowFilePicker}
          onSelect={handleManagedFileSelect}
          fileType="spreadsheet"
          title={t("Select CSV File", "CSV फाइल छान्नुहोस्")}
        />
      </AOSPageBody>
    </AOSPage>
  );
}
