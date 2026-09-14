"use client";

/**
 * Students / Bulk Import — A4 wizard (plan Part 34 row 1: "3 steps per
 * InfixEdu pattern"; 8.15: upload → validate → commit with per-row errors).
 *
 * Research (bulk CSV import UX): give the user the exact template BEFORE
 * asking for a file, pre-flight what can be pre-flighted client-side
 * (headers, row count), never make the user re-upload after a failure, and
 * show per-row errors from the server response. Applied: 3 wizard steps —
 * Prepare (template + file) → Validate (client header check for CSVs;
 * honest "server validates" note for .xlsx since no client parser exists —
 * TODO(rewrite-wave-A): server-side dry-run endpoint would let this step
 * show per-row errors BEFORE commit) → Import (per-row error list, retry
 * without re-choosing the file). Endpoints/format unchanged (POST
 * /iemis/import, format=student_namewise).
 */

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Wizard, type WizardStep } from "@/components/ui/wizard";
import { FilePicker } from "@/components/files/FilePicker";
import type { ManagedFile } from "@/lib/services/files.service";
import { DataPanel, KpiCard, StatGrid } from "@/components/aos/kit/page-kit";
import { AOSPage, AOSPageHeader, AOSPageBody } from "@/components/aos/kit/page-kit";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertCircle, CheckCircle2, FileSpreadsheet, FolderOpen, Download,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ImportLog {
  total_rows?: number;
  imported_rows?: number;
  skipped_rows?: number;
  error_rows?: number;
  errors?: Array<{ row?: number; error?: string }> | null;
  status?: string;
}

// Exact headers of the backend student_namewise format (FORMAT_MAP in
// iemis_importer.py) — the server ignores unknown columns, so extra
// spreadsheet columns are safe but only these are imported.
const TEMPLATE_COLUMNS = [
  "Student Id",
  "Full Name",
  "Gender",
  "Class",
  "Section",
  "DOB",
  "Father Name",
  "Mother Name",
  "Guardian Name",
  "Guardian Contact Number",
  "Permanent Address",
];

const REQUIRED_HEADERS = ["Student Id", "Full Name"];

