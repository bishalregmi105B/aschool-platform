"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FilePicker } from "@/components/files/FilePicker";
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" /> IEMIS Excel Sync
        </h1>
        <p className="text-muted-foreground">Upload exported Excel sheets from Nepal&apos;s IEMIS system to sync data.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>Select the exact Excel file downloaded from IEMIS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <button
                  type="button"
                  onClick={() => setShowFilePicker(true)}
                  className="w-full flex flex-col items-center"
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
              Start Import
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" /> Import Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center mt-2">
                  <div className="bg-background rounded-lg p-3 border">
                    <div className="text-2xl font-bold">{result.total_processed}</div>
                    <div className="text-xs text-muted-foreground">Total Processed</div>
                  </div>
                  <div className="bg-background rounded-lg p-3 border border-green-200">
                    <div className="text-2xl font-bold text-green-600">{result.successful}</div>
                    <div className="text-xs text-muted-foreground">Successful</div>
                  </div>
                  <div className="bg-background rounded-lg p-3 border border-red-200">
                    <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {result.errors && result.errors.length > 0 && (
              <Card className="border-red-200 bg-red-50/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    Import Warnings ({result.errors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-4 text-sm max-h-40 overflow-y-auto text-red-700">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
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
    </div>
  );
}
