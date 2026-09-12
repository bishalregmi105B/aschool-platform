"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileText, Download, AlertCircle, CheckCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FilePicker } from "@/components/files/FilePicker";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FormSection,
} from "@/components/aos/kit/page-kit";
import type { ManagedFile } from "@/lib/services/files.service";

interface ImportResult {
  format_code: string;
  filename: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  errors: Array<Record<string, unknown> | string>;
  status: string;
}

interface IemisFormat {
  code: string;
  name: string;
  columns: Array<{ iemis_column: string; aschool_field: string }>;
}

/** The three import formats the backend actually supports (GET /iemis/formats). */
const FORMATS = [
  { value: "student_namewise", label: "Students Basic Info (IEMIS Name-wise)" },
  { value: "staff_details", label: "Staff Details" },
  { value: "school_level", label: "School Level Report" },
];

export default function CsvUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);

  // Column names for the "Download Template" button — the same headers the
  // backend parser maps (GET /iemis/formats). No fake toast: this downloads
  // a real CSV built from the live column map.
  const { data: formats } = useQuery({
    queryKey: ["iemis-formats"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<IemisFormat[]>>("/iemis/formats");
      return res.data.data || [];
    },
    retry: 1,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file || !format) throw new Error("File and format required");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", format);
      const res = await api.post<ApiResponse<ImportResult>>("/iemis/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setResult(data);
      setFile(null);
      toast.success("Import completed");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Import failed. Please check the file and try again.";
      toast.error(msg);
      setResult(null);
    },
  });

  const handleUpload = () => {
    if (!file) return toast.error("Please select a CSV file");
    if (!format) return toast.error("Please select an import type");
    importMutation.mutate();
  };

  const handleManagedFileSelect = async (files: ManagedFile[]) => {
    const selected = files[0];
    try {
      const response = await fetch(selected.url);
      const blob = await response.blob();
      const managedFile = new File([blob], selected.original_name, {
        type: blob.type,
      });
      setFile(managedFile);
      toast.success(`${selected.original_name} selected from File Manager.`);
    } catch {
      toast.error("Could not load selected file from File Manager");
    }
  };

  const downloadTemplate = () => {
    const fmt = formats?.find((f) => f.code === format) || formats?.[0];
    if (!fmt) {
      toast.error("Template columns could not be loaded yet. Try again in a moment.");
      return;
    }
    const columns = fmt.columns.map((c) => c.iemis_column);
    const csv = [columns.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fmt.code}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Template for ${fmt.name} downloaded`);
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Generic CSV Upload"
        subtitle="Upload standard CSV templates to import data in bulk."
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download Template
          </Button>
        }
      />
      <AOSPageBody>
        <div className="max-w-4xl grid md:grid-cols-2 gap-4">
          <FormSection title="Upload File">
            <p className="text-xs mb-4" style={{ color: "var(--w11-text-secondary)" }}>
              Select a CSV file matching our provided templates
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Import Type</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select data type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>CSV File (.csv)</Label>
                <div
                  className="border-2 border-dashed border-[var(--w11-border-default)] rounded-lg p-8 text-center"
                  style={{ background: "var(--w11-control-hover)" }}
                >
                  <button
                    type="button"
                    onClick={() => setShowFilePicker(true)}
                    className="w-full cursor-pointer flex flex-col items-center"
                  >
                    <UploadCloud className="h-10 w-10 mb-2" style={{ color: "var(--w11-text-secondary)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>Choose from File Manager</span>
                    <span className="text-xs mt-1" style={{ color: "var(--w11-text-secondary)" }}>
                      {file ? file.name : "No file selected"}
                    </span>
                  </button>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleUpload}
                disabled={importMutation.isPending || !file || !format}
              >
                {importMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                {importMutation.isPending ? "Importing..." : "Start Import"}
              </Button>
            </div>
          </FormSection>

          {result ? (
            <div className="space-y-4">
              <DataPanel
                title={
                  <span
                    className="text-lg flex items-center gap-2"
                    style={{ color: result.error_rows > 0 ? "#8a6116" : "#107c10" }}
                  >
                    {result.error_rows > 0 ? <AlertCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />} Import Summary
                  </span>
                }
              >
                <p className="text-xs mb-3 capitalize" style={{ color: "var(--w11-text-secondary)" }}>
                  {result.format_code?.replace(/_/g, " ")} — {result.filename}
                </p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg p-3 border border-[var(--w11-border-subtle)]">
                    <div className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>{result.total_rows}</div>
                    <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Total Processed</div>
                  </div>
                  <div className="rounded-lg p-3 border" style={{ borderColor: "rgba(16,124,16,0.35)" }}>
                    <div className="text-2xl font-bold" style={{ color: "#107c10" }}>{result.imported_rows}</div>
                    <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Successful</div>
                  </div>
                  <div className="rounded-lg p-3 border" style={{ borderColor: "rgba(196,43,28,0.35)" }}>
                    <div className="text-2xl font-bold" style={{ color: "#c42b1c" }}>{result.error_rows}</div>
                    <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Failed</div>
                  </div>
                </div>
              </DataPanel>

              {result.errors && result.errors.length > 0 && (
                <DataPanel
                  title={
                    <span className="text-sm flex items-center gap-2" style={{ color: "#c42b1c" }}>
                      <AlertCircle className="h-4 w-4" /> Import Warnings ({result.errors.length})
                    </span>
                  }
                >
                  <ul className="list-disc pl-4 text-sm max-h-40 overflow-y-auto" style={{ color: "#c42b1c" }}>
                    {result.errors.map((err, i) => {
                      const msg = typeof err === "string" ? err : (err as { error?: string }).error || JSON.stringify(err);
                      return <li key={i}>{msg}</li>;
                    })}
                  </ul>
                </DataPanel>
              )}
            </div>
          ) : (
            <DataPanel title={<span className="text-lg">Instructions</span>}>
              <div className="space-y-4 text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                <p>1. Download the sample CSV template using the button above.</p>
                <p>2. Fill in the data without modifying the header row column names.</p>
                <p>3. Save the file as a <strong>Comma Separated Values (.csv)</strong> format.</p>
                <p>4. Select the correct import type and upload the file.</p>
                <div
                  className="p-3 rounded mt-4 border"
                  style={{
                    color: "#8a6116",
                    background: "rgba(255,185,0,0.10)",
                    borderColor: "rgba(255,185,0,0.25)",
                  }}
                >
                  <strong>Note:</strong> Maximum file size is 20MB. Rows import immediately and appear in the history tab.
                </div>
              </div>
            </DataPanel>
          )}
        </div>

        <FilePicker
          open={showFilePicker}
          onOpenChange={setShowFilePicker}
          onSelect={handleManagedFileSelect}
          fileType="spreadsheet"
          title="Select CSV File"
        />
      </AOSPageBody>
    </AOSPage>
  );
}
