"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { FilePicker } from "@/components/files/FilePicker";
import type { ManagedFile } from "@/lib/services/files.service";
import { Upload, FileText, CheckCircle, FolderOpen } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
} from "@/components/aos/kit/page-kit";

export default function UploadResourcesPage() {
  return <PluginGate slug="elibrary"><UploadContent /></PluginGate>;
}

function UploadContent() {
  const [form, setForm] = useState({ title: "", type: "past_paper", subject: "", class_name: "", year: "", exam_type: "final", description: "" });
  const [file, setFile] = useState<ManagedFile | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const handleFileSelect = (files: ManagedFile[]) => {
    if (files[0]) {
      setFile(files[0]);
      // Prefill the title from the filename if the user hasn't typed one yet.
      if (!form.title) {
        setForm((prev) => ({
          ...prev,
          title: files[0].original_name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        }));
      }
    }
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      // The file already lives in the school vault (picked via the file
      // manager), so we only register its metadata:
      // POST /elibrary/books | /elibrary/papers | /elibrary/resources with the
      // vault URL.
      const fileUrl = file.url;
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
      const ext = file.extension?.toLowerCase() || "pdf";
      return (await api.post("/elibrary/books", {
        title: form.title,
        author: form.subject || undefined,
        file_url: fileUrl,
        file_type: ext === "epub" ? "epub" : "pdf",
      })).data;
    },
    onSuccess: () => { toast.success("Resource published successfully"); setUploaded(true); setFile(null); setForm({ title: "", type: "past_paper", subject: "", class_name: "", year: "", exam_type: "final", description: "" }); },
    onError: (e: any) => {
      // surface the backend's actionable message (e.g. "Install this plugin
      // from the marketplace." when file_management is not installed)
      toast.error(e?.response?.data?.error || e?.message || "Publish failed");
    },
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Upload className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Upload Resources"
        subtitle="Upload past papers, e-books, or OER resources"
      />
      <AOSPageBody>
        <div className="space-y-4 max-w-2xl">
          {uploaded && (
            <div className="win11-infobar success flex items-center gap-3">
              <CheckCircle className="h-5 w-5" />
              <p className="text-sm font-medium">Resource uploaded successfully!</p>
              <Button size="sm" variant="outline" onClick={() => setUploaded(false)} className="ml-auto">Upload Another</Button>
            </div>
          )}

          <FormSection title="Resource Details">
            <div className="space-y-4">
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. SEE Mathematics 2079 Question Paper" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Resource Type</Label>
                  <AdvancedSelect
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v })}
            options={[{ value: 'past_paper', label: 'Past Paper' }, { value: 'ebook', label: 'E-Book' }, { value: 'oer', label: 'OER Resource' }, { value: 'worksheet', label: 'Worksheet' }, { value: 'notes', label: 'Notes' }]}
          />
                </div>
                <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Class</Label><Input value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} placeholder="e.g. SEE / Class 10" /></div>
                <div className="space-y-2"><Label>Year</Label><Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2079" /></div>
              </div>
              {form.type === "past_paper" && (
                <div className="space-y-2"><Label>Exam Type</Label>
                  <AdvancedSelect
            value={form.exam_type}
            onChange={(v) => setForm({ ...form, exam_type: v })}
            options={[{ value: 'final', label: 'Final Exam' }, { value: 'mid_term', label: 'Mid-Term' }, { value: 'pre_board', label: 'Pre-Board' }, { value: 'see', label: 'SEE' }]}
          />
                </div>
              )}
              <div className="space-y-2"><Label>Description (optional)</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            </div>
          </FormSection>

          <FormSection title="Resource File">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
              style={{ borderColor: "var(--w11-border-default)" }}
              onClick={() => setShowFilePicker(true)}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8" style={{ color: "var(--w11-accent)" }} />
                  <div className="text-left"><p className="font-medium">{file.original_name}</p><p className="text-sm text-[color:var(--w11-text-secondary)]">{(file.size_bytes / 1024 / 1024).toFixed(2)} MB</p></div>
                </div>
              ) : (
                <>
                  <FolderOpen className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--w11-accent)" }} />
                  <p className="font-medium">Choose from the file manager</p>
                  <p className="text-sm mt-1 text-[color:var(--w11-text-secondary)]">Pick an existing vault file or upload a new one — PDF, DOCX, images</p>
                </>
              )}
            </div>
          </FormSection>

          <Button className="w-full" onClick={() => upload.mutate()} disabled={upload.isPending || !file || !form.title}>
            {upload.isPending ? <Spinner /> : <><Upload className="h-4 w-4 mr-2" />Publish Resource</>}
          </Button>
        </div>
      </AOSPageBody>

      <FilePicker
        open={showFilePicker}
        onOpenChange={setShowFilePicker}
        onSelect={handleFileSelect}
        title="Select Resource File"
      />
    </AOSPage>
  );
}
