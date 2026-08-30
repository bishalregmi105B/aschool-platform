"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Upload, FileText, CheckCircle } from "lucide-react";

export default function UploadResourcesPage() {
  return <PluginGate slug="elibrary"><UploadContent /></PluginGate>;
}

function UploadContent() {
  const [form, setForm] = useState({ title: "", type: "past_paper", subject: "", class_name: "", year: "", exam_type: "final", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      // Two-step contract (backend stores bytes centrally, metadata per type):
      // 1) POST /files/upload (multipart) → {url}
      // 2) POST /elibrary/books | /elibrary/papers | /elibrary/resources with that URL
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "elibrary");
      const uploaded = (await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
      const fileUrl = uploaded?.data?.url || uploaded?.url;
      if (!fileUrl) throw new Error("Upload did not return a file URL");
      const meta = {
        title: form.title,
        description: form.description || undefined,
        year: form.year || undefined,
      };
      if (form.type === "past_paper") {
        return (await api.post("/elibrary/papers", { ...meta, file_url: fileUrl, exam_type: form.exam_type })).data;
      }
      if (form.type === "oer") {
        return (await api.post("/elibrary/resources", { ...meta, url: fileUrl, resource_type: "document" })).data;
      }
      // ebook / worksheet / notes → stored as a digital book (the only other
      // backend-backed elibrary entity)
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      return (await api.post("/elibrary/books", {
        title: form.title,
        author: form.subject || undefined,
        file_url: fileUrl,
        file_type: ext === "epub" ? "epub" : "pdf",
      })).data;
    },
    onSuccess: () => { toast.success("Resource uploaded successfully"); setUploaded(true); setFile(null); setForm({ title: "", type: "past_paper", subject: "", class_name: "", year: "", exam_type: "final", description: "" }); },
    onError: (e: any) => {
      // surface the backend's actionable message (e.g. "Install this plugin
      // from the marketplace." when file_management is not installed)
      toast.error(e?.response?.data?.error || e?.message || "Upload failed");
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Upload className="h-6 w-6 text-blue-600" />
        <div><h1 className="text-2xl font-bold">Upload Resources</h1><p className="text-muted-foreground">Upload past papers, e-books, or OER resources</p></div>
      </div>

      {uploaded && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800 dark:text-green-400">Resource uploaded successfully!</p>
            <Button size="sm" variant="outline" onClick={() => setUploaded(false)} className="ml-auto">Upload Another</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Resource Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. SEE Mathematics 2079 Question Paper" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Resource Type</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="past_paper">Past Paper</option>
                <option value="ebook">E-Book</option>
                <option value="oer">OER Resource</option>
                <option value="worksheet">Worksheet</option>
                <option value="notes">Notes</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Class</Label><Input value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} placeholder="e.g. SEE / Class 10" /></div>
            <div className="space-y-2"><Label>Year</Label><Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2079" /></div>
          </div>
          {form.type === "past_paper" && (
            <div className="space-y-2"><Label>Exam Type</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.exam_type} onChange={(e) => setForm({ ...form, exam_type: e.target.value })}>
                <option value="final">Final Exam</option><option value="mid_term">Mid-Term</option><option value="pre_board">Pre-Board</option><option value="see">SEE</option>
              </select>
            </div>
          )}
          <div className="space-y-2"><Label>Description (optional)</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>File Upload</CardTitle></CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="text-left"><p className="font-medium">{file.name}</p><p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Click to select file</p>
                <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, images — max 20MB</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </CardContent>
      </Card>

      <Button className="w-full" onClick={() => upload.mutate()} disabled={upload.isPending || !file || !form.title}>
        {upload.isPending ? <Spinner /> : <><Upload className="h-4 w-4 mr-2" />Upload Resource</>}
      </Button>
    </div>
  );
}
