"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FolderOpen, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { FilePicker } from "@/components/files/FilePicker";
import type { ManagedFile } from "@/lib/services/files.service";

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

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportLog | null>(null);
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
      setResult(d?.data || d);
      const r = d?.data || d;
      if (r?.error_rows > 0) {
        toast.warning(`Import finished with ${r.error_rows} error row(s)`);
      } else {
        toast.success(`Import completed: ${r?.imported_rows ?? 0} student(s) imported`);
      }
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || "Import failed");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Bulk Import Students</h1><p className="text-muted-foreground">Import multiple students from Excel/CSV file (IEMIS Student Name-wise format)</p></div>
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
            <p className="text-sm text-muted-foreground">
              The first row must contain these column headers (extra columns are ignored):
            </p>
            <div className="bg-muted rounded-lg p-4">
              <table className="text-xs w-full">
                <thead><tr className="border-b"><th className="text-left p-1">Column</th><th className="text-left p-1">Required</th><th className="text-left p-1">Example</th></tr></thead>
                <tbody>
                  {[
                    ["Student Id", "Yes*", "STU-2082-001"],
                    ["Full Name", "Yes", "Ram Sharma"],
                    ["Gender", "No", "male"],
                    ["Class", "No", "5"],
                    ["Section", "No", "A"],
                    ["DOB", "No", "2067-01-15"],
                    ["Father Name", "No", "Hari Sharma"],
                    ["Mother Name", "No", "Sita Sharma"],
                    ["Guardian Name", "No", "Hari Sharma"],
                    ["Guardian Contact Number", "No", "9841234567"],
                    ["Permanent Address", "No", "Kathmandu"],
                  ].map(([col, req, ex], i) => (
                    <tr key={i} className="border-b"><td className="p-1 font-mono">{col}</td><td className="p-1">{req}</td><td className="text-muted-foreground p-1">{ex}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">* Rows are matched by Student Id — re-importing the same Id updates the existing student instead of duplicating. Students are enrolled by Full Name.</p>
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
              <div className="bg-green-50 p-4 rounded-lg text-center"><CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" /><p className="text-lg font-bold text-green-600">{result.imported_rows ?? 0}</p><p className="text-xs text-muted-foreground">Imported</p></div>
              <div className="bg-red-50 p-4 rounded-lg text-center"><AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-1" /><p className="text-lg font-bold text-red-600">{result.error_rows ?? 0}</p><p className="text-xs text-muted-foreground">Failed</p></div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center"><AlertCircle className="h-6 w-6 text-yellow-600 mx-auto mb-1" /><p className="text-lg font-bold text-yellow-600">{result.skipped_rows ?? 0}</p><p className="text-xs text-muted-foreground">Skipped</p></div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg"><h4 className="font-medium text-red-600 mb-2">Errors:</h4><ul className="text-sm space-y-1">{result.errors.map((e, i) => <li key={i}>• {e?.error || JSON.stringify(e)}</li>)}</ul></div>
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
