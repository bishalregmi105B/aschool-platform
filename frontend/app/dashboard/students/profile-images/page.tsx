"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FilePicker } from "@/components/files/FilePicker";
import {
  fetchManagedFileAsFile,
  type ManagedFile,
} from "@/lib/services/files.service";
import { Image as ImageIcon, FolderOpen, CheckCircle2, XCircle, AlertCircle, FileArchive } from "lucide-react";

interface UploadDetail {
  filename: string;
  student_id: string;
  status: "updated" | "not_found" | "error";
  message?: string;
}

interface UploadResult {
  total: number;
  updated: number;
  skipped: number;
  errors: string[];
  details: UploadDetail[];
}

export default function StudentProfileImagesPage() {
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function handleFileSelect(files: ManagedFile[]) {
    const mf = files[0];
    if (!mf) return;
    setLoadingFile(true);
    try {
      // Fetch the picked vault file's bytes back as a native File so the
      // existing bulk-upload flow (multipart POST) keeps working unchanged.
      const fileObj = await fetchManagedFileAsFile(mf);
      if (!fileObj.name.toLowerCase().endsWith(".zip")) {
        toast.error("Please select a .zip file");
        return;
      }
      setSelectedFile(fileObj);
      setResult(null);
    } catch {
      toast.error("Failed to load file from the file manager");
    } finally {
      setLoadingFile(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(20);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      setProgress(50);
      const res = await api.post("/students/bulk-profile-images", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProgress(100);

      const data = res.data?.data as UploadResult;
      setResult(data);
      toast.success(`Updated ${data.updated} student photo${data.updated !== 1 ? "s" : ""}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ImageIcon className="h-6 w-6" /> Student Profile Images
        </h1>
        <p className="text-muted-foreground">Bulk upload and manage student display pictures</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Image Upload</CardTitle>
          <CardDescription>
            Upload a zip file containing student images named by their Admission Number (e.g.,{" "}
            <code className="bg-muted px-1 rounded text-xs">ADM1023.jpg</code>)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
              selectedFile ? "border-green-400 bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/50"
            }`}
            onClick={() => setShowFilePicker(true)}
          >
            {loadingFile ? (
              <>
                <FileArchive className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                <h3 className="font-semibold text-lg mb-1">Loading file from the vault…</h3>
              </>
            ) : selectedFile ? (
              <>
                <FileArchive className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-1 text-green-700 dark:text-green-400">
                  {selectedFile.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB — Click to change
                </p>
              </>
            ) : (
              <>
                <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-1">Choose a .zip file</h3>
                <p className="text-sm text-muted-foreground mb-4">Pick from the school file manager — upload it there first if needed</p>
              </>
            )}
            <Button type="button" variant={selectedFile ? "secondary" : "default"}>
              {selectedFile ? "Change ZIP Archive" : "Browse Vault"}
            </Button>
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">Uploading and processing images…</p>
            </div>
          )}

          {selectedFile && !uploading && (
            <Button onClick={handleUpload} className="w-full" size="lg">
              <FolderOpen className="h-4 w-4 mr-2" /> Upload &amp; Match Student Photos
            </Button>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" /> Upload Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-sm text-muted-foreground">Total Images</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-100">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.updated}</p>
                <p className="text-sm text-green-600">Updated</p>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-100">
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{result.skipped}</p>
                <p className="text-sm text-orange-600">Not Found</p>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100">
                <p className="text-sm font-medium text-red-700 mb-1">Errors:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}

            {result.details && result.details.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {result.details.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm py-1.5 px-2 border-b last:border-0 rounded"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{d.filename}</span>
                    <div className="flex items-center gap-2">
                      {d.student_id && (
                        <span className="text-xs text-muted-foreground">{d.student_id}</span>
                      )}
                      <Badge
                        variant={
                          d.status === "updated"
                            ? "default"
                            : d.status === "not_found"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {d.status === "updated" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {d.status === "not_found" && <AlertCircle className="h-3 w-3 mr-1" />}
                        {d.status === "error" && <XCircle className="h-3 w-3 mr-1" />}
                        {d.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Create a ZIP file containing student profile photos.</p>
          <p>
            2. Name each image using the student&apos;s <strong>Admission Number</strong> (e.g.,{" "}
            <code className="bg-muted px-1 rounded">ADM1023.jpg</code>).
          </p>
          <p>3. Supported formats: JPG, JPEG, PNG, WebP.</p>
          <p>4. The system will match each image to the student and update their profile picture.</p>
          <p>5. Images that don&apos;t match any student will be reported as &quot;Not Found&quot;.</p>
        </CardContent>
      </Card>

      <FilePicker
        open={showFilePicker}
        onOpenChange={setShowFilePicker}
        onSelect={handleFileSelect}
        title="Select ZIP Archive"
      />
    </div>
  );
}
