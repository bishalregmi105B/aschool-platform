"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listFormats,
  validateImport,
  runImport,
  getHistory,
  type IemisFormat,
  type ImportPreview,
  type ImportLog,
} from "@/lib/services/iemis.service";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageLoader } from "@/components/ui/spinner";
import {
  FileSpreadsheet,
  FolderOpen,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Eye,
  Download,
  Info,
} from "lucide-react";
import { FilePicker } from "@/components/files/FilePicker";
import type { ManagedFile } from "@/lib/services/files.service";
import Link from "next/link";

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ImportLog["status"], { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  partial: { label: "Partial", color: "bg-orange-100 text-orange-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
};

const FORMAT_LABELS: Record<string, string> = {
  student_namewise: "Student Name-wise Report",
  school_level: "School Level Report",
};

// ── Main Page ──────────────────────────────────────────────────────────────

export default function IemisImportPage() {
  return (
    <PluginGate slug="iemis_importer">
      <IemisImportContent />
    </PluginGate>
  );
}

function IemisImportContent() {
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [showFilePicker, setShowFilePicker] = useState(false);
  const queryClient = useQueryClient();

  // ── Formats list ──
  const { data: formatsData, isLoading: formatsLoading } = useQuery({
    queryKey: ["iemis-formats"],
    queryFn: () => listFormats(),
  });

  // ── Import history (sidebar summary) ──
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["iemis-history"],
    queryFn: async () => {
      const res = await getHistory(1);
      return res.items ?? [];
    },
  });

  // ── Validate (dry run) ──
  const validateMutation = useMutation({
    mutationFn: ({ file, format }: { file: File; format: string }) =>
      validateImport(file, format || undefined),
    onSuccess: (data) => {
      setPreview(data);
      setStep("preview");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      toast.error(axiosErr?.response?.data?.error || "Validation failed");
    },
  });

  // ── Live import ──
  const importMutation = useMutation({
    mutationFn: ({ file, format }: { file: File; format: string }) =>
      runImport(file, format || undefined),
    onSuccess: (data) => {
      toast.success(
        `Import complete — ${data.imported_rows} rows imported, ${data.skipped_rows} skipped, ${data.error_rows} errors`,
      );
      queryClient.invalidateQueries({ queryKey: ["iemis-history"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setStep("done");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      toast.error(axiosErr?.response?.data?.error || "Import failed");
    },
  });

  const handleManagedFileSelect = async (files: ManagedFile[]) => {
    const mf = files[0];
    try {
      const res = await fetch(mf.url);
      const blob = await res.blob();
      const file = new File([blob], mf.original_name, { type: blob.type });
      setSelectedFile(file);
      setPreview(null);
      setStep("upload");
    } catch {
      toast.error("Failed to load file from file manager");
    }
  };

  const handleValidate = () => {
    if (!selectedFile) {
      toast.error("Please select an Excel file first");
      return;
    }
    validateMutation.mutate({ file: selectedFile, format: selectedFormat });
  };

  const handleImport = () => {
    if (!selectedFile) return;
    importMutation.mutate({ file: selectedFile, format: selectedFormat });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setStep("upload");
    setSelectedFormat("");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            IEMIS Data Importer
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Import Nepal Ministry of Education IEMIS reports directly into ASchool
          </p>
        </div>
        <Link href="/dashboard/iemis-import/history">
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            Import History
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Import Data</TabsTrigger>
          <TabsTrigger value="formats">Supported Formats</TabsTrigger>
        </TabsList>

        {/* ── Import Tab ── */}
        <TabsContent value="import" className="space-y-4 mt-4">

          {/* Step 1: Upload */}
          {step === "upload" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Step 1 — Select IEMIS Export File</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Format selector */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Report Format (optional — auto-detected)</label>
                  <Select value={selectedFormat || "auto"} onValueChange={(v) => setSelectedFormat(v === "auto" ? "" : v)}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="Auto-detect from file" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="student_namewise">Student Name-wise Report</SelectItem>
                      <SelectItem value="school_level">School Level Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* File input */}
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  {selectedFile ? (
                    <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select your IEMIS <span className="font-medium">.xlsx</span> file
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 mb-3">Supports .xlsx and .xls — max 20 MB</p>
                  <Button variant="outline" size="sm" onClick={() => setShowFilePicker(true)}>
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                    Choose from File Manager
                  </Button>
                </div>

                {selectedFile && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleValidate}
                      disabled={validateMutation.isPending}
                      className="flex-1 max-w-xs"
                    >
                      {validateMutation.isPending ? "Validating…" : "Validate & Preview"}
                    </Button>
                    <Button variant="outline" onClick={handleReset}>Clear</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && preview && (
            <div className="space-y-4">
              {/* Summary card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Step 2 — Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatBox label="Format" value={FORMAT_LABELS[preview.format] ?? preview.format} />
                    <StatBox label="File" value={preview.filename} />
                    <StatBox label="Total Rows" value={String(preview.total_rows)} />
                    <StatBox label="Valid Rows" value={String(preview.valid_rows)} highlight />
                  </div>

                  {preview.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-xs font-medium text-yellow-800 flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Warnings ({preview.warnings.length})
                      </p>
                      <ul className="text-xs text-yellow-700 space-y-0.5">
                        {preview.warnings.map((w: string, i: number) => <li key={i}>• {w}</li>)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Data preview table */}
              {preview.preview.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">
                      Data Preview (first {preview.preview.length} rows)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(preview.preview[0]).filter((k) => k !== "row").map((k) => (
                            <TableHead key={k} className="text-xs whitespace-nowrap">{k}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.preview.map((row: Record<string, string | number | null>, i: number) => (
                          <TableRow key={i}>
                            {Object.entries(row)
                              .filter(([k]) => k !== "row")
                              .map(([k, v]) => (
                                <TableCell key={k} className="text-xs whitespace-nowrap max-w-[160px] truncate">
                                  {v != null ? String(v) : "—"}
                                </TableCell>
                              ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {importMutation.isPending ? "Importing…" : `Import ${preview.valid_rows} Rows`}
                </Button>
                <Button variant="outline" onClick={handleReset}>Start Over</Button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === "done" && (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <p className="font-semibold text-lg">Import Complete!</p>
                <p className="text-muted-foreground text-sm">
                  Your IEMIS data has been imported. Check import history for details.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={handleReset}>Import Another File</Button>
                  <Link href="/dashboard/iemis-import/history">
                    <Button variant="outline">View History</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Formats Tab ── */}
        <TabsContent value="formats" className="mt-4">
          {formatsLoading ? (
            <PageLoader />
          ) : (
            <div className="space-y-4">
              {(formatsData ?? []).map((fmt) => (
                <Card key={fmt.code}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                      {fmt.name}
                      <Badge variant="outline" className="text-xs font-mono">{fmt.code}</Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Sheet: {fmt.sheet}</p>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">IEMIS Column</TableHead>
                          <TableHead className="text-xs">ASchool Field</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fmt.columns.map((col) => (
                          <TableRow key={col.iemis_column}>
                            <TableCell className="text-xs font-mono text-muted-foreground">{col.iemis_column}</TableCell>
                            <TableCell className="text-xs font-mono text-blue-700">{col.aschool_field}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <FilePicker
        open={showFilePicker}
        onOpenChange={setShowFilePicker}
        onSelect={handleManagedFileSelect}
        title="Select IEMIS Spreadsheet"
      />
    </div>
  );
}

// ── Small stat box ─────────────────────────────────────────────────────────
function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border text-center ${highlight ? "bg-green-50 border-green-200" : "bg-muted/40"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold truncate ${highlight ? "text-green-700" : ""}`}>{value}</p>
    </div>
  );
}
