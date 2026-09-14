"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wizard, type WizardStep } from "@/components/ui/wizard";
import { useI18n } from "@/lib/i18n";
import { FilePicker } from "@/components/files/FilePicker";
import {
  fetchManagedFileAsFile,
  type ManagedFile,
} from "@/lib/services/files.service";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatGrid,
  KpiCard,
} from "@/components/aos/kit/page-kit";
import {
  Upload, FileSpreadsheet, FileCheck2, CloudUpload, AlertTriangle,
  CheckCircle2, ArrowLeft, XCircle, Download, FolderOpen,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────
interface ImportEntry {
  student_id: string;
  date_bs?: string;
  date?: string;
  status: string;
  remarks?: string;
}

interface PreviewResponse {
  valid_count: number;
  error_count: number;
  errors: Array<{ row: number; error: string }>;
  preview: Array<{
    student_id: string;
    student_name: string;
    date: string;
    date_bs?: string | null;
    status: string;
    remarks?: string | null;
  }>;
}

const VALID_STATUSES = ["present", "absent", "late", "half_day", "leave", "holiday"];

export default function AttendanceImportPage() {
  return (
    <AppGate slug="attendance">
      <ImportContent />
    </AppGate>
  );
}

/** Minimal RFC-4180-ish CSV parser (quoted fields, embedded commas/newlines,
 *  CRLF). No XLSX dependency ships with the app, so spreadsheets should be
 *  saved as CSV first — the file picker and hints say so. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0].trim() !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0].trim() !== "") rows.push(row);
  return rows;
}

function parseEntries(csv: string): { entries: ImportEntry[]; parseErrors: string[] } {
  const rows = parseCsv(csv);
  if (rows.length === 0) return { entries: [], parseErrors: ["The file is empty."] };

  // Header row (student_id, date_bs|date, status, remarks) — case/space tolerant.
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header.includes("student_id") && header.includes("status");
  const colIdx = (names: string[]) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idIdx = hasHeader ? colIdx(["student_id"]) : 0;
  const bsIdx = hasHeader ? colIdx(["date_bs", "date_bs_date"]) : 1;
  const adIdx = hasHeader ? colIdx(["date"]) : -1;
  const statusIdx = hasHeader ? colIdx(["status"]) : 2;
  const remarksIdx = hasHeader ? colIdx(["remarks"]) : 3;

  const entries: ImportEntry[] = [];
  const parseErrors: string[] = [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  dataRows.forEach((r, i) => {
    const lineNo = (hasHeader ? i + 2 : i + 1);
    if (r.every((c) => !c.trim())) return; // blank line
    const studentId = (r[idIdx] || "").trim();
    const dateBs = bsIdx >= 0 ? (r[bsIdx] || "").trim() : "";
    const dateAd = adIdx >= 0 ? (r[adIdx] || "").trim() : "";
    const status = (r[statusIdx] || "").trim().toLowerCase();
    const remark = remarksIdx >= 0 ? (r[remarksIdx] || "").trim() : "";
    if (!studentId || (!dateBs && !dateAd) || !status) {
      parseErrors.push(`Line ${lineNo}: student_id, date and status are required.`);
      return;
    }
    if (!VALID_STATUSES.includes(status)) {
      parseErrors.push(
        `Line ${lineNo}: invalid status "${status}" (use present/absent/late/half_day/leave/holiday).`,
      );
      return;
    }
    const entry: ImportEntry = { student_id: studentId, status };
    if (dateBs) entry.date_bs = dateBs;
    else entry.date = dateAd;
    if (remark) entry.remarks = remark;
    entries.push(entry);
  });
  return { entries, parseErrors };
}

function ImportContent() {
  const { t } = useI18n();
  const [fileName, setFileName] = useState("");
  const [rawCsv, setRawCsv] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<{ applied: number; skipped_invalid: number } | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);

  const parsed = useMemo(() => parseEntries(rawCsv), [rawCsv]);

  const reset = () => {
    setFileName("");
    setRawCsv("");
    setPreview(null);
    setCommitResult(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error(t("Please choose a .csv file (export your spreadsheet as CSV first).", ".csv फाइल छान्नुहोस्।"));
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setRawCsv(text);
    setPreview(null);
    setCommitResult(null);
  };

  /** Vault pick → fetch the file's bytes back → run the existing CSV parse. */
  const handleManagedFileSelect = async (files: ManagedFile[]) => {
    const mf = files[0];
    if (!mf) return;
    setLoadingFile(true);
    try {
      const fileObj = await fetchManagedFileAsFile(mf);
      await onFile(fileObj);
    } catch {
      toast.error(t("Failed to load file from the file manager", "फाइल लोड हुन सकेन"));
    } finally {
      setLoadingFile(false);
    }
  };

  const previewQuery = useMutation({
    mutationFn: async () => {
      const res = await api.post("/attendance/import/preview", { entries: parsed.entries });
      return res.data?.data as PreviewResponse;
    },
    onSuccess: (data) => setPreview(data),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/attendance/import/commit", { entries: parsed.entries });
      return res.data?.data as { applied: number; skipped_invalid: number };
    },
    onSuccess: (data) => {
      setCommitResult(data);
      toast.success(t(`Import applied — ${data?.applied ?? 0} rows written.`, `${data?.applied ?? 0} पङ्क्ति लेखिए।`));
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : t("Commit failed", "कमिट असफल"));
    },
  });

  const downloadTemplate = () => {
    const csv = [
      "student_id,date_bs,status,remarks",
      "<student-uuid>,2081-05-15,present,",
      "<student-uuid>,2081-05-15,absent,Medical",
    ].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // A4: ui/wizard owns the step chrome; async validation runs the SERVER
  // preview as the gate between "review" and "commit" (plan: per-row errors
  // before commit; failure offers retry-from-step, never restart).
  const steps: WizardStep[] = [
    {
      key: "file",
      title: t("Choose file", "फाइल छान्नुहोस्"),
      validate: () =>
        !rawCsv
          ? t("Choose a CSV from the file manager to continue.", "CSV छान्नुहोस्।")
          : parsed.entries.length === 0
          ? t("The file parsed to zero rows — check the column layout.", "कुनै पङ्क्ति पार्स भएन।")
          : null,
      content: (
        <div className="p-4 sm:p-5 space-y-4">
          <div
            role="button"
            tabIndex={0}
            className="flex flex-col items-center justify-center gap-2 rounded-[var(--w11-radius-lg)] border-2 border-dashed border-[var(--w11-border-default)] py-12 cursor-pointer hover:bg-[var(--w11-control-hover)] transition-colors"
            onClick={() => setShowFilePicker(true)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowFilePicker(true); } }}
          >
            <FolderOpen className="h-10 w-10 text-[color:var(--w11-text-secondary)] opacity-40" />
            <p className="font-medium">
              {loadingFile
                ? t("Loading file from the vault…", "फाइल आउँदै…")
                : fileName || t("Choose a CSV from the file manager", "फाइल म्यानेजरबाट CSV छान्नुहोस्")}
            </p>
            <p className="text-xs text-[color:var(--w11-text-secondary)]">
              {t("Columns: student_id, date_bs (or date), status, remarks — .csv / .txt", "स्तम्भ: student_id, date_bs, status, remarks")}
            </p>
          </div>
          <div className="win11-infobar info">
            <div>
              <p className="text-[12px]">
                {t("Spreadsheets (XLSX) are not parsed in-browser — export the sheet as CSV first. Statuses: present, absent, late, half_day, leave, holiday.", "XLSX ब्राउजरमा पार्स हुँदैन — CSV निर्यात गर्नुहोस्।")}
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> {t("Download CSV template", "टेम्प्लेट")}
              </Button>
            </div>
          </div>
          {parsed.parseErrors.length > 0 && (
            <div
              className="rounded-[var(--w11-radius-md)] border px-3 py-2 text-xs space-y-0.5"
              style={{ borderColor: "rgba(216,59,1,0.3)", background: "rgba(216,59,1,0.08)", color: "#d83b01" }}
            >
              <p className="font-medium">{t("Some rows were skipped while parsing:", "केही पङ्क्ति छोडियो:")}</p>
              {parsed.parseErrors.slice(0, 5).map((e, i) => <p key={i}>• {e}</p>)}
              {parsed.parseErrors.length > 5 && <p>• …{parsed.parseErrors.length - 5}+</p>}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "validate",
      title: t("Validate against the school", "सर्वर जाँच"),
      description: t("Every student, date and status is checked before anything is written.", "लेख्नुअघि सबै कुरा जाँचिन्छ।"),
      validateAsync: async () => {
        if (!parsed.entries.length) return t("No rows to validate.", "जाँच गर्नुपर्छ।");
        try {
          const data = await previewQuery.mutateAsync();
          if (!data || data.valid_count === 0) {
            return t("Nothing valid to import — review the errors in the list below, fix the file, and start over.", "कुनै वैध पङ्क्ति छैन — त्रुटि हेर्नुहोस्।");
          }
          return null;
        } catch {
          return t("Server validation failed — nothing was written. Use Back and retry.", "सर्वर जाँच असफल — फेरि प्रयास।");
        }
      },
      content: (
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-sm">{t(`Parsed ${parsed.entries.length} rows from`, "")} <strong>{fileName}</strong></p>
          <StatGrid min={140}>
            <KpiCard label={t("Rows parsed", "पङ्क्ति")} value={parsed.entries.length} />
            {parsed.parseErrors.length > 0 && (
              <KpiCard label={t("Local parse issues", "स्थानीय समस्या")} value={parsed.parseErrors.length} color="#d83b01" />
            )}
          </StatGrid>
          <div className="rounded-[var(--w11-radius-lg)] border border-[var(--w11-border-subtle)] overflow-auto max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">{t("Row", "पङ्क्ति")}</TableHead>
                  <TableHead>{t("Student ID", "विद्यार्थी")}</TableHead>
                  <TableHead>{t("Date", "मिति")}</TableHead>
                  <TableHead>{t("Status", "अवस्था")}</TableHead>
                  <TableHead>{t("Remarks", "टिप्पणी")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.entries.slice(0, 20).map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-center font-mono text-xs">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{e.student_id}</TableCell>
                    <TableCell>{e.date_bs || e.date}</TableCell>
                    <TableCell><Badge variant="outline">{e.status}</Badge></TableCell>
                    <TableCell>{e.remarks || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {parsed.entries.length > 20 && (
              <p className="px-3 py-2 text-xs text-[color:var(--w11-text-secondary)]">
                {t(`Showing first 20 of ${parsed.entries.length} rows.`, `पहिलो २०/${parsed.entries.length}`)}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "commit",
      title: t("Preview & import", "पूर्वावलोकन र आयात"),
      description: t("Commit writes only the rows the server marked valid.", "वैध पङ्क्ति मात्र लेखिन्छ।"),
      validate: () => (!preview ? t("Run validation in the previous step first.", "अघिल्लो चरण पूरा गर्नुहोस्।") : null),
      content: !preview ? (
        <div className="p-5 text-sm text-[color:var(--w11-text-secondary)]">{t("No validation result yet.", "नतिजा छैन।")}</div>
      ) : commitResult ? (
        <div
          className="m-4 rounded-[var(--w11-radius-lg)] border px-4 py-6 text-center"
          style={{ borderColor: "rgba(16,124,16,0.3)", background: "rgba(16,124,16,0.08)" }}
        >
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2" style={{ color: "#107c10" }} />
          <p className="text-lg font-bold" style={{ color: "#107c10" }}>
            {commitResult.applied} {t("rows applied", "पङ्क्ति लेखिए")}
          </p>
          {commitResult.skipped_invalid > 0 && (
            <p className="text-sm" style={{ color: "#d83b01" }}>
              {commitResult.skipped_invalid} {t("invalid rows were skipped.", "अवैध पङ्क्ति छोडियो।")}
            </p>
          )}
          <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
            {t("Import another file", "अर्को फाइल")}
          </Button>
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-4">
          <StatGrid min={140} className="max-w-sm">
            <KpiCard label={t("Valid rows", "वैध")} value={preview.valid_count} color="#107c10" />
            <KpiCard label={t("Rows with errors", "त्रुटि")} value={preview.error_count} color="#c42b1c" />
          </StatGrid>
          {preview.errors.length > 0 && (
            <div className="rounded-[var(--w11-radius-lg)] border border-[rgba(196,43,28,0.3)] overflow-auto max-h-56">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t("Row", "पङ्क्ति")}</TableHead>
                    <TableHead>{t("Error", "त्रुटि")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.errors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center font-mono text-xs">{e.row}</TableCell>
                      <TableCell className="text-sm" style={{ color: "#c42b1c" }}>
                        <span className="inline-flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5" /> {e.error}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {preview.preview.length > 0 && (
            <div className="rounded-[var(--w11-radius-lg)] border border-[var(--w11-border-subtle)] overflow-auto max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Student", "विद्यार्थी")}</TableHead>
                    <TableHead>{t("Date", "मिति")}</TableHead>
                    <TableHead>{t("Status", "अवस्था")}</TableHead>
                    <TableHead>{t("Remarks", "टिप्पणी")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.preview.map((pr, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{pr.student_name}</TableCell>
                      <TableCell>{pr.date_bs || pr.date}</TableCell>
                      <TableCell><Badge variant="outline">{pr.status}</Badge></TableCell>
                      <TableCell>{pr.remarks || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Upload className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Import Attendance", "उपस्थिति आयात")}
        subtitle={t(
          "Bulk-load register rows from a CSV — validated first, nothing is written until you commit",
          "CSV बाट रजिस्टर आयात — पहिले जाँच, कमिट नगरेसम्म लेखिँदैन",
        )}
      />
      <AOSPageBody>
        <div className="max-w-4xl">
          <Wizard
            steps={steps}
            finishLabel={preview ? t(`Import ${preview.valid_count} rows`, `${preview.valid_count} आयात`) : t("Import", "आयात")}
            onFinish={async () => { await commitMutation.mutateAsync(); }}
          />
        </div>
      </AOSPageBody>

      <FilePicker
        open={showFilePicker}
        onOpenChange={setShowFilePicker}
        onSelect={handleManagedFileSelect}
        title="Select Attendance CSV"
      />
    </AOSPage>
  );
}
