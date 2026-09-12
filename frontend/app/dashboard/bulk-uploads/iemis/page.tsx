"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
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

interface ImportResponse {
  success: boolean;
  message: string;
  data: {
    log_id: string;
    total_processed: number;
    successful: number;
    failed: number;
    errors: string[];
  };
}

export default function IemisUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<string>("");
  const [result, setResult] = useState<ImportResponse["data"] | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file || !format) throw new Error("File and format required");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", format);

      // Since it's a multipart form data request, we use fetch or custom api call
      const res = await api.post("/iemis/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Import completed");
      setResult(data.data);
      setFile(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Import failed");
      setResult(null);
    }
  });

  const handleUpload = () => {
    if (!file) return toast.error("Please select a file");
    if (!format) return toast.error("Please select an export format");
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

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileSpreadsheet className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="IEMIS Excel Sync"
        subtitle="Upload exported Excel sheets from Nepal's IEMIS system to sync data."
      />
      <AOSPageBody>
        <div className="max-w-4xl grid md:grid-cols-2 gap-4">
          <FormSection title="Upload File">
            <p className="text-xs mb-4" style={{ color: "var(--w11-text-secondary)" }}>
              Select the exact Excel file downloaded from IEMIS
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student_namewise">Student Name-wise Report</SelectItem>
                    <SelectItem value="school_level">School Level Report</SelectItem>
                    <SelectItem value="staff_details">Staff Details Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Excel File (.xlsx, .xls)</Label>
                <div
                  className="border-2 border-dashed border-[var(--w11-border-default)] rounded-lg p-8 text-center"
                  style={{ background: "var(--w11-control-hover)" }}
                >
                  <button
                    type="button"
                    onClick={() => setShowFilePicker(true)}
                    className="w-full flex flex-col items-center"
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
                Start Import
              </Button>
            </div>
          </FormSection>

          {result && (
            <div className="space-y-4">
              <DataPanel
                title={
                  <span className="text-lg flex items-center gap-2" style={{ color: "#107c10" }}>
                    <CheckCircle className="h-5 w-5" /> Import Summary
                  </span>
                }
              >
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg p-3 border border-[var(--w11-border-subtle)]">
                    <div className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>{result.total_processed}</div>
                    <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Total Processed</div>
                  </div>
                  <div className="rounded-lg p-3 border" style={{ borderColor: "rgba(16,124,16,0.35)" }}>
                    <div className="text-2xl font-bold" style={{ color: "#107c10" }}>{result.successful}</div>
                    <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Successful</div>
                  </div>
                  <div className="rounded-lg p-3 border" style={{ borderColor: "rgba(196,43,28,0.35)" }}>
                    <div className="text-2xl font-bold" style={{ color: "#c42b1c" }}>{result.failed}</div>
                    <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Failed</div>
                  </div>
                </div>
              </DataPanel>

              {result.errors && result.errors.length > 0 && (
                <DataPanel
                  title={
                    <span className="text-sm flex items-center gap-2" style={{ color: "#c42b1c" }}>
                      <AlertCircle className="h-4 w-4" />
                      Import Warnings ({result.errors.length})
                    </span>
                  }
                >
                  <ul className="list-disc pl-4 text-sm max-h-40 overflow-y-auto" style={{ color: "#c42b1c" }}>
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </DataPanel>
              )}
            </div>
          )}
        </div>

        <FilePicker
          open={showFilePicker}
          onOpenChange={setShowFilePicker}
          onSelect={handleManagedFileSelect}
          fileType="spreadsheet"
          title="Select IEMIS Excel File"
        />
      </AOSPageBody>
    </AOSPage>
  );
}
