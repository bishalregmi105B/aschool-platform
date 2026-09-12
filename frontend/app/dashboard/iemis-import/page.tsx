"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listFormats,
  validateImport,
  runImport,
  getHistory,
  getTemplateUrl,
  type IemisFormat,
  type ImportPreview,
  type ImportLog,
} from "@/lib/services/iemis.service";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Eye,
  Download,
  ChevronRight,
} from "lucide-react";
import { FilePicker } from "@/components/files/FilePicker";
import {
  fetchManagedFileAsFile,
  type ManagedFile,
} from "@/lib/services/files.service";
import Link from "next/link";
import { useAOSRouteParams } from "@/lib/aos-window-route";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<ImportLog["status"], string> = {
  pending: "subtle",
  processing: "accent",
  completed: "success",
  partial: "warning",
  failed: "error",
};

const FORMAT_LABELS: Record<string, string> = {
  student_namewise: "Student Name-wise Report",
  school_level: "School Level Report",
};

// Quick links — the iemis_importer manifest ui.nav.subitems.
const QUICK_LINKS = [
  { label: "Import Students", desc: "Student Name-wise Report", icon: "Users", href: "/dashboard/iemis-import?format=student_namewise" },
  { label: "Import School Data", desc: "School Level Report", icon: "Building2", href: "/dashboard/iemis-import?format=school_level" },
  { label: "Import History", desc: "Every past import run", icon: "History", href: "/dashboard/iemis-import/history" },
];

// ── Main Page ──────────────────────────────────────────────────────────────

export default function IemisImportPage() {
  return (
    <PluginGate slug="iemis_importer">
      <IemisImportContent />
    </PluginGate>
  );
}

