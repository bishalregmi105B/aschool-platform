"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileText, Download, AlertCircle, CheckCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FilePicker } from "@/components/files/FilePicker";
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
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Generic CSV Upload
          </h1>
          <p className="text-muted-foreground">Upload standard CSV templates to import data in bulk.</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" /> Download Template
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>Select a CSV file matching our provided templates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <button
                  type="button"
                  onClick={() => setShowFilePicker(true)}
                  className="w-full cursor-pointer flex flex-col items-center"
                >
                  <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                  <span className="text-sm font-medium">Choose from File Manager</span>
                  <span className="text-xs text-muted-foreground mt-1">
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
          </CardContent>
        </Card>

        {result ? (
          <div className="space-y-6">
            <Card className={result.error_rows > 0 ? "border-amber-200" : "border-green-200"}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-lg flex items-center gap-2 ${result.error_rows > 0 ? "text-amber-700" : "text-green-700"}`}>
                  {result.error_rows > 0 ? <AlertCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />} Import Summary
                </CardTitle>
                <CardDescription className="capitalize">{result.format_code?.replace(/_/g, " ")} — {result.filename}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center mt-2">
                  <div className="bg-background rounded-lg p-3 border">
                    <div className="text-2xl font-bold">{result.total_rows}</div>
                    <div className="text-xs text-muted-foreground">Total Processed</div>
                  </div>
                  <div className="bg-background rounded-lg p-3 border border-green-200">
                    <div className="text-2xl font-bold text-green-600">{result.imported_rows}</div>
                    <div className="text-xs text-muted-foreground">Successful</div>
                  </div>
                  <div className="bg-background rounded-lg p-3 border border-red-200">
                    <div className="text-2xl font-bold text-red-600">{result.error_rows}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {result.errors && result.errors.length > 0 && (
              <Card className="border-red-200 bg-red-50/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4" /> Import Warnings ({result.errors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-4 text-sm max-h-40 overflow-y-auto text-red-700">
                    {result.errors.map((err, i) => {
                      const msg = typeof err === "string" ? err : (err as { error?: string }).error || JSON.stringify(err);
                      return <li key={i}>{msg}</li>;
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="bg-muted/50 border-dashed">
            <CardHeader>
              <CardTitle className="text-lg">Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>1. Download the sample CSV template using the button above.</p>
              <p>2. Fill in the data without modifying the header row column names.</p>
              <p>3. Save the file as a <strong>Comma Separated Values (.csv)</strong> format.</p>
              <p>4. Select the correct import type and upload the file.</p>
              <div className="p-3 bg-amber-500/10 text-amber-600 rounded mt-4 border border-amber-500/20">
                <strong>Note:</strong> Maximum file size is 20MB. Rows import immediately and appear in the history tab.
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <FilePicker
        open={showFilePicker}
        onOpenChange={setShowFilePicker}
        onSelect={handleManagedFileSelect}
        fileType="spreadsheet"
        title="Select CSV File"
      />
    </div>
  );
}
