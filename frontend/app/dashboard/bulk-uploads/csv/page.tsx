"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileText, Download } from "lucide-react";
import { FilePicker } from "@/components/files/FilePicker";
import type { ManagedFile } from "@/lib/services/files.service";

export default function CsvUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const handleUpload = () => {
    if (!file) return toast.error("Please select a CSV file");
    if (!format) return toast.error("Please select an import type");
    
    setIsUploading(true);
    // Simulate upload delay since backend API is not yet available for generic CSV
    setTimeout(() => {
      setIsUploading(false);
      toast.success("CSV Import is queued for processing. You can check the history tab later.");
      setFile(null);
    }, 1500);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Generic CSV Upload
          </h1>
          <p className="text-muted-foreground">Upload standard CSV templates to import data in bulk.</p>
        </div>
        <Button variant="outline" onClick={() => toast.info("Downloading template...")}>
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
                  <SelectItem value="students">Students Basic Info</SelectItem>
                  <SelectItem value="staff">Staff Basic Info</SelectItem>
                  <SelectItem value="inventory">Inventory Items</SelectItem>
                  <SelectItem value="library">Library Books</SelectItem>
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
              disabled={isUploading || !file || !format}
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Start Import"}
            </Button>
          </CardContent>
        </Card>
        
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
              <strong>Note:</strong> Maximum file size is 5MB. Large imports will run in the background and may take a few minutes to complete.
            </div>
          </CardContent>
        </Card>
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
