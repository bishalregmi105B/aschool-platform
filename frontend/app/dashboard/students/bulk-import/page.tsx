"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FolderOpen, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { FilePicker } from "@/components/files/FilePicker";
import type { ManagedFile } from "@/lib/services/files.service";

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const handleManagedFileSelect = async (files: ManagedFile[]) => {
    const mf = files[0];
    try {
      const res = await fetch(mf.url);
      const blob = await res.blob();
      setFile(new File([blob], mf.original_name, { type: blob.type }));
      setResult(null);
    } catch {
      toast.error("Failed to load file from file manager");
    }
  };

  const downloadTemplate = () => {
    const rows = [
      [
        "first_name",
        "last_name",
        "gender",
        "date_of_birth",
        "class_name",
        "section",
        "enrollment_number",
        "guardian_name",
        "guardian_phone",
        "address",
      ],
      [
        "Ram",
        "Sharma",
        "male",
        "2010-05-15",
        "Class 5",
        "A",
        "STU-2024-001",
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
      return (await api.post("/students/bulk-import", formData, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: (d) => { setResult(d?.data || d); toast.success("Import completed!"); },
    onError: () => toast.error("Import failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Bulk Import Students</h1><p className="text-muted-foreground">Import multiple students from Excel/CSV file</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Upload File</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">Upload an Excel (.xlsx) or CSV file</p>
              <Button variant="outline" onClick={() => setShowFilePicker(true)}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Choose from File Manager
              </Button>
              {file && <p className="mt-3 text-sm font-medium">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
            </div>
            <Button className="w-full" onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> {upload.isPending ? "Importing..." : "Import Students"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Import Guide</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Your file should have these columns:</p>
            <div className="bg-muted rounded-lg p-4">
              <table className="text-xs w-full">
                <thead><tr className="border-b"><th className="text-left p-1">Column</th><th className="text-left p-1">Required</th><th className="text-left p-1">Example</th></tr></thead>
                <tbody>
                  {[
                    ["first_name", "Yes", "Ram"],
                    ["last_name", "Yes", "Sharma"],
                    ["gender", "Yes", "male"],
                    ["date_of_birth", "No", "2010-05-15"],
                    ["class_name", "Yes", "Class 5"],
                    ["section", "No", "A"],
                    ["enrollment_number", "No", "STU-2024-001"],
                    ["guardian_name", "No", "Hari Sharma"],
                    ["guardian_phone", "No", "9841234567"],
                    ["address", "No", "Kathmandu"],
                  ].map(([col, req, ex], i) => (
                    <tr key={i} className="border-b"><td className="p-1 font-mono">{col}</td><td className="p-1">{req}</td><td className="p-1 text-muted-foreground">{ex}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" className="w-full" onClick={downloadTemplate}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Download Sample Template
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader><CardTitle>Import Results</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 p-4 rounded-lg text-center"><CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" /><p className="text-lg font-bold text-green-600">{result.imported || result.success || 0}</p><p className="text-xs text-muted-foreground">Imported</p></div>
              <div className="bg-red-50 p-4 rounded-lg text-center"><AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-1" /><p className="text-lg font-bold text-red-600">{result.failed || result.errors?.length || 0}</p><p className="text-xs text-muted-foreground">Failed</p></div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center"><AlertCircle className="h-6 w-6 text-yellow-600 mx-auto mb-1" /><p className="text-lg font-bold text-yellow-600">{result.skipped || 0}</p><p className="text-xs text-muted-foreground">Skipped</p></div>
            </div>
            {result.errors?.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg"><h4 className="font-medium text-red-600 mb-2">Errors:</h4><ul className="text-sm space-y-1">{result.errors.map((e: string, i: number) => <li key={i}>• {e}</li>)}</ul></div>
            )}
          </CardContent>
        </Card>
      )}
      <FilePicker
        open={showFilePicker}
        onOpenChange={setShowFilePicker}
        onSelect={handleManagedFileSelect}
        title="Select Spreadsheet"
      />
    </div>
  );
}
