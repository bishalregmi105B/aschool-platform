"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Upload, FileSpreadsheet, FileCheck2, CloudUpload, AlertTriangle,
  CheckCircle2, ArrowLeft, XCircle, Download,
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
    <PluginGate slug="attendance">
      <ImportContent />
    </PluginGate>
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState("");
  const [rawCsv, setRawCsv] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<{ applied: number; skipped_invalid: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseEntries(rawCsv), [rawCsv]);

  const reset = () => {
    setStep(1);
    setFileName("");
    setRawCsv("");
    setPreview(null);
    setCommitResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error("Please choose a .csv file (export your spreadsheet as CSV first).");
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setRawCsv(text);
    setPreview(null);
    setCommitResult(null);
    setStep(2);
  };

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/attendance/import/preview", { entries: parsed.entries });
      return res.data?.data as PreviewResponse;
    },
    onSuccess: (data) => {
      setPreview(data);
      setStep(3);
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : "Preview failed");
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/attendance/import/commit", { entries: parsed.entries });
      return res.data?.data as { applied: number; skipped_invalid: number };
    },
    onSuccess: (data) => {
      setCommitResult(data);
      toast.success(`Import applied — ${data?.applied ?? 0} rows written.`);
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : "Commit failed");
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

  const STEPS = [
    { id: 1, label: "Choose file", icon: Upload },
    { id: 2, label: "Parse & review", icon: FileSpreadsheet },
    { id: 3, label: "Preview & import", icon: CloudUpload },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-6 w-6" /> Import Attendance
          </h1>
          <p className="text-muted-foreground text-sm">
            Bulk-load register rows from a CSV — validated first, nothing is
            written until you commit
          </p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" /> CSV template
        </Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                step === s.id
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : step > s.id
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30"
                    : "border-border text-muted-foreground"
              }`}
            >
              {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              {s.id}. {s.label}
            </div>
            {i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
          </div>
        ))}
      </div>

      {/* ── Step 1: choose file ───────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">1. Choose a CSV file</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-12 cursor-pointer hover:bg-muted/40 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFile(e.dataTransfer.files?.[0]);
              }}
            >
              <Upload className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="font-medium">Drop a CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground">
                Columns: student_id, date_bs (or date), status, remarks — .csv / .txt
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Spreadsheets (XLSX) are not parsed in-browser — export the sheet as CSV
              first. Statuses: present, absent, late, half_day, leave, holiday.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: client-side parse ─────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> 2. Parsed {fileName}
              </span>
              <Button variant="ghost" size="sm" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Start over
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.entries.length === 0 && parsed.parseErrors.length === 0 ? (
              <EmptyState
                size="sm"
                icon={FileSpreadsheet}
                title="Nothing parsed"
                body="The file has no data rows — check the column layout."
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-lg border px-4 py-2">
                    <p className="text-xl font-bold">{parsed.entries.length}</p>
                    <p className="text-[11px] text-muted-foreground">rows parsed</p>
                  </div>
                  {(parsed.parseErrors.length > 0 || parsed.entries.length === 0) && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
                      <p className="text-xl font-bold text-amber-700">{parsed.parseErrors.length}</p>
                      <p className="text-[11px] text-amber-700">local parse issues</p>
                    </div>
                  )}
                  <div className="ml-auto flex items-end">
                    <Button
                      onClick={() => previewMutation.mutate()}
                      disabled={parsed.entries.length === 0 || previewMutation.isPending}
                    >
                      {previewMutation.isPending ? (
                        <Spinner className="h-4 w-4 mr-2" />
                      ) : (
                        <FileCheck2 className="h-4 w-4 mr-2" />
                      )}
                      Validate against the school
                    </Button>
                  </div>
                </div>

                {/* Sample of parsed rows */}
                {parsed.entries.length > 0 && (
                  <div className="rounded-lg border overflow-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-14">Row</TableHead>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsed.entries.slice(0, 20).map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-center font-mono text-xs">{i + 1}</TableCell>
                            <TableCell className="font-mono text-xs">{e.student_id}</TableCell>
                            <TableCell>{e.date_bs || e.date}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{e.status}</Badge>
                            </TableCell>
                            <TableCell>{e.remarks || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {parsed.entries.length > 20 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        Showing first 20 of {parsed.entries.length} rows.
                      </p>
                    )}
                  </div>
                )}

                {/* Local parse errors */}
                {parsed.parseErrors.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                    <p className="font-medium">Some rows were skipped while parsing:</p>
                    {parsed.parseErrors.slice(0, 5).map((e, i) => (
                      <p key={i}>• {e}</p>
                    ))}
                    {parsed.parseErrors.length > 5 && (
                      <p>• …and {parsed.parseErrors.length - 5} more</p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: server preview + commit ───────────────────────────────── */}
      {step === 3 && preview && (        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CloudUpload className="h-4 w-4" /> 3. Preview & import
              </span>
              <Button variant="ghost" size="sm" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Start over
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {commitResult ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600 mb-2" />
                <p className="text-lg font-bold text-emerald-700">
                  {commitResult.applied} rows applied
                </p>
                {commitResult.skipped_invalid > 0 && (
                  <p className="text-sm text-amber-700">
                    {commitResult.skipped_invalid} invalid rows were skipped.
                  </p>
                )}
                <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
                  Import another file
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2">
                    <p className="text-xl font-bold text-emerald-700">{preview.valid_count}</p>
                    <p className="text-[11px] text-emerald-700">valid rows</p>
                  </div>
                  <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 px-4 py-2">
                    <p className="text-xl font-bold text-red-700">{preview.error_count}</p>
                    <p className="text-[11px] text-red-700">rows with errors</p>
                  </div>
                </div>

                {/* Per-row errors */}
                {preview.errors.length > 0 && (
                  <div className="rounded-lg border border-red-200 overflow-auto max-h-56">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-red-50 dark:bg-red-950/20">
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.errors.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-center font-mono text-xs">{e.row}</TableCell>
                            <TableCell className="text-sm text-red-700">
                              <span className="inline-flex items-center gap-1.5">
                                <XCircle className="h-3.5 w-3.5" /> {e.error}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {preview.error_count > preview.errors.length && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        Showing first {preview.errors.length} of {preview.error_count} errors.
                      </p>
                    )}
                  </div>
                )}

                {/* Valid preview rows */}
                {preview.preview.length > 0 && (
                  <div className="rounded-lg border overflow-auto max-h-72">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Student</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.preview.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-sm">{p.student_name}</TableCell>
                            <TableCell>{p.date_bs || p.date}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{p.status}</Badge>
                            </TableCell>
                            <TableCell>{p.remarks || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {preview.valid_count > preview.preview.length && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        Showing first {preview.preview.length} of {preview.valid_count} valid rows.
                      </p>
                    )}
                  </div>
                )}

                {preview.valid_count === 0 ? (
                  <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4" /> No valid rows to import — fix the
                    errors and upload again.
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => commitMutation.mutate()}
                      disabled={commitMutation.isPending || preview.valid_count === 0}
                    >
                      {commitMutation.isPending ? (
                        <Spinner className="h-4 w-4 mr-2" />
                      ) : (
                        <CloudUpload className="h-4 w-4 mr-2" />
                      )}
                      Import {preview.valid_count} rows
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