export default function BulkImportPage() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportLog | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);
  // Client-side header pre-check (CSV only).
  const [headerCheck, setHeaderCheck] = useState<"idle" | "checking" | "ok" | "missing" | "skipped" | "unread">("idle");
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);

  async function inspectCsv(f: File) {
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setHeaderCheck("skipped"); // xlsx can't be parsed without a heavy lib
      return;
    }
    setHeaderCheck("checking");
    try {
      const text = await f.text();
      const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
      const headers = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const missing = REQUIRED_HEADERS.filter(
        (req) => !headers.some((h) => h.toLowerCase() === req.toLowerCase())
      );
      setMissingHeaders(missing);
      setHeaderCheck(missing.length === 0 ? "ok" : "missing");
    } catch {
      setHeaderCheck("unread");
    }
  }

  const handleManagedFileSelect = async (files: ManagedFile[]) => {
    const mf = files[0];
    try {
      const res = await fetch(mf.url);
      const blob = await res.blob();
      const f = new File([blob], mf.original_name, { type: blob.type });
      setFile(f);
      setResult(null);
      void inspectCsv(f);
    } catch {
      toast.error(t("Failed to load file from file manager", "फाइल लोड हुन सकेन"));
    }
  };

  const downloadTemplate = () => {
    const rows = [
      TEMPLATE_COLUMNS,
      [
        "STU-2082-001",
        "Ram Sharma",
        "male",
        "5",
        "A",
        "2067-01-15",
        "Hari Sharma",
        "Sita Sharma",
        "Hari Sharma",
        "9841234567",
        "Kathmandu",
      ],
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-bulk-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", "student_namewise");
      return (await api.post("/iemis/import", formData, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: (d) => {
      const r = d?.data || d;
      setResult(r);
      if (r?.error_rows > 0) {
        toast.warning(t(`Import finished with ${r.error_rows} error row(s)`, `${r.error_rows} पङ्क्ति त्रुटि`));
      } else {
        toast.success(t(`Import completed: ${r?.imported_rows ?? 0} student(s) imported`, `${r?.imported_rows ?? 0} विद्यार्थी आयात`));
      }
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || t("Import failed", "आयात असफल"));
    },
  });

  const steps: WizardStep[] = useMemo(() => [
    {
      key: "prepare",
      title: t("Prepare file", "फाइल तयार"),
      description: t(
        "Download the template, fill it, and pick the finished spreadsheet.",
        "टेम्प्लेट डाउनलोड गरी भर्नुहोस्, त्यसपछि फाइल छान्नुहोस्।",
      ),
      validate: () => (file ? null : t("Choose a .csv or .xlsx file to continue.", "जान्न .csv/.xlsx फाइल छान्नुहोस्।")),
      content: (
        <div className="p-4 sm:p-5 space-y-4">
          <div
            role="button"
            tabIndex={0}
            className={`win11-card flex flex-col items-center gap-3 text-center cursor-pointer ${headerCheck === "missing" ? "!border-[#c42b1c]" : ""}`}
            style={{ margin: 0, padding: "24px" }}
            onClick={() => setShowFilePicker(true)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowFilePicker(true); } }}
          >
            <FileSpreadsheet className="h-10 w-10" style={{ color: "var(--w11-text-secondary)" }} />
            {file ? (
              <>
                <p className="text-[13px] font-semibold">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>{t("Click to replace", "बदल्न क्लिक")}</p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold">{t("Choose a spreadsheet from the file manager", "फाइल म्यानेजरबाट छान्नुहोस्")}</p>
                <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>{t("Excel (.xlsx) or CSV", "एक्सेल वा CSV")}</p>
              </>
            )}
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setShowFilePicker(true); }}>
              <FolderOpen className="h-4 w-4 mr-2" /> {t("Browse vault", "भान्ट खोल्नुहोस्")}
            </Button>
          </div>
          <Button variant="outline" className="w-full" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> {t("Download sample template (CSV)", "नमुना टेम्प्लेट (CSV)")}</Button>
          <div className="win11-infobar info">
            <div>
              <p className="text-[12px] font-medium">{t("Column contract", "कोलम सम्झौता")}</p>
              <p className="text-[12px] mt-1">
                {t(
                  `Required headers: ${REQUIRED_HEADERS.join(", ")}. Extra columns are ignored; rows are matched by Student Id so a re-import UPDATES instead of duplicating.`,
                  `अनिवार्य: ${REQUIRED_HEADERS.join(", ")}। Student Id अनुसार मिल्दा अपडेट हुन्छ, डुप्लिकेट बन्दैन।`,
                )}
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "validate",
      title: t("Validate", "जाँच"),
      description: t(
        "A quick client-side header check; the server validates every row on import.",
        "तात्कालिक हेडर जाँच — प्रत्येक पङ्क्ति सर्वरले जाँचछ।",
      ),
      validate: () =>
        headerCheck === "missing"
          ? t(`Missing required header(s): ${missingHeaders.join(", ")} — fix the file and re-select it.`, `हेडर छैन: ${missingHeaders.join(", ")}`)
          : headerCheck === "checking"
          ? t("Still checking the file…", "जाँच हुँदैछ…")
          : null,
      content: (
        <div className="p-4 sm:p-5 space-y-3">
          {headerCheck === "ok" && (
            <div className="win11-infobar success"><p className="text-[13px]">{t("CSV headers look good — Student Id and Full Name are present.", "CSV हेडर ठीक छ।")}</p></div>
          )}
          {headerCheck === "missing" && (
            <div className="win11-infobar error"><p className="text-[13px]">{t(`Missing header(s): ${missingHeaders.join(", ")}. Open the file, fix row 1, save and re-select it.`, `हेडर छैन: ${missingHeaders.join(", ")} — पङ्क्ति 1 ठीक गरी फेरि छान्नुहोस्।`)}</p></div>
          )}
          {headerCheck === "skipped" && (
            <div className="win11-infobar info"><p className="text-[13px]">{t("Excel files are checked by the server on import — per-row errors will be listed in the next step.", "एक्सेल सर्वरले जाँचछ — त्रुटि अर्को चरणमा।")}</p></div>
          )}
          {headerCheck === "unread" && (
            <div className="win11-infobar warning"><p className="text-[13px]">{t("The file couldn't be read locally — import will attempt it and report row errors.", "फाइल पढ्न सकिएन — आयातमा खबर हुनेछ।")}</p></div>
          )}
          <EmptyState
            size="sm"
            icon={CheckCircle2}
            title={file?.name ?? ""}
            body={t("Nothing is written to the database until you press Import.", "आयात नथिचेसम्म केही लेखिँदैन।")}
          />
        </div>
      ),
    },
    {
      key: "import",
      title: t("Import", "आयात"),
      description: t("Commit the file and review per-row results.", "कमिट गरी नतिजा हेर्नुहोस्।"),
      validate: () => {
        if (upload.isPending) return t("Import is still running…", "आयात भइरहेको छ…");
        if (result) return t("Import already completed for this file.", "यो फाइल आयात भइसक्यो।");
        return null;
      },
      content: (
        <div className="p-4 sm:p-5 space-y-4">
          {!result ? (
            <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
              {upload.isPending
                ? t("Importing… this can take a minute for large files.", "आयात हुँदैछ…")
                : t('Use "Import Students" below to write the file — nothing touches the database until then.', "तलको आयात थिच्नुहोस्।")}
            </p>
          ) : (
            <>
              {result.error_rows ? (
                <div className="win11-infobar warning"><p className="text-[13px]">{t(`Imported ${result.imported_rows ?? 0}, ${result.error_rows} row(s) failed — see list below.`, `${result.imported_rows ?? 0} आयात, ${result.error_rows} असफल।`)}</p></div>
              ) : (
                <div className="win11-infobar success"><p className="text-[13px]">{t(`Done — ${result.imported_rows ?? 0} student(s) imported.`, `${result.imported_rows ?? 0} विद्यार्थी आयात भए।`)}</p></div>
              )}
              <StatGrid min={130}>
                <KpiCard label={t("Imported", "आयात")} value={result.imported_rows ?? 0} color="#107c10" />
                <KpiCard label={t("Failed", "असफल")} value={result.error_rows ?? 0} color={result.error_rows ? "#c42b1c" : "var(--w11-text-primary)"} />
                <KpiCard label={t("Skipped", "छोडिए")} value={result.skipped_rows ?? 0} color="var(--w11-text-primary)" />
              </StatGrid>
              {result.errors && result.errors.length > 0 && (
                <DataPanel title={t("Row errors", "पङ्क्ति त्रुटि")} bodyClassName="p-3">
                  <ul className="text-[12px] space-y-1 max-h-56 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <li key={i} className="flex gap-2">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#c42b1c]" />
                        <span>{e?.row != null ? `${t("Row", "पङ्क्ति")} ${e.row}: ` : ""}{e?.error || JSON.stringify(e)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] mt-3" style={{ color: "var(--w11-text-secondary)" }}>
                    {t("Fix the rows in your file, re-select it on step 1, and import again — matching Student Ids update instead of duplicating.", "पङ्क्ति ठीक गरी फेरि आयात; उही ID अपडेट हुन्छ।")}
                  </p>
                </DataPanel>
              )}
            </>
          )}
        </div>
      ),
    },
  ], [file, headerCheck, missingHeaders, result, upload.isPending]);

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileSpreadsheet className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Bulk Import Students", "विद्यार्थी बल्क आयात")}
        subtitle={t(
          "Import students from an Excel/CSV file (IEMIS student name-wise format)",
          "एक्सेल/CSV बाट विद्यार्थी आयात (IEMIS ढाँचा)",
        )}
      />
      <AOSPageBody>
        <div className="max-w-3xl">
          <Wizard steps={steps} onFinish={() => upload.mutate()} finishLabel={t("Import Students", "विद्यार्थी आयात")} />
        </div>
        <FilePicker
          open={showFilePicker}
          onOpenChange={setShowFilePicker}
          onSelect={handleManagedFileSelect}
          title="Select Spreadsheet"
        />
      </AOSPageBody>
    </AOSPage>
  );
}