function IemisImportContent() {
  const searchParams = useAOSRouteParams();
  const initialFormat = searchParams.get("format") || "";
  const [selectedFormat, setSelectedFormat] = useState<string>(
    initialFormat === "student_namewise" || initialFormat === "school_level" ? initialFormat : "",
  );
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
      // Fetch the picked vault file's bytes back as a native File so the
      // existing validate/import multipart flow keeps working unchanged.
      const file = await fetchManagedFileAsFile(mf);
      setSelectedFile(file);
      setPreview(null);
      setStep("upload");
    } catch {
      toast.error("Failed to load file from the file manager");
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
    <AOSPage>
      <AOSPageHeader
        icon={<FileSpreadsheet className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="IEMIS Data Importer"
        subtitle="Import Nepal Ministry of Education IEMIS reports directly into ASchool"
        actions={
          <Link href="/dashboard/iemis-import/history">
            <Button variant="outline" size="sm">
              <History className="h-4 w-4 mr-2" />
              Import History
            </Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="max-w-5xl w-full mx-auto">
          {/* Dashboard — KPI stat grid from the import history this page loads */}
          <StatGrid>
            <KpiCard
              label="Imports Run"
              value={(historyData || []).length}
              icon={<FileSpreadsheet className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
            />
            <KpiCard
              label="Completed"
              value={(historyData || []).filter((l) => l.status === "completed").length}
              color="#107c10"
              icon={<CheckCircle2 className="h-4 w-4" style={{ color: "#107c10" }} />}
            />
            <KpiCard
              label="Needs Attention"
              value={(historyData || []).filter((l) => l.status === "failed" || l.status === "partial" || l.status === "processing").length}
              color="#d83b01"
              icon={<AlertTriangle className="h-4 w-4" style={{ color: "#d83b01" }} />}
            />
            <KpiCard
              label="Rows Imported"
              value={(historyData || []).reduce((a, l) => a + (l.imported_rows || 0), 0)}
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

          <Tabs defaultValue="import">
            <TabsList>
              <TabsTrigger value="import">Import Data</TabsTrigger>
              <TabsTrigger value="formats">Supported Formats</TabsTrigger>
            </TabsList>

            {/* ── Import Tab ── */}
            <TabsContent value="import" className="space-y-4 mt-4">

              {/* Step 1: Upload */}
              {step === "upload" && (
                <DataPanel title={<span className="text-base">Step 1 — Select IEMIS Export File</span>}>
                  <div className="space-y-4">
                    {/* Format selector */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>Report Format (optional — auto-detected)</label>
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

                    {/* Template download */}
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={getTemplateUrl("student_namewise")}
                        className="inline-flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5"
                        style={{
                          color: "var(--w11-accent)",
                          background: "var(--w11-accent-light)",
                          border: "1px solid var(--w11-accent)",
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Student Template (.xlsx)
                      </a>
                      <a
                        href={getTemplateUrl("school_level")}
                        className="inline-flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5"
                        style={{
                          color: "var(--w11-accent)",
                          background: "var(--w11-accent-light)",
                          border: "1px solid var(--w11-accent)",
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        School Level Template
                      </a>
                    </div>

                    {/* File input */}
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
                      style={{ borderColor: "var(--w11-border-strong)", background: "var(--w11-control-hover)" }}
                    >
                      <Upload className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--w11-text-secondary)" }} />
                      {selectedFile ? (
                        <p className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>{selectedFile.name}</p>
                      ) : (
                        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                          Select your IEMIS <span className="font-medium">.xlsx</span> file
                        </p>
                      )}
                      <p className="text-xs mt-1 mb-3" style={{ color: "var(--w11-text-secondary)" }}>Supports .xlsx and .xls — max 20 MB</p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowFilePicker(true)}>
                          <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                          Choose from File Manager
                        </Button>
                      </div>
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
                  </div>
                </DataPanel>
              )}

              {/* Step 2: Preview */}
              {step === "preview" && preview && (
                <div className="space-y-4">
                  {/* Summary card */}
                  <DataPanel
                    title={
                      <span className="text-base flex items-center gap-2">
                        <Eye className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /> Step 2 — Preview
                      </span>
                    }
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatBox label="Format" value={FORMAT_LABELS[preview.format] ?? preview.format} />
                        <StatBox label="File" value={preview.filename} />
                        <StatBox label="Total Rows" value={String(preview.total_rows)} />
                        <StatBox label="Valid Rows" value={String(preview.valid_rows)} highlight />
                      </div>

                      {preview.warnings.length > 0 && (
                        <div
                          className="rounded p-3"
                          style={{ background: "rgba(255,185,0,0.10)", border: "1px solid rgba(255,185,0,0.35)" }}
                        >
                          <p className="text-xs font-medium flex items-center gap-1 mb-1" style={{ color: "#8a6116" }}>
                            <AlertTriangle className="h-3.5 w-3.5" /> Warnings ({preview.warnings.length})
                          </p>
                          <ul className="text-xs space-y-0.5" style={{ color: "#8a6116" }}>
                            {preview.warnings.map((w: string, i: number) => <li key={i}>• {w}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </DataPanel>

                  {/* Data preview table */}
                  {preview.preview.length > 0 && (
                    <DataPanel
                      bodyClassName="overflow-x-auto"
                      title={
                        <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                          Data Preview (first {preview.preview.length} rows)
                        </span>
                      }
                    >
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
                    </DataPanel>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleImport}
                      disabled={importMutation.isPending}
                      style={{ background: "#107c10" }}
                    >
                      {importMutation.isPending ? "Importing…" : `Import ${preview.valid_rows} Rows`}
                    </Button>
                    <Button variant="outline" onClick={handleReset}>Start Over</Button>
                  </div>
                </div>
              )}

              {/* Step 3: Done */}
              {step === "done" && (
                <DataPanel>
                  <div className="py-10 text-center space-y-3">
                    <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: "#107c10" }} />
                    <p className="font-semibold text-lg" style={{ color: "var(--w11-text-primary)" }}>Import Complete!</p>
                    <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                      Your IEMIS data has been imported. Check import history for details.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={handleReset}>Import Another File</Button>
                      <Link href="/dashboard/iemis-import/history">
                        <Button variant="outline">View History</Button>
                      </Link>
                    </div>
                  </div>
                </DataPanel>
              )}
            </TabsContent>

            {/* ── Formats Tab ── */}
            <TabsContent value="formats" className="mt-4">
              {formatsLoading ? (
                <AOSModuleLoadingState label="Loading formats…" />
              ) : (
                <div className="space-y-4">
                  {(formatsData ?? []).map((fmt) => (
                    <DataPanel
                      key={fmt.code}
                      title={
                        <span className="text-base flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                          {fmt.name}
                          <span className="win11-chip subtle text-xs font-mono">{fmt.code}</span>
                        </span>
                      }
                    >
                      <p className="text-xs mb-3" style={{ color: "var(--w11-text-secondary)" }}>Sheet: {fmt.sheet}</p>
                      <div className="overflow-x-auto">
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
                                <TableCell className="text-xs font-mono" style={{ color: "var(--w11-text-secondary)" }}>{col.iemis_column}</TableCell>
                                <TableCell className="text-xs font-mono" style={{ color: "var(--w11-accent)" }}>{col.aschool_field}</TableCell>
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
          title="Select IEMIS Spreadsheet"
        />
      </AOSPageBody>
    </AOSPage>
  );
}

// ── Small stat box ─────────────────────────────────────────────────────────
function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-lg p-3 border text-center"
      style={
        highlight
          ? {
              background: "rgba(16,124,16,0.08)",
              borderColor: "rgba(16,124,16,0.35)",
            }
          : {
              background: "var(--w11-control-hover)",
              borderColor: "var(--w11-border-subtle)",
            }
      }
    >
      <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{label}</p>
      <p className="text-sm font-semibold truncate" style={{ color: highlight ? "#107c10" : "var(--w11-text-primary)" }}>{value}</p>
    </div>
  );
}
